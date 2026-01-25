# BBoard Preview Network Migration

Quick reference for migrating BBoard to Midnight's Preview network.

## 🚀 Quick Start
```bash
# 1. Clone and setup
git clone https://github.com/midnightntwrk/example-bboard.git
cd example-bboard
git checkout -b preview-migration
npm install

# 2. Update compact-runtime
npm install @midnight-ntwrk/compact-runtime@^0.9.0

# 3. Compile contract
cd contract && npm run compact && npm run build && cd ..

# 4. Build CLI
cd bboard-cli && npm run build && cd ..

# 5. Start proof server
docker run -d -p 6300:6300 --name preview-proof-server \
  midnightnetwork/proof-server:6.1.0-alpha.6 \
  -- midnight-proof-server --network preview

# 6. Run on Preview
cd bboard-cli
node --loader ts-node/esm src/launcher/preview.ts
```

## 📍 Preview Network Endpoints
```typescript
indexer: 'https://indexer.preview.midnight.network/api/v3/graphql'
indexerWS: 'wss://indexer.preview.midnight.network/api/v3/graphql'
node: 'https://rpc.preview.midnight.network'
proofServer: 'http://localhost:6300'
```

## ✅ What Works

- ✅ Preview configuration added
- ✅ Contract compilation (Compact v0.16+)
- ✅ CLI builds successfully
- ✅ Wallet creation works
- ✅ Proof server integration

## ⚠️ Known Issues

- Connection timeout to Preview indexer (under investigation)
- May require full v3.0.0 migration for complete compatibility

## 📚 Full Documentation

See [PREVIEW_MIGRATION_GUIDE.md](./PREVIEW_MIGRATION_GUIDE.md) for complete details.

## 🎯 Related

- **Bounty**: https://github.com/midnightntwrk/contributor-hub/issues/248
- **Migration Guide**: https://github.com/midnightntwrk/midnight-docs/pull/501
- **Author**: TMT (@834henry)
