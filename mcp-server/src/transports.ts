import { Buffer } from 'node:buffer';
import { stdin, stdout } from 'node:process';
import { JsonRpcMessage } from './protocol.js';

const HEADER_DELIMITER = '\r\n\r\n';

export type McpConnection = {
  id: string;
  send: (message: JsonRpcMessage) => void;
};

export type McpTransport = {
  listen: (onMessage: (connection: McpConnection, message: JsonRpcMessage) => Promise<void>) => Promise<void>;
  close?: () => Promise<void>;
};

class FramedMessageReader {
  private buffer = Buffer.alloc(0);

  async push(chunk: Buffer, onMessage: (message: JsonRpcMessage) => Promise<void>): Promise<void> {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (true) {
      const headerEnd = this.buffer.indexOf(HEADER_DELIMITER);
      if (headerEnd === -1) {
        return;
      }

      const headerText = this.buffer.subarray(0, headerEnd).toString('utf8');
      const contentLengthLine = headerText
        .split('\r\n')
        .find((line) => line.toLowerCase().startsWith('content-length:'));

      if (!contentLengthLine) {
        throw new Error('Missing Content-Length header');
      }

      const contentLength = Number.parseInt(contentLengthLine.split(':')[1]?.trim() ?? '', 10);
      if (Number.isNaN(contentLength)) {
        throw new Error('Invalid Content-Length header');
      }

      const bodyStart = headerEnd + HEADER_DELIMITER.length;
      const bodyEnd = bodyStart + contentLength;

      if (this.buffer.length < bodyEnd) {
        return;
      }

      const body = this.buffer.subarray(bodyStart, bodyEnd).toString('utf8');
      this.buffer = this.buffer.subarray(bodyEnd);
      await onMessage(JSON.parse(body) as JsonRpcMessage);
    }
  }
}

const encodeMessage = (message: JsonRpcMessage): Buffer => {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.from(`Content-Length: ${body.length}${HEADER_DELIMITER}`, 'utf8');
  return Buffer.concat([header, body]);
};

export class StdioTransport implements McpTransport {
  private readonly reader = new FramedMessageReader();
  private readonly connection: McpConnection = {
    id: 'stdio',
    send: (message: JsonRpcMessage) => {
      stdout.write(encodeMessage(message));
    },
  };

  async listen(onMessage: (connection: McpConnection, message: JsonRpcMessage) => Promise<void>): Promise<void> {
    stdin.on('data', async (chunk: Buffer) => {
      await this.reader.push(chunk, async (message) => onMessage(this.connection, message));
    });
  }
}
