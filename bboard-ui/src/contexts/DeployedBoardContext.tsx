import React, { type PropsWithChildren, createContext } from 'react';
import { type DeployedBoardAPIProvider, BrowserDeployedBoardManager } from './BrowserDeployedBoardManager';
import { type Logger } from 'pino';

/**
 * Encapsulates a deployed boards provider as a context object.
 */
export const DeployedBoardContext = createContext<DeployedBoardAPIProvider | undefined>(undefined);

/**
 * The props required by the {@link DeployedBoardProvider} component.
 */
export type DeployedBoardProviderProps = PropsWithChildren<{
  /** The `pino` logger to use. */
  logger: Logger;
}>;

/**
 * A React component that sets a new {@link BrowserDeployedBoardManager} object as the currently
 * in-scope deployed board provider.
 */
export const DeployedBoardProvider: React.FC<Readonly<DeployedBoardProviderProps>> = ({ logger, children }) => (
  <DeployedBoardContext.Provider value={new BrowserDeployedBoardManager(logger)}>
    {children}
  </DeployedBoardContext.Provider>
);
