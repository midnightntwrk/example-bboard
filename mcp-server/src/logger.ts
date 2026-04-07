import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import pino from 'pino';

export const createMcpLogger = async (logPath: string): Promise<pino.Logger> => {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const destination = pino.destination({ dest: logPath, sync: true });
  return pino(
    {
      level: process.env.DEBUG_LEVEL && process.env.DEBUG_LEVEL !== '' ? process.env.DEBUG_LEVEL : 'info',
      base: undefined,
      depthLimit: 20,
    },
    destination,
  );
};
