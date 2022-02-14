import { promises as fs } from 'fs';

import { Hosts, birdFactory } from './utils';

const hosts = Hosts['dn42routers']['children'];

export default async function createBaseConfig(host: string, basePath: string): Promise<unknown> {
  /* First create base dir */
  await Promise.all([
    fs.mkdir(`${basePath}/wireguard`, { recursive: true }),
    fs.mkdir(`${basePath}/bird/peers`, { recursive: true })
  ]);

  const obj = {
    ownip: hosts[host].ownip,
    ownip6: hosts[host].ownip6
  };
  const output = birdFactory(obj);
  /* Create base bird config */
  return fs.writeFile(`${basePath}/bird/bird.conf`, output);
}
