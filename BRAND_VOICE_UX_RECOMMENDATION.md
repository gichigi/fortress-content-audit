# Brand Voice UX/UI Recommendation

## Current Problems

### 1. Conflation of Concerns
- "Brand voice" mixes multiple distinct features:
  - Content quality checks (readability, formality, locale)
  - Keyword detection (flag/ignore lists)
  - Brand voice guidelines (the actual document)
  - AI writing detection
  - Audit scope settings

### 2. Unclear Hierarchy
- Settings grouped by UI pattern (toggles, dropdowns) not by user intent
- Unclear what requires brand voice guidelines vs standalone checks
- Master "enabled" toggle is too coarse-grained

### 3. Navigation Issues
- "Brand Voice" sidebar label is too broad
- No visual distinction between setting categories
- Hard to understand what each setting does

---

## Recommended Structure

### Conceptual Model: 3 Distinct Features

```
Domain Settings
├── 1. Content Quality Checks (Always available)
│   ├── Writing Standards
│   │   ├── Readability level
│   │   ├── Formality level
│   │   └── English variant
│   ├── Keyword Rules
│   │   ├── Flag keywords
│   │   └── Ignore keywords
│   └── AI Detection
│       └── Flag AI writing patterns
│
├── 2. Brand Voice Guidelines (Optional enhancement)
│   ├── Enable/disable toggle
│   ├── Guidelines document (manual or generated)
│   └── Generate from site
│
└── 3. Audit Scope (Global setting)
    └── Include blog/article pages
```

---

## Recommended UI Structure

### Navigation: Split Into Logical Groups

**Sidebar per domain:**
```
example.com
├── Content Checks    ← Rename from "Brand Voice"
├── Guidelines        ← New, separate
└── Audit Settings    ← New
```

### Page Layouts

#### 1. Audit options (`/dashboard/audit-options?domain=example.com`)

**Purpose:** Configure what to check during audits

**Layout:**
```
Content Checks
──────────────
example.com

┌─ Writing Standards ────────────────────────┐
│ Always checked during audits               │
│                                            │
│ Readability:  [Grade 6-8 ▼]               │
│ Formality:    [Casual ▼]                  │
│ English:      [US English ▼]              │
└────────────────────────────────────────────┘

┌─ Keyword Rules ────────────────────────────┐
│ Flag specific terms in content            │
│                                            │
│ ○ Flag keywords              [Enable ⚪]  │
│   ├─ Terms to call out (e.g. old product) │
│   └─ [+ Add keyword]                       │
│                                            │
│ ○ Ignore keywords            [Enable ⚪]  │
│   ├─ Terms to allow (e.g. known variants) │
│   └─ [+ Add keyword]                       │
└────────────────────────────────────────────┘

┌─ AI Writing Detection ─────────────────────┐
│ Flag likely AI-generated content          │
│                                            │
│ ○ Flag AI patterns           [Enable ⚪]  │
│   └─ Flags when multiple patterns appear  │
└────────────────────────────────────────────┘

[Save Changes]
```

**Key improvements:**
- Clear hierarchy: Standards → Rules → Detection
- Each section has purpose/context
- Toggles only where truly optional
- Flat structure (no tabs)

---

#### 2. Guidelines (`/dashboard/guidelines?domain=example.com`)

**Purpose:** Define and manage brand voice guidelines

**Layout:**
```
Guidelines
──────────
example.com

┌─ Brand Voice Guidelines ────────────────────┐
│ Custom rules for your brand's voice & tone  │
│                                              │
│ ⚪ Enable brand voice checks                 │
│                                              │
│ [Collapsed when disabled]                    │
└──────────────────────────────────────────────┘

[When enabled:]

┌─ Brand Voice Document ──────────────────────┐
│                                              │
│ [Rich text editor]                           │
│ Write or generate guidelines for:            │
│ • Voice characteristics                      │
│ • Tone preferences                           │
│ • Do's and don'ts                           │
│ • Example phrases                            │
│                                              │
└──────────────────────────────────────────────┘

ℹ️ These guidelines will be checked against your
   content during audits when enabled.

[Save] [Generate from Site]

──────────────────────────────────────────────

Generated 2 hours ago from 5 pages
[View source pages]
```

**Key improvements:**
- Focused: Only about brand voice guidelines
- Clear enable/disable with context
- Generation metadata visible but not intrusive
- Separate from other checks

---

#### 3. Audit Settings (`/dashboard/audit-settings?domain=example.com`)

**Purpose:** Configure how audits run

**Layout:**
```
Audit Settings
──────────────
example.com

┌─ Audit Scope ──────────────────────────────┐
│ What pages to include in audits            │
│                                            │
│ ○ Include blog/article pages [Enable ⚪]  │
│   └─ Adds /blog, /articles, etc.          │
│      Takes longer, audits more pages      │
└────────────────────────────────────────────┘

┌─ Scheduled Audits ─────────────────────────┐
│ Automatic audit frequency                  │
│                                            │
│ ○ Auto-audit              [Enable ⚪]      │
│   ├─ Frequency: [Weekly ▼]                │
│   └─ Next audit: Tomorrow at 9am          │
└────────────────────────────────────────────┘

[Save Changes]
```

**Key improvements:**
- Scope settings separate from content checks
- Room for future audit-related settings
- Clear that these affect how audits run, not what they check

---

## Database Changes

### Separate Tables (Recommended)

```sql
-- 1. Content quality checks (always available)
content_check_settings {
  user_id, domain,
  readability_level,
  formality,
  locale,
  flag_keywords[],
  ignore_keywords[],
  flag_ai_writing
}

-- 2. Brand voice guidelines (optional feature)
brand_voice_guidelines {
  user_id, domain,
  enabled,
  guidelines_text,
  source: 'manual' | 'generated',
  generated_from_pages[],
  generated_at
}

-- 3. Audit configuration (global settings)
audit_settings {
  user_id, domain,
  include_longform,
  schedule_enabled,
  schedule_frequency
}
```

### OR: Single Table with Clear Naming (Simpler Migration)

```sql
domain_settings {
  user_id, domain,

  -- Content checks (always on)
  readability_level,
  formality,
  locale,
  flag_keywords[],
  ignore_keywords[],
  flag_ai_writing,

  -- Brand voice (optional)
  brand_voice_enabled,
  brand_voice_guidelines,
  brand_voice_source,
  brand_voice_generated_at,

  -- Audit config
  include_longform_in_audits
}
```

---

## Implementation Priority

### Phase 1: Reorganize UI (No DB changes)
- Split current page into 3 routes
- Update sidebar navigation
- Clearer labeling and grouping
- **Quick win, big clarity improvement**

### Phase 2: Refine Settings Model
- Separate content checks from brand voice
- Make brand voice truly optional
- Clear master toggles

### Phase 3: Database Normalization (Optional)
- Split into separate tables if needed
- Better foreign key relationships
- Easier to extend

---

## Key UX Principles Applied

1. **Progressive Disclosure**
   - Show only what's relevant at each level
   - Collapse sections when disabled

2. **Clear Mental Models**
   - 3 distinct concepts, not one mixed "brand voice"
   - Each page has single, clear purpose

3. **Contextual Help**
   - Brief descriptions under each section
   - Examples in placeholders
   - Explain consequences (e.g., "Takes longer")

4. **Consistent Patterns**
   - Enable/disable toggles at top of sections
   - Content collapses when disabled
   - Save buttons in consistent locations

5. **Scalability**
   - Easy to add new check types
   - Room for audit scheduling, notifications, etc.
   - Clear where new features belong

---

## Migration Path

1. **Backend:** Keep current `brand_voice_profiles` table, rename fields for clarity
2. **Frontend:** Create 3 new pages, keep API compatible
3. **Gradual rollout:** Old URL redirects to new structure
4. **Future:** Split tables if needed for performance/clarity
