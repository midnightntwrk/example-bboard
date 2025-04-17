import { useContext } from 'react';
import { DeployedBoardContext, type DeployedBoardAPIProvider } from '../contexts';

/**
 * Retrieves the currently in-scope deployed boards provider.
 *
 * @returns The currently in-scope {@link DeployedBBoardAPIProvider} implementation.
 *
 * @internal
 */
export const useDeployedBoardContext = (): DeployedBoardAPIProvider => {
  const context = useContext(DeployedBoardContext);

  if (!context) {
    throw new Error('A <DeployedBoardProvider /> is required.');
  }

  return context;
};
