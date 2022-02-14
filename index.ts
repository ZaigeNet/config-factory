import { promises as fs, constants } from 'fs';
import { resolve } from 'path';
import { Config } from './utils/utils';
import createBaseConfig from './utils/base';
import { createBirdConfig, createWGConfig } from './utils/bgp';
import { createIBirdConfig, createIWGConfig } from './utils/ibgp';

const outputDir = resolve(__dirname, './dist');

const resolveHostDir = (path: string) => resolve(outputDir, path);

const checkFileExists = (file: string) => fs
  .access(file, constants.F_OK)
  .then(() => true)
  .catch(() => false);

(async () => {
  if (await checkFileExists(outputDir)) {
    await fs.rm(outputDir, { recursive: true });
  }

  const allHosts = Object.keys(Config.hosts);

  // create base dir
  await Promise.all(
    allHosts.map(host => {
      const basePath = resolveHostDir(host);
      return createBaseConfig(host, basePath);
    })
  );

  await Promise.all(
    allHosts.map(host => {
      const basePath = resolveHostDir(host);
      return Promise.all([
        createWGConfig(host, basePath),
        createBirdConfig(host, basePath),
        createIWGConfig(host, basePath),
        createIBirdConfig(host, basePath)
      ]);
    })
  );
})();
