import { promises as fs } from 'node:fs';

import { Hosts, birdFactory } from './utils';
import type { Options } from '../types';

const hosts = Hosts.routers.children;

export default async function createBaseConfig(
  host: string,
  basePath: string,
  options: Options,
): Promise<unknown> {
  const { excludeWireguard, excludeBird } = options;
  /* First create base dir */
  await Promise.all([
    !excludeWireguard && fs.mkdir(`${basePath}/wireguard`, { recursive: true }),
    !excludeBird && fs.mkdir(`${basePath}/bird/peers`, { recursive: true }),
  ]);

  /* Create base bird config */
  return (
    !excludeBird &&
    fs.writeFile(
      `${basePath}/bird/bird.conf`,
      birdFactory({
        ownip: hosts[host].ownip,
        ownip6: hosts[host].ownip6,
      }),
    )
  );
}
