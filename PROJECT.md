# Fortress Content Audit - Project Rules

## Fortress-Specific Rules

### Forbidden
- **NEVER use example.com as a test domain** - use real domain names from the project context
- Never hallucinate API keys, event names, or property names - check existing code first

### Audit Quality Philosophy
- **Fewer issues, higher confidence** — it's better to miss an edge case than to report false positives. Users lose trust in the tool when it flags things that aren't real issues.
- **Link auditing is internal-only** — only flag internal navigation links that are broken or point to the wrong page. Never flag mailto:, tel:, or external links as broken — AI models can't verify these from markdown and they're almost always fine on the live site.
- **Extraction artifacts are not issues** — Firecrawl's HTML-to-markdown conversion strips whitespace between adjacent HTML elements (e.g., `<span>The</span><span>simple</span>` becomes `Thesimple`). The prompts in `lib/audit-prompts.ts` include explicit caveats telling models to ignore these. If similar artifact patterns emerge, fix at the prompt level, not by modifying the crawled content.

### Testing
- **For AI prompt or model/API changes: always run a real end-to-end audit test before pushing to prod** — prompt wording directly affects output quality and regressions are invisible without live testing
- Always test: PDF export, Supabase/PostHog/OpenAI integrations, auth flows, DB migrations

### Analytics & Tracking (PostHog)
- Feature flags: Use enums/const objects, keep usage centralized
- Custom properties used 2+ times: Store in enum/const object
- Naming convention: `UPPERCASE_WITH_UNDERSCORE` for flag/property names
- Gate flag-dependent code with validation checks
- Before creating event/property names, check for existing naming conventions

---

## Project Overview
Content audit SaaS platform built with Next.js, Supabase, and AI integrations. Helps brands audit website content for quality, consistency, and clarity issues.

## Key Technologies
- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API routes, Supabase (PostgreSQL), Supabase Auth
- **PDF Export:** Client-side html2pdf.js
- **Analytics:** PostHog
- **AI:** OpenAI API via ai SDK

## Project Structure
- `/app` - Next.js app router pages and API routes
- `/lib` - Utility functions, helpers, and services
- `/components` - React components
- `/types` - TypeScript type definitions
- `.claude/commands/` - Claude Code slash commands

## Useful Commands
- `/check` - Review implementation critically
- `/rating` - Rate an implementation
- `/deslop` - Remove AI-generated code bloat
- `/kill` - Kill all Next.js dev servers
- `/push-to-github` - Push to GitHub with clear commit
- `/vlow` - Reminder to keep verbosity low
- `/confidence` - Rate confidence in assessment

## Important URLs
- Production: https://aistyleguide.com (if deployed)
- Supabase Admin URL: Check `.env.local`
- PostHog Dashboard: Check project settings
