# Development Hot Reload Issue

## Problem
After making code changes (especially to API routes or lib files), Next.js dev server sometimes shows internal server errors requiring a full restart. Error logs show:
```
ENOENT: no such file or directory, open '.next/routes-manifest.json'
React Client Manifest errors
```

## Root Cause
Next.js 15 has hot reload stability issues where the build cache (`.next` folder) gets corrupted during code changes, especially with:
- Server-side code changes (API routes, lib functions)
- TypeScript changes
- Complex imports

## Quick Workarounds

### Option 1: Clean Restart (Recommended)
```bash
pnpm dev:clean
```
This deletes `.next` and starts fresh.

### Option 2: Manual Clean
```bash
rm -rf .next
pnpm dev
```

### Option 3: Just Restart
Kill the dev server (Ctrl+C) and run `pnpm dev` again. Sometimes this is enough.

## What We've Already Tried
- Disabled webpack cache in dev mode (`next.config.js` line 78)
- This helps but doesn't fully solve the issue

## Long-term Solutions
1. **Upgrade Next.js** - Wait for Next.js 15.x patch with better hot reload stability
2. **Separate services** - Move heavy lib code (like audit functions) to separate service to reduce Next.js reload burden
3. **Use turbo mode** - Try `pnpm dev --turbo` (experimental)

## When to Clean Restart
Clean restart is needed when:
- Changing API route files (`app/api/**`)
- Changing lib files (`lib/**`)
- Adding/removing imports
- TypeScript errors persist after fix

Clean restart is NOT usually needed for:
- UI component changes (`components/**`, `app/**/page.tsx`)
- CSS/styling changes
- Content changes
