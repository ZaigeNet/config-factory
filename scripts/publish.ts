import { NodeSSH } from 'node-ssh';
import { basename, relative, resolve } from 'node:path';
import { Config } from '../utils/utils';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import log4js from 'log4js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import confirm from '@inquirer/confirm';
import { minimatch } from 'minimatch';

const agent = Config.global.ssh_agent;
const hosts = Config.hosts;

const ignorePatterns = ['roa_dn42*.conf'];
const redundantFiles: Map<NodeSSH, { hostname: string; key: string; type: string }[]> = new Map();

log4js.configure({
  appenders: {
    out: { type: 'stdout' },
  },
  categories: {
    default: { appenders: ['out'], level: 'info' },
  },
});

const argv = yargs(hideBin(process.argv))
  .option('exclude-wireguard', {
    type: 'boolean',
    default: false,
    description: 'Skip wireguard config publishing',
  })
  .option('exclude-bird', {
    type: 'boolean',
    default: false,
    description: 'Skip bird config publishing',
  })
  .parseSync();

const getWireguardConfigPath = (hostname: string) =>
  resolve(__dirname, `../dist/${hostname}/wireguard`);
const getBirdConfigPath = (hostname: string) => resolve(__dirname, `../dist/${hostname}/bird`);

const getRemoteHash = async (ssh: NodeSSH, dir: string) => {
  const map = new Map<string, string>();
  const result = await ssh.execCommand(`find ${dir} -type f | xargs md5sum`);
  result.stdout
    .split('\n')
    .filter(item => item.endsWith('.conf'))
    .map(item => {
      const [md5, path] = item.split('  ');
      const fileName = relative(dir, path).replace(/\\/g, '/');
      map.set(fileName, md5);
    });
  return map;
};

const getLocalHash = async (dir: string) => {
  const map = new Map<string, string>();
  const step = async (curDir: string) =>
    Promise.all(
      (await fs.readdir(curDir)).map(async path => {
        path = resolve(curDir, path);

        if ((await fs.stat(path)).isDirectory()) {
          return step(path);
        }

        const fileName = relative(dir, path).replace(/\\/g, '/');
        const md5 = crypto
          .createHash('md5')
          .update(await fs.readFile(path, 'utf-8'))
          .digest('hex');
        map.set(fileName, md5);
      }),
    );
  await step(dir);
  return map;
};

const checkMap = async (
  type: 'Wireguard' | 'Bird',
  hostname: string,
  oldMap: Map<string, string>,
  newMap: Map<string, string>,
  path: string,
  ssh: NodeSSH,
) => {
  const visited = new Set<string>();
  const logger = log4js.getLogger(type);

  for (const [key, value] of newMap) {
    const oldMd5 = oldMap.get(key);
    visited.add(key);

    if (!oldMd5) {
      logger.info(`${hostname} ${key} is not exist`);
      await ssh.putFile(resolve(path, key), `/etc/${type.toLowerCase()}/${key}`);

      if (type === 'Wireguard') {
        const { stderr } = await ssh.execCommand(
          `systemctl enable --now wg-quick@${basename(key, '.conf')}`,
        );
        stderr && logger.error(`${hostname} ${key} ${stderr}`);
      }

      continue;
    }

    if (oldMd5 !== value) {
      logger.info(`${hostname} ${key} is not up to date`);
      await ssh.putFile(resolve(path, key), `/etc/${type.toLowerCase()}/${key}`);

      if (type === 'Wireguard') {
        const { stderr } = await ssh.execCommand(
          `systemctl restart wg-quick@${basename(key, '.conf')}`,
        );
        stderr && logger.error(`${hostname} ${key} ${stderr}`);
      }
    }
  }

  for (const [key] of oldMap) {
    if (!visited.has(key)) {
      if (ignorePatterns.some(pattern => minimatch(key, pattern))) {
        logger.warn(`${hostname} ${key} is not exist in local but exist in remote`);
        continue;
      }

      const files = redundantFiles.get(ssh) || [];
      files.push({ hostname, key, type });
      redundantFiles.set(ssh, files);
    }
  }
};

const link = async (hostname: string, ip: string, port: number) => {
  const ssh = new NodeSSH();
  await ssh.connect({
    host: ip,
    port,
    username: 'root',
    agent,
    agentForward: true,
  });

  /* WireGuard */
  if (!argv.excludeWireguard) {
    const localWgPath = getWireguardConfigPath(hostname);
    const wgConfigMap = await getRemoteHash(ssh, '/etc/wireguard');
    const newWgConfigMap = await getLocalHash(localWgPath);

    await checkMap('Wireguard', hostname, wgConfigMap, newWgConfigMap, localWgPath, ssh);
  }

  /* Bird */
  if (!argv.excludeBird) {
    const localBirdPath = getBirdConfigPath(hostname);
    const birdConfigMap = await getRemoteHash(ssh, '/etc/bird');
    const newBirdConfigMap = await getLocalHash(localBirdPath);

    await checkMap('Bird', hostname, birdConfigMap, newBirdConfigMap, localBirdPath, ssh);

    const logger = log4js.getLogger('Bird');

    const { stderr } = await ssh.execCommand('birdc c');
    stderr && logger.error(`${hostname} ${stderr}`);
  }

  return redundantFiles.get(ssh) ? Promise.resolve() : ssh.dispose();
};

(async () => {
  await Promise.all(
    Object.entries(hosts).map(([key, host]) => {
      const { pubip, ssh_port = 22 } = host;
      return link(key, pubip, ssh_port).catch(error => {
        console.log(host, error.message);
      });
    }),
  );

  // Handle redundant files
  for (const [ssh, files] of redundantFiles.entries()) {
    let shouldReloadBird = false;

    for (const { hostname, key, type } of files) {
      const answer = await confirm({
        message: `${hostname} ${key} is not exist in local but exist in remote, delete?`,
        default: false,
      });
      if (answer) {
        await ssh.execCommand(`rm -rf /etc/${type.toLowerCase()}/${key}`);

        if (type === 'Wireguard') {
          const { stderr } = await ssh.execCommand(
            `systemctl disable --now wg-quick@${basename(key, '.conf')}`,
          );
          stderr && log4js.getLogger(type).error(`${hostname} ${key} ${stderr}`);
        }
        if (type === 'Bird' && answer) {
          shouldReloadBird = true;
        }
      }
    }

    if (shouldReloadBird) {
      const { stderr } = await ssh.execCommand('birdc c');
      stderr && log4js.getLogger('Bird').error(stderr);
    }

    await ssh.dispose();
  }
})();
