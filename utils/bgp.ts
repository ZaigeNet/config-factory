import { promises as fs } from 'fs';
import {
  Peers, Hosts, Config, wireguardFactory, birdPeerFactory
} from './utils';

const hosts = Hosts['dn42routers']['children'];
const { peers } = Peers;

// Factory Wireguard
export async function createWGConfig(host: string, basePath: string): Promise<unknown> {
  const hostPeers = peers[host];
  if (!hostPeers) return Promise.resolve();
  return Promise.all(
    hostPeers.map(peer => {
      const obj = {
        desc: peer.desc,
        privateKey: Config['hosts'][host]['wg_prikey'],
        publicKey: peer['wg_pubkey'],
        presharedKey: peer['wg_presharedkey'],
        port: peer.port,
        ownIp: hosts[host]['ownip'],
        peerIp: peer['peer_v4'],
        endPoint: peer['wg_remote'],
        local_v6: peer['local_v6']
      };
      const output = wireguardFactory(obj);
      const netName = `dn${peer.asn.toString().slice(-4)}.conf`;
      return fs.writeFile(`${basePath}/wireguard/${netName}`, output);
    })
  );
}

/* bird/peers/*.conf */
export async function createBirdConfig(host: string, basePath: string): Promise<unknown> {
  const hostPeers = peers[host];
  if (!hostPeers) return Promise.resolve();
  return Promise.all(
    hostPeers.map(peer => {
      if (peer.disabled) return Promise.resolve();
      const netName = `dn${peer.asn.toString().slice(-4)}`;
      const obj = {
        ...peer,
        ibgp: false,
        netName
      };
      const output = birdPeerFactory(obj);
      return fs.writeFile(`${basePath}/bird/peers/${peer.name}.conf`, output);
    })
  );
}
