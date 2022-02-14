import { promises as fs } from 'fs';
import { resolve } from 'path';
import {
  birdPeerFactory, Hosts, Config, wireguardFactory, iBGPCost
} from './utils';

const hosts = Hosts['dn42routers']['children'];

/* Build iBGP Cost */
const ibgp: Record<string, Record<string, number>> = {};

const addEdge = (x: string, y: string, value: number) => {
  ibgp[x] = ibgp[x] ? { ...ibgp[x], [y]: value } : { [y]: value };
};

for (const host of iBGPCost) {
  const [i, j, v] = host;
  addEdge(i, j, v);
  addEdge(j, i, v);
}

export async function createIWGConfig(host: string, basePath: string): Promise<void[]> {
  const current = hosts[host];
  const port = Config.global.ownas.toString().slice(-5);
  return Promise.all(
    Object.keys(hosts).map(remoteHost => {
      const name = `internal_${remoteHost.split('-')[0]}`;
      const remote = hosts[remoteHost];
      const obj = {
        desc: '',
        privateKey: Config['hosts'][host]['wg_prikey'],
        port,
        endPoint: `${remote['host']}:${port}`,
        publicKey: remote.wg_pubkey,
        ownIp: `${current.ownip}/27`,
        ownnet: Config['global']['ownnet'],
        local_v6: current.link_local_ip6
      };
      const output = wireguardFactory(obj);
      return fs.writeFile(`${basePath}/wireguard/${name}.conf`, output);
    })
  );
}

export function createIBirdConfig(host: string, basePath: string): Promise<void[]> {
  const workers: Promise<void>[] = [];
  /*
    @ Note: ospf.conf OSPF is not used
    Temporarily we have a full mesh between all routers.
  */
  workers.push(fs.copyFile(resolve(__dirname, '../templates/ospf.conf'), `${basePath}/bird/ospf.conf`));
  workers.push(
    fs.copyFile(resolve(__dirname, '../templates/ospf_backbone.conf'), `${basePath}/bird/ospf_backbone.conf`)
  );

  return Promise.all([
    ...workers,
    ...Object.keys(hosts).map(k => {
      if (k === host) return Promise.resolve();
      const name = `internal_${k.split('-')[0]}`;
      const obj = {
        mp_bgp: true,
        ibgp: true,
        name,
        peer_v6: hosts[k].link_local_ip6.slice(0, -3),
        netName: name,
        cost: ibgp[host][k]
      };
      const output = birdPeerFactory(obj);
      return fs.writeFile(`${basePath}/bird/peers/${name}.conf`, output);
    })
  ]);
}
