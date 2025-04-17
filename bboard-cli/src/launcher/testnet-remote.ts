import { createLogger } from '../logger-utils.js';
import { run } from '../index.js';
import { TestnetRemoteConfig } from '../config.js';

const config = new TestnetRemoteConfig();
config.setNetworkId();
const logger = await createLogger(config.logDir);
await run(config, logger);
