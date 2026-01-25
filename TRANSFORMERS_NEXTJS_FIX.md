# Transformers.js Configuration for Next.js

## Issue
transformers.js requires specific Next.js configuration to work properly in the browser.

## Solution Applied

### 1. Updated `next.config.mjs`
- Configured webpack to handle ONNX runtime
- Set up proper fallbacks for Node.js modules
- Added environment variables for model caching
- Enabled ESM externals support

### 2. Restart Required
After updating Next.js config, you **must restart the dev server**:

```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
```

### 3. First Run Behavior
- Model downloads (~33MB for BGE)
- Stored in `.cache/transformers/`
- Takes 30-60 seconds first time
- Subsequent runs load from cache (<1s)

## Verification

After restart, check browser console for:
```
✅ Local embedding model initialized (BAAI/bge-small-en-v1.5)
```

## Troubleshooting

### Still getting errors?
1. Clear Next.js cache:
```bash
rm -rf .next
npm run dev
```

2. Clear transformers cache:
```bash
rm -rf .cache/transformers
```

3. Reinstall if needed:
```bash
npm install @xenova/transformers
```

## Alternative: Disable Auto-Embedding

If issues persist, you can temporarily disable auto-embedding:

**In `lib/storage.ts`**, comment out the embedding queue calls:

```typescript
// Temporarily disable auto-embedding
// import('./embedding-worker').then(...)
```

Then manually trigger embedding later when ready.
