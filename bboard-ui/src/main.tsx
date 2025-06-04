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

logger.trace('networkId = ', networkId);

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
