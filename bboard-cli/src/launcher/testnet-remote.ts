// This file is part of midnightntwrk/example-counter.
// Copyright (C) 2025 Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

import { createLogger } from '../logger-utils.js';
import { run } from '../index.js';
import { TestnetRemoteConfig } from '../config.js';

try {
  const config = new TestnetRemoteConfig();
  config.setNetworkId();
  const logger = await createLogger(config.logDir);
  await run(config, logger);
} catch (error) {
  console.error('Caught error:', error);
  console.error('Error type:', typeof error);
  console.error('Error constructor:', error?.constructor?.name);
  if (error instanceof Error) {
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
  throw error;
}
