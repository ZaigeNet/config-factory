import { promises as fs, constants } from 'fs';
import { resolve } from 'path';
import { Config } from './utils/utils';
import createBaseConfig from './utils/base';
import { createBirdConfig, createWGConfig } from './utils/bgp';
import { createIBirdConfig, createIWGConfig } from './utils/ibgp';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const _argv = yargs(hideBin(process.argv))
  .option('exclude-wireguard', {
    type: 'boolean',
    default: false,
    description: 'Skip wireguard config generation'
  })
  .option('exclude-bird', {
    type: 'boolean',
    default: false,
    description: 'Skip bird config generation'
  })
  .option('exclude-internal-config', {
    type: 'boolean',
    default: false,
    description: 'Skip internal config generation'
  })
  .option('exclude-external-config', {
    type: 'boolean',
    default: false,
    description: 'Skip external config generation'
  })
  .option('delete', {
    type: 'boolean',
    default: true,
    description: 'Delete existing config files'
  })
  .parse();

const outputDir = resolve(__dirname, './dist');

const resolveHostDir = (path: string) => resolve(outputDir, path);

const checkFileExists = (file: string) =>
  fs
    .access(file, constants.F_OK)
    .then(() => true)
    .catch(() => false);

(async () => {
  const argv = _argv instanceof Promise ? await _argv : _argv;

  if (argv['delete'] && (await checkFileExists(outputDir))) {
    await fs.rm(outputDir, { recursive: true });
  }

  const allHosts = Object.keys(Config.hosts);

  // create base dir
  await Promise.all(
    allHosts.map(host => {
      const basePath = resolveHostDir(host);
      return createBaseConfig(host, basePath, argv);
    })
  );

  await Promise.all(
    allHosts.map(host => {
      const basePath = resolveHostDir(host);
      return Promise.all([
        ...(argv['excludeWireguard']
          ? []
          : [
              !argv['excludeInternalConfig'] && createIWGConfig(host, basePath),
              !argv['excludeExternalConfig'] && createWGConfig(host, basePath)
            ]),
        ...(argv['excludeBird']
          ? []
          : [
              !argv['excludeInternalConfig'] && createIBirdConfig(host, basePath),
              !argv['excludeExternalConfig'] && createBirdConfig(host, basePath)
            ])
      ]);
    })
  );
})();
