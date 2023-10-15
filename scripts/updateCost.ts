import log4js from 'log4js';
import { NodeSSH } from 'node-ssh';
import { resolve } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { promises as fs } from 'fs';
import { Config, Hosts } from '../utils/utils';

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

const argv = yargs(hideBin(process.argv))
  .option('out', {
    alias: 'o',
    type: 'string',
    default: resolve(__dirname, '../configs/cost.json'),
    description: 'Skip wireguard config publishing'
  })
  .option('dry-run', {
    type: 'boolean',
    default: false,
    description: 'Skip bird config publishing'
  })
  .parseSync();

const preTag = new Map<string, Array<string>>();
const result: Array<[string, string, number]> = [];

async function ping(hostname: string, ip: string, port: number) {
  const ssh = new NodeSSH();
  await ssh.connect({
    host: ip,
    port,
    username: 'root',
    agent,
    agentForward: true
  });

  const tags = preTag.get(hostname)!;

  await Promise.all(
    tags.map(async key => {
      const host = Hosts.routers.children[key]!;
      const { host: endPoint } = host;
      // https://stackoverflow.com/a/9634982
      const { stdout } = await ssh.execCommand(`ping -c 5 ${endPoint} | tail -1 | awk '{print $4}' | cut -d '/' -f 2`);
      const rtt = Math.round(Number(stdout));
      result.push([hostname, key, rtt]);
    })
  );

  return ssh.dispose();
}

(async () => {
  const keys = Object.keys(hosts);

  for (const key of keys) {
    preTag.set(key, []);
  }

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const key1 = keys[i];
      const key2 = keys[j];
      preTag.get(key1)!.push(key2);
    }
  }

  await Promise.all(
    Object.entries(hosts).map(([key, host]) => {
      const { pubip, ssh_port = 22 } = host;
      return ping(key, pubip, ssh_port).catch(error => {
        console.log(host, error.message);
      });
    })
  );

  result.sort((x, y) => {
    const t = keys.indexOf(x[0]) - keys.indexOf(y[0]);
    return t || keys.indexOf(x[1]) - keys.indexOf(y[1]);
  });

  const resultStr = JSON.stringify(result, null, 2);
  console.log(resultStr);

  if (!argv.dryRun) {
    await fs.writeFile(argv.out, resultStr, 'utf-8');
    console.log(`Cost file has been updated to ${argv.out}`);
  }
})();
