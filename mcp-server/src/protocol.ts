export const JSON_RPC_VERSION = '2.0';

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;
export const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type RequestId = string | number;

export type JsonRpcRequest = {
  jsonrpc: typeof JSON_RPC_VERSION;
  id: RequestId;
  method: string;
  params?: JsonValue;
};

export type JsonRpcNotification = {
  jsonrpc: typeof JSON_RPC_VERSION;
  method: string;
  params?: JsonValue;
};

export type JsonRpcErrorObject = {
  code: number;
  message: string;
  data?: JsonValue;
};

export type JsonRpcResponse = {
  jsonrpc: typeof JSON_RPC_VERSION;
  id: RequestId;
  result?: JsonValue;
  error?: JsonRpcErrorObject;
};

export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

export const ErrorCodes = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

export class JsonRpcError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: JsonValue,
  ) {
    super(message);
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isJsonRpcRequest = (value: unknown): value is JsonRpcRequest =>
  isRecord(value) &&
  value.jsonrpc === JSON_RPC_VERSION &&
  typeof value.method === 'string' &&
  (typeof value.id === 'string' || typeof value.id === 'number');

export const isJsonRpcNotification = (value: unknown): value is JsonRpcNotification =>
  isRecord(value) && value.jsonrpc === JSON_RPC_VERSION && typeof value.method === 'string' && value.id === undefined;

export const asObject = (value: unknown, message: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new JsonRpcError(ErrorCodes.invalidParams, message);
  }
  return value;
};

export const asString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new JsonRpcError(ErrorCodes.invalidParams, `Expected '${field}' to be a non-empty string`);
  }
  return value;
};

export const asOptionalString = (value: unknown, field: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return asString(value, field);
};

export const asOptionalBoolean = (value: unknown, field: string): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw new JsonRpcError(ErrorCodes.invalidParams, `Expected '${field}' to be a boolean`);
  }
  return value;
};

export const asOptionalNumber = (value: unknown, field: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new JsonRpcError(ErrorCodes.invalidParams, `Expected '${field}' to be a number`);
  }
  return value;
};

export const maybeStringArray = (value: unknown, field: string): string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new JsonRpcError(ErrorCodes.invalidParams, `Expected '${field}' to be an array of strings`);
  }
  return value;
};

export const toJsonError = (error: unknown): JsonRpcErrorObject => {
  if (error instanceof JsonRpcError) {
    return { code: error.code, message: error.message, data: error.data };
  }
  if (error instanceof Error) {
    return { code: ErrorCodes.internalError, message: error.message };
  }
  return { code: ErrorCodes.internalError, message: 'Unknown error' };
};
