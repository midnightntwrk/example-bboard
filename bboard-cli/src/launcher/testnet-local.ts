import { createLogger } from '../logger-utils.js';
import { run } from '../index.js';
import { TestnetLocalConfig } from '../config.js';

const config = new TestnetLocalConfig();
config.setNetworkId();
const logger = await createLogger(config.logDir);
await run(config, logger);
