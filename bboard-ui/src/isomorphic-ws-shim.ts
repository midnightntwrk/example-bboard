// Shim for isomorphic-ws that provides both default and named WebSocket exports.
// The original browser.js only has a default export, causing Rolldown warnings
// when the SDK imports { WebSocket } from 'isomorphic-ws'.
const ws = globalThis.WebSocket;
export default ws;
export { ws as WebSocket };
