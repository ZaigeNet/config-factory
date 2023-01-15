export interface IPeerItem {
  name: string;
  asn: number;
  port: number;
  wg_remote: string;
  wg_pubkey: string;
  wg_presharedkey?: string;
  desc: string;
  peer_v4: string;
  peer_v6_ula?: string;
  peer_v6_linklocal?: string;
  local_v6?: string;
  mp_bgp: boolean;
  disabled: boolean;
}

export interface IPeers {
  peers: {
    [propName: string]: IPeerItem[];
  };
}

export interface IHosts {
  dn42routers: {
    children: {
      [propName: string]: {
        host: string;
        wg_pubkey: string;
        wg_port: number;
        ownip: string;
        ownip6: string;
        link_local_ip6: string;
        wg_listening_ports?: {
          [propName: string]: number;
        };
      };
    };
  };
}

export interface IConfig {
  global: {
    ownas: string;
    ownnet: string;
    ownnet6: string;
    default_local_v6: string;
    ssh_agent?: string;
  };
  hosts: {
    [propName: string]: {
      wg_prikey: string;
      pubip: string;
      ssh_port?: number;
    };
  };
}

export interface Options {
  excludeWireguard: boolean;
  excludeBird: boolean;
  excludeExternalConfig: boolean;
  excludeInternalConfig: boolean;
}
