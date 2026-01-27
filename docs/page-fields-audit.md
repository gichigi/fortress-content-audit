# Page/URL Fields Audit

## How the Audit Works

1. **Puppeteer** crawls homepage, extracts all internal links
2. **`countInternalPages()`** dedupes links → stored as `pages_found` (count)
3. **`extractDiscoveredPagesList()`** returns the URL array → stored as `discoveredPages`
4. Link list passed to model in prompt
5. **Model audits** homepage + N pages (free=2, pro=up to 20)
6. Model returns `pages_audited` in JSON response (self-reported count)

---

## Field Inventory (After Cleanup)

### Active Fields

| Field | Type | Location | What it is |
|-------|------|----------|------------|
| `pages_found` | int | DB column | Count of internal links found by Puppeteer |
| `pages_audited` | int | DB column | Model's self-reported count of pages audited |
| `discoveredPages` | string[] | `issues_json` | Array of all internal URLs found by Puppeteer |

### Deprecated Fields

| Field | Type | Status | Notes |
|-------|------|--------|-------|
| `auditedUrls` | string[] | Deprecated | Unreliable - just tool call URLs, not what model audited. Kept for backward compatibility but marked deprecated in code. |
| `pages_found_urls` | jsonb | **DROPPED** | Migration 025 removed this unused column |

---

## API Response Format

```typescript
{
  runId: string,
  domain: string,
  status: 'pending' | 'completed' | 'failed',
  issues: Issue[],
  totalIssues: number,
  meta: {
    pagesAudited: number,      // Model's self-reported count
    pagesFound: number | null, // Puppeteer's count of internal links
    discoveredPages: string[], // Puppeteer's list of internal URLs
    createdAt: string,
    auditedUrls: string[],     // DEPRECATED - unreliable
  }
}
```

---

## Data Flow

```
Puppeteer crawls homepage
    ↓
extractElementManifest() → manifests[]
    ↓
countInternalPages(manifests) → pages_found (count) → DB column
extractDiscoveredPagesList(manifests) → discoveredPages (array) → issues_json
    ↓
formatManifestForPrompt(manifests) → text passed to model
    ↓
Model audits pages, returns pages_audited in response
    ↓
API returns both in meta: { pagesFound, pagesAudited, discoveredPages }
```

---

## Changes Made (2026-01-25)

1. ✅ Fixed `discoveredPages` - now populated by calling `extractDiscoveredPagesList()`
2. ✅ Added `discoveredPages` to `AuditResult` type
3. ✅ Fixed API response - `discoveredPages` now included when issues exist
4. ✅ Marked `auditedUrls` as deprecated in code comments
5. ✅ Dropped unused `pages_found_urls` DB column (migration 025)
