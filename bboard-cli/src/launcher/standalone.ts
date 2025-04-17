import { createLogger } from '../logger-utils.js';
import path from 'node:path';
import { run } from '../index.js';
import { DockerComposeEnvironment, Wait } from 'testcontainers';
import { currentDir, StandaloneConfig } from '../config.js';

const config = new StandaloneConfig();
config.setNetworkId();
const dockerEnv = new DockerComposeEnvironment(path.resolve(currentDir, '..'), 'standalone.yml')
  .withWaitStrategy('proof-server', Wait.forLogMessage('Actix runtime found; starting in Actix runtime', 1))
  .withWaitStrategy('graphql-api', Wait.forLogMessage(/Transactions subscription started/, 1));
const logger = await createLogger(config.logDir);
await run(config, logger, dockerEnv);
