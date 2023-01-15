import path from 'path';

import fs from 'fs';
import yaml from 'js-yaml';
import ejs from 'ejs';
import { IPeers, IHosts, IConfig } from '../types';

const Resolve = (p: string) => path.resolve(__dirname, p);

export const Peers = yaml.load(fs.readFileSync(Resolve('../configs/peers.yml'), 'utf-8')) as IPeers;

export const Hosts = yaml.load(fs.readFileSync(Resolve('../configs/hosts.yml'), 'utf-8')) as IHosts;

export const Config = yaml.load(fs.readFileSync(Resolve('../configs/config.yml'), 'utf-8')) as IConfig;

export const iBGPCost = require('../configs/cost.json');

const wireguardTemplate = fs.readFileSync(Resolve('../templates/wireguard.ejs'), 'utf-8');

const birdTemplate = fs.readFileSync(Resolve('../templates/bird.ejs'), 'utf-8');

const birdPeerTemplate = fs.readFileSync(Resolve('../templates/bird_peer.ejs'), 'utf-8');

const birdOspfBackboneTemplate = fs.readFileSync(Resolve('../templates/ospf_backbone.ejs'), 'utf-8');

export function wireguardFactory(obj: Record<any, any>) {
  const local_v6 = obj.local_v6 ? obj.local_v6 : Config.global.default_local_v6;
  return ejs.render(wireguardTemplate, {
    isInternal: false,
    ...obj,
    local_v6
  });
}

export function birdPeerFactory(obj: Record<any, any>) {
  return ejs.render(birdPeerTemplate, obj);
}

export function birdFactory(obj: Record<any, any>) {
  return ejs.render(birdTemplate, {
    ...obj,
    ...Config.global
  });
}

export function birdOspfBackboneFactory(arr: Array<any>) {
  return ejs.render(birdOspfBackboneTemplate, { internals: arr });
}
