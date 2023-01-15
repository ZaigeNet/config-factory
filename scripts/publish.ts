import { NodeSSH } from 'node-ssh';
import { basename, relative, resolve } from 'path';
import { Config } from '../utils/utils';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import log4js from 'log4js';

const agent = Config['global']['ssh_agent'];
const hosts = Config['hosts'];

log4js.configure({
  appenders: {
    out: { type: 'stdout' }
  },
  categories: {
    default: { appenders: ['out'], level: 'info' }
  }
});

const getWireguardConfigPath = (hostname: string) => resolve(__dirname, `../dist/${hostname}/wireguard`);
const getBirdConfigPath = (hostname: string) => resolve(__dirname, `../dist/${hostname}/bird`);

const getRemoteHash = async (ssh: NodeSSH, dir: string) => {
  const map = new Map<string, string>();
  const result = await ssh.execCommand(`find ${dir} -type f | xargs md5sum`);
  result.stdout
    .split('\n')
    .filter(item => item.endsWith('.conf'))
    .map(item => {
      const [md5, path] = item.split('  ');
      const fileName = relative(dir, path);
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

        const fileName = relative(dir, path);
        const md5 = crypto
          .createHash('md5')
          .update(await fs.readFile(path, 'utf-8'))
          .digest('hex');
        map.set(fileName, md5);
      })
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
  ssh: NodeSSH
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
        const { stderr } = await ssh.execCommand(`systemctl enable --now wg-quick@${basename(key, '.conf')}`);
        stderr && logger.error(`${hostname} ${key} ${stderr}`);
      }

      continue;
    }

    if (oldMd5 !== value) {
      logger.info(`${hostname} ${key} is not up to date`);
      await ssh.putFile(resolve(path, key), `/etc/${type.toLowerCase()}/${key}`);

      if (type === 'Wireguard') {
        const { stderr } = await ssh.execCommand(`systemctl restart wg-quick@${basename(key, '.conf')}`);
        stderr && logger.error(`${hostname} ${key} ${stderr}`);
      }
    }
  }

  for (const [key] of oldMap) {
    if (!visited.has(key)) {
      logger.warn(`${hostname} ${key} is not exist in local but exist in remote`);
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
    agentForward: true
  });

  /* WireGuard */
  const localWgPath = getWireguardConfigPath(hostname);
  const wgConfigMap = await getRemoteHash(ssh, '/etc/wireguard');
  const newWgConfigMap = await getLocalHash(localWgPath);

  await checkMap('Wireguard', hostname, wgConfigMap, newWgConfigMap, localWgPath, ssh);

  /* Bird */
  const localBirdPath = getBirdConfigPath(hostname);
  const birdConfigMap = await getRemoteHash(ssh, '/etc/bird');
  const newBirdConfigMap = await getLocalHash(localBirdPath);

  await checkMap('Bird', hostname, birdConfigMap, newBirdConfigMap, localBirdPath, ssh);

  const logger = log4js.getLogger('Bird');

  const { stderr } = await ssh.execCommand('birdc c');
  stderr && logger.error(`${hostname} ${stderr}`);

  return ssh.dispose();
};

(async () => {
  await Promise.all(
    Object.entries(hosts).map(([key, host]) => {
      const { pubip, ssh_port = 22 } = host;
      return link(key, pubip, ssh_port);
    })
  );
})();
