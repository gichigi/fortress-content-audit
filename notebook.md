--
**Testing notes**

View meeting notes: https://www.notion.so/tahi/Anna-Yermakova-Fortress-Test-Session-2e9804529ed080a0bca2df13c6af58a7?pvs=180#2e9804529ed08078b5abc9ae5b189101

---

Summary:

### Session Overview

User testing session for Fortress, a website auditing tool that analyzes website content for issues and provides health scores. Tahi conducted a hands-on testing session with a user who tested the tool with multiple websites.  

### URL Input & Audit Process Issues

- Multiple attempts needed to input website URLs correctly - the tool struggled with certain URL formats (notion.site) and cut off query parameters:

2026-01-15 11:38:14.793 [info] Warning: NODE_ENV was incorrectly set to "productio", this value is being overridden to "production"
2026-01-15 11:38:15.067 [info] {
  "timestamp": "2026-01-15T11:38:15.064Z",
  "level": "info",
  "message": "URL validation successful",
  "details": {
    "url": "https://viktortsiselskii.notion.site/"
  }
}
2026-01-15 11:38:16.117 [info] [Audit] Created audit record: a763d3a2-f215-4571-9436-b4909ed89350, authenticated: false, tier: FREE
2026-01-15 11:38:16.127 [info] [API] Running FREE audit for https://viktortsiselskii.notion.site
2026-01-15 11:38:16.129 [info] {
  "timestamp": "2026-01-15T11:38:16.129Z",
  "level": "info",
  "message": "[MiniAudit] Starting GPT-5 web_search audit for https://viktortsiselskii.notion.site"
}
2026-01-15 11:38:16.148 [error] (node:4) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized and prone to errors that have security implications. Use the WHATWG URL API instead. CVEs are not issued for `url.parse()` vulnerabilities.
(Use `node --trace-deprecation ...` to show where the warning was created)
2026-01-15 11:39:03.309 [info] {
  "timestamp": "2026-01-15T11:39:03.309Z",
  "level": "info",
  "message": "[MiniAudit] Tool calls used: 4/10 (0 pages opened)"
}
2026-01-15 11:39:03.310 [info] {
  "timestamp": "2026-01-15T11:39:03.310Z",
  "level": "info",
  "message": "[MiniAudit] ✅ Complete: 0 issues, 0 pages audited, 0 URLs"
}
2026-01-15 11:39:03.311 [info] [API] No issues found on homepage for https://viktortsiselskii.notion.site - returning empty results
2026-01-15 11:39:03.662 [info] [Audit] ✅ Audit complete: a763d3a2-f215-4571-9436-b4909ed89350, 0 issues


- **Critical issue**: 3-minute wait time felt excessive for users expecting fast AI results
- User couldn't see progress - needs visibility into total steps (e.g., "3 of 10 complete") to manage expectations
- Loading indicators weren't clear enough about what was being analyzed

### Health Score Feedback

- **Major UX concern**: Health score of 59/100 for only 9 issues felt too harsh and demotivating
- User wanted more encouraging messaging ("American style" vs "Russian style" - too harsh/direct)
- Chart visualization looks like a "dramatic drop" rather than room for improvement

### Issues & Results Display

- Audit successfully identified real problems: grammar mistakes, broken links, misspellings ("naked" spelled with "ck"), pricing ambiguity
- Some false positives: Tool thought company name "GPRFM" was a broken link
- Color coding confusion: Orange appeared red, making medium issues look critical
- Critical issues filter works but wasn't obvious it was clickable

### Navigation & User Flow Problems

- **Critical bug**: Clicking "view all issues" then using back button showed blank homepage instead of results
- Unclear what to do after seeing results - no clear call-to-action or next steps
- Need more encouragement and relationship-building in messaging: "too Russian, too direct"
- Issue resolution feature (checkboxes) wasn't discoverable - user didn't know they could mark issues as resolved

### Page Selection Logic

- Tool chose homepage and one case study page for tier 1 audit
- User questioned why that specific case study over the main cases page
- Model's reasoning: simulates user journey from homepage to case study

### Tier System Confusion

- "Tier 1" label appeared without explanation of what it means or how to access other tiers
- User expected information about tier differences and how to upgrade

### Pricing Page Feedback

- Order of features should match across tiers (show same features first, then unique ones)
- Tier naming appears multiple times creating confusion
- Consulting option at enterprise level not clearly positioned

### Auto-Weekly Audits Concern

- User wouldn't want automatic weekly audits if website hasn't changed
- Receiving same issues repeatedly would be "annoying"

### Value Proposition Discussion

- **Current value**: Grammar, spelling, and link checking - but user can also get this from ChatGPT
- **Desired value**: Strategic analysis - website structure, offer quality, logical flow, marketing effectiveness
- User less concerned about grammar mistakes (as non-native speaker) than strategic issues
- Suggestions for improvement: analyze sentence/paragraph length, word choice for audience (B2B vs B2C), offer compelling-ness

### Target Audience Insights

- Most valuable for solopreneurs who don't understand website structure beyond copywriting
- Less valuable for infrequent website updaters (user only updates 2x per year)
- One-time use more appealing than subscription for infrequent users
- Target market: Medium-sized companies (30-100 employees) with regular content updates

### Gamification & Re-engagement Needs

- Add progress tracking to show improvement over time
- Encourage users to rerun audits after fixes with motivating messaging
- Need celebration when issues are resolved ("great job, thank you, finally some support")

### Technical Issues Encountered

- Tier 2 audit (full site scan) timed out and failed to complete
- Export to PDF/markdown failed, possibly because health score was 100
- Browser automatically detected user's language (Russian) for localization

### Product Development Context

- Started development mid-November, working 3 days/week
- Built using AI coding tools (Cursor)
- Spent approximately $500 on AI models for testing
- This was the first user test

### Action Items

- [x]  Fix back button navigation bug that shows blank page after viewing issues on homepage (Fixed: localStorage persistence)
- [x]  Add progress indicators showing total steps (e.g., "3 of 10") during audit process (Fixed: Updated messaging, removed numbering, clearer timing expectations)
- [x]  Recalibrate health score algorithm to be more encouraging - fewer issues should result in higher scores (Fixed: Reduced weights - critical 7→4, medium 3→2, low 1→0.5, criticalPages 10→5)
- [ ]  Add warm, encouraging messaging after showing results with clear call-to-action
- [x]  Change medium severity color from orange to yellow for better distinction (Fixed: Changed to yellow-500, unified 3-color scheme: rose-500/yellow-500/blue-500)
- [ ]  Make issue resolution checkboxes more discoverable
- [ ]  Add gamification elements to encourage return visits and progress tracking
- [ ]  Add explanation of tier system when "Tier 1" label appears
- [ ]  Reorder pricing page features to show consistent features first
- [ ]  Fix tier 2 audit timeout issue for larger website scans
- [ ]  Fix export functionality (PDF/markdown generation failed)
- [ ]  Consider adding strategic marketing analysis beyond grammar/spelling
- [ ]  Start visualization at 0% instead of current score to show opportunity rather than decline
- [ ]  Tahi to send Brand Way product link to user
- [ ]  User offered to test again after changes are implemented


12. Tier 2 audit failed
2026-01-15 12:14:02.491 [info] {
  "timestamp": "2026-01-15T12:14:02.491Z",
  "level": "info",
  "message": "URL validation successful",
  "details": {
    "url": "https://nakedbrand.pro/"
  }
}
2026-01-15 12:14:03.245 [info] [Audit] Created audit record: 5625a8ac-a844-422d-9c7f-6e1308f8b71f, authenticated: true, tier: PAID
2026-01-15 12:14:03.247 [info] [API] Running PAID audit for https://nakedbrand.pro
2026-01-15 12:14:03.249 [info] {
  "timestamp": "2026-01-15T12:14:03.248Z",
  "level": "info",
  "message": "[AuditSite] Starting GPT-5.1 web_search audit for https://nakedbrand.pro (tier: PAID, background: true)"
}
2026-01-15 12:14:38.235 [info] {
  "timestamp": "2026-01-15T12:14:38.235Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (30s / 480s max, 0 pages opened)"
}
2026-01-15 12:15:11.451 [info] {
  "timestamp": "2026-01-15T12:15:11.451Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (60s / 480s max, 0 pages opened)"
}
2026-01-15 12:15:43.690 [info] {
  "timestamp": "2026-01-15T12:15:43.690Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (90s / 480s max, 0 pages opened)"
}
2026-01-15 12:16:16.221 [info] {
  "timestamp": "2026-01-15T12:16:16.221Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (120s / 480s max, 0 pages opened)"
}
2026-01-15 12:16:48.483 [info] {
  "timestamp": "2026-01-15T12:16:48.482Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (150s / 480s max, 0 pages opened)"
}
2026-01-15 12:17:20.564 [info] {
  "timestamp": "2026-01-15T12:17:20.564Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (180s / 480s max, 0 pages opened)"
}
2026-01-15 12:17:53.179 [info] {
  "timestamp": "2026-01-15T12:17:53.178Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (210s / 480s max, 0 pages opened)"
}
2026-01-15 12:18:27.401 [info] {
  "timestamp": "2026-01-15T12:18:27.401Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (240s / 480s max, 0 pages opened)"
}
2026-01-15 12:18:59.681 [info] {
  "timestamp": "2026-01-15T12:18:59.681Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (270s / 480s max, 0 pages opened)"
}
2026-01-15 12:19:32.286 [info] {
  "timestamp": "2026-01-15T12:19:32.286Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (300s / 480s max, 0 pages opened)"
}
2026-01-15 12:20:06.183 [info] {
  "timestamp": "2026-01-15T12:20:06.183Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (330s / 480s max, 0 pages opened)"
}
2026-01-15 12:20:38.736 [info] {
  "timestamp": "2026-01-15T12:20:38.736Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (360s / 480s max, 0 pages opened)"
}
2026-01-15 12:21:11.006 [info] {
  "timestamp": "2026-01-15T12:21:11.006Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (390s / 480s max, 0 pages opened)"
}
2026-01-15 12:21:43.459 [info] {
  "timestamp": "2026-01-15T12:21:43.460Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (420s / 480s max, 0 pages opened)"
}
2026-01-15 12:22:16.945 [info] {
  "timestamp": "2026-01-15T12:22:16.946Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (450s / 480s max, 0 pages opened)"
}
2026-01-15 12:22:49.256 [info] {
  "timestamp": "2026-01-15T12:22:49.256Z",
  "level": "info",
  "message": "[AuditSite] Polling: in_progress (480s / 480s max, 0 pages opened)"
}
2026-01-15 12:22:49.256 [error] {
  "timestamp": "2026-01-15T12:22:49.257Z",
  "level": "error",
  "message": "[AuditSite] Audit timed out after 480s (max: 480s)"
}
2026-01-15 12:22:49.257 [error] {
  "timestamp": "2026-01-15T12:22:49.257Z",
  "level": "error",
  "message": "[AuditSite] Error",
  "error": {
    "message": "Audit timed out after 8 minutes. The site may be too large or slow to audit.",
    "name": "Error",
    "stack": "Error: Audit timed out after 8 minutes. The site may be too large or slow to audit.\n    at p (/var/task/.next/server/chunks/8171.js:1:7914)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async D (/var/task/.next/server/app/api/audit/route.js:1:7536)\n    at async E (/var/task/.next/server/app/api/audit/route.js:1:9050)\n    at async t (/var/task/node_modules/.pnpm/next@15.5.9_@babel+core@7.28.5_@opentelemetry+api@1.9.0_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:1:111654)\n    at async a (/var/task/node_modules/.pnpm/next@15.5.9_@babel+core@7.28.5_@opentelemetry+api@1.9.0_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:1:14629)"
  }
}
2026-01-15 12:22:49.258 [error] {
  "timestamp": "2026-01-15T12:22:49.258Z",
  "level": "error",
  "message": "[Audit] Error: Audit timed out after 8 minutes. The site may be too large or slow to audit.",
  "details": {
    "name": "Error"
  },
  "error": {
    "message": "Audit timed out after 8 minutes. The site may be too large or slow to audit.",
    "name": "Error",
    "stack": "Error: Audit timed out after 8 minutes. The site may be too large or slow to audit.\n    at p (/var/task/.next/server/chunks/8171.js:1:7914)\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async D (/var/task/.next/server/app/api/audit/route.js:1:7536)\n    at async E (/var/task/.next/server/app/api/audit/route.js:1:9050)\n    at async t (/var/task/node_modules/.pnpm/next@15.5.9_@babel+core@7.28.5_@opentelemetry+api@1.9.0_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:1:111654)\n    at async a (/var/task/node_modules/.pnpm/next@15.5.9_@babel+core@7.28.5_@opentelemetry+api@1.9.0_react-dom@19.1.0_react@19.1.0__react@19.1.0/node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js:1:14629)"
  }
}
2026-01-15 12:22:49.262 [error] [Audit] Background audit error: Error: Audit generation failed. Please try again.
    at x (.next/server/chunks/8171.js:26:4677)
    at p (.next/server/chunks/8171.js:1:10035)
    at async D (.next/server/app/api/audit/route.js:1:7536)
    at async E (.next/server/app/api/audit/route.js:1:9050)