// Preview Network Launcher
import { createLogger } from '../logger-utils.js';
import { run } from '../index.js';
import { PreviewConfig } from '../config.js';

const config = new PreviewConfig();
config.setNetworkId();
const logger = await createLogger(config.logDir);
await run(config, logger);
