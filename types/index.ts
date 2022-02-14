interface IPeerItem {
  name: string;
  asn: number;
  port: number;
  wg_remote: string;
  wg_pubkey: string;
  desc: string;
  peer_v4: string;
  peer_v6: string;
  local_v6?: string;
  mp_bgp: boolean;
  disabled: boolean;
}

interface IPeers {
  peers: {
    [propName: string]: IPeerItem[]
  }
}

interface IHosts {
  dn42routers: {
    children: {
      [propName: string]: {
        host: string;
        wg_pubkey: string;
        ownip: string;
        ownip6: string;
        link_local_ip6: string;
      }
    }
  }
}

interface IConfig {
  global: {
    ownas: string;
    ownnet: string;
    ownnet6: string;
    default_local_v6: string;
  }
  hosts: {
    [propName: string]: {
      wg_prikey: string;
      wg_remote: string;
    }
  }
}
