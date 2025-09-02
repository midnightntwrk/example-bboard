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

/**
 * A Single Page Application (SPA) for connecting to and managing deployed
 * bulletin boards.
 *
 * @packageDocumentation
 */
import './globals';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material';
import { setNetworkId, NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import App from './App';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './config/theme';
import '@midnight-ntwrk/dapp-connector-api';
import * as pino from 'pino';
import { DeployedBoardProvider } from './contexts';

const networkId = import.meta.env.VITE_NETWORK_ID as NetworkId;
// contract address: 0200dbf964f541e1950883f5b2f539b66fd6111e46ce8e6e9551fbdd180114d5dd5b
// Ensure that the network IDs are set within the Midnight libraries.
setNetworkId(networkId);

// Create a default `pino` logger and configure it with the configured logging level.
export const logger = pino.pino({
  level: import.meta.env.VITE_LOGGING_LEVEL as string,
});

logger.trace(`networkId = ${networkId}`);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <CssBaseline />
    <ThemeProvider theme={theme}>
      <DeployedBoardProvider logger={logger}>
        <App />
      </DeployedBoardProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
