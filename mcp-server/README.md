# Bulletin Board MCP Server

This package exposes the bulletin board contract as an MCP server over `stdio`.

It can also run in HTTP mode for environments where network access is easier than child-process stdio wiring.

The proof server is consumed locally by the MCP server. Agents do not need to call it directly.

Sensitive admin data policy:

- the server never returns `adminSecret`
- the server never returns `adminPubKey`

## What it gives you

- MCP `tools` for session creation, wallet preparation, board deployment/join, reads, and mutations
- MCP `resources` with agent-facing instructions
- A reusable session pattern that separates wallet credentials from contract witness credentials

Current tools:

- `bboard_create_session`
- `bboard_get_session`
- `bboard_set_admin_secret`
- `bboard_wait_for_wallet_ready`
- `bboard_deploy_board`
- `bboard_join_board`
- `bboard_get_board_state`
- `bboard_submit_post`
- `bboard_withdraw_pending`
- `bboard_approve_pending`
- `bboard_reject_pending`
- `bboard_unpublish_published`
- `bboard_close_session`

## Run locally

From the repo root:

```bash
cd mcp-server
npm run build
npm run start
```

For development:

```bash
cd mcp-server
npm run start:dev
```

## HTTP Mode

Start the server in HTTP mode:

```bash
cd mcp-server
npm run build
npm run start:http
```

Default bind:

```text
http://127.0.0.1:8787
```

Endpoints:

- `GET /health`
- `POST /mcp`

Example health check:

```bash
curl http://127.0.0.1:8787/health
```

Example JSON-RPC call:

```bash
curl -X POST http://127.0.0.1:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Notes:

- HTTP mode currently uses request/response JSON-RPC over HTTP.
- It is practical for local agents and reverse proxies.
- If you need HTTPS, place it behind a reverse proxy such as Caddy, Nginx, or Traefik.

## Proof Server Handling

By default, the MCP server assumes a local proof server at:

```text
http://127.0.0.1:6300
```

You can override it with:

```bash
BBOARD_PROOF_SERVER_URL=http://127.0.0.1:6300
```

You can also ask the MCP server to start the local Docker proof server automatically:

```bash
cd mcp-server
npm run build
npm run start:http:auto-proof
```

Equivalent manual flags:

```bash
node --experimental-specifier-resolution=node ./dist/mcp-server/src/index.js \
  --http \
  --host 127.0.0.1 \
  --port 8787 \
  --start-proof-server
```

Optional shutdown of the Docker proof server when the MCP exits:

```bash
node --experimental-specifier-resolution=node ./dist/mcp-server/src/index.js \
  --http \
  --start-proof-server \
  --stop-proof-server-on-exit
```

## Example client config

Point your MCP client at:

```bash
node --experimental-specifier-resolution=node /mnt/linuxdata/example-bboard/mcp-server/dist/mcp-server/src/index.js
```

If your client can run workspace scripts directly, this also works:

```bash
npm --workspace /mnt/linuxdata/example-bboard/mcp-server run start
```

`stdio` remains the default mode.

## Template notes

The generic pattern lives in:

- `src/stdio.ts`: stdio transport with MCP framing
- `src/transports.ts`: stdio transport
- `src/index.ts`: transport selection and HTTP server bootstrap
- `src/server.ts`: MCP method handling and tool/resource registration
- `src/session-manager.ts`: app-specific wallet, session, and tool logic

For a similar project, you will usually replace only `session-manager.ts` plus the tool/resource definitions in `server.ts`.
