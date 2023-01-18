import { promises as fs } from 'fs';
import { resolve } from 'path';
import { birdPeerFactory, Hosts, Config, wireguardFactory, iBGPCost, birdOspfBackboneFactory } from './utils';

const hosts = Hosts['routers']['children'];

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

  const buildPrivateIp = (ip: string) => {
    const prefix = '10.1.1.';
    const hostNumber = ip.split('.')[3];
    return `${prefix}${hostNumber}`;
  };

  return Promise.all(
    Object.keys(hosts).map(k => {
      if (k === host) return Promise.resolve();
      const name = `internal_${k.split('-')[0]}`;
      const remote = hosts[k];
      const remotePort = remote?.['wg_listening_ports']?.[host] ? remote['wg_listening_ports'][host] : current.wg_port;
      const listeningPort = current?.['wg_listening_ports']?.[k]
        ? current['wg_listening_ports'][k]
        : remote.wg_port;
      const obj = {
        desc: '',
        privateKey: Config['hosts'][host]['wg_prikey'],
        port: listeningPort,
        endPoint: `${remote['host']}:${remotePort}`,
        publicKey: remote.wg_pubkey,
        ownIp: buildPrivateIp(current.ownip),
        peerIp: buildPrivateIp(remote.ownip),
        ownnet: Config['global']['ownnet'],
        local_v6: current.link_local_ip6,
        isInternal: true
      };
      const output = wireguardFactory(obj);
      return fs.writeFile(`${basePath}/wireguard/${name}.conf`, output);
    })
  );
}

export function createIBirdConfig(host: string, basePath: string): Promise<void[]> {
  const workers: Promise<void>[] = [];

  const ospfArray = Object.keys(hosts)
    .filter(k => k !== host)
    .map(k => {
      const int = `internal_${k.split('-')[0]}`;
      const cost = ibgp[host][k];
      return { interface: int, cost };
    });

  const output = birdOspfBackboneFactory(ospfArray);

  workers.push(fs.copyFile(resolve(__dirname, '../templates/ospf.conf'), `${basePath}/bird/ospf.conf`));
  workers.push(fs.writeFile(`${basePath}/bird/ospf_backbone.conf`, output));

  return Promise.all([
    ...workers,
    ...Object.keys(hosts).map(k => {
      if (k === host) return Promise.resolve();
      const name = `internal_${k.split('-')[0]}`;
      const obj = {
        mp_bgp: true,
        ibgp: true,
        name,
        peer_v6_ula: hosts[k].ownip6,
        netName: name,
      };
      const output = birdPeerFactory(obj);
      return fs.writeFile(`${basePath}/bird/peers/${name}.conf`, output);
    })
  ]);
}
