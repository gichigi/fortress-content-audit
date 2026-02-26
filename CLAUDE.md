# Fortress Content Audit - Claude Code Rules

## PRIMARY RULES (Always Follow These)

### UI & Communication
- **In UI always prioritise clarity and usability**
- **ALWAYS reply in short, casual sentences using strictly plain English**
- Always write and edit agent prompts/instructions with:
  - A single short lead-in sentence
  - Details as short, clear bullets so we can easily scan, parse, update in future
- Always apply clear and short code comments, console messages for debugging, and error messages for users

### Truthfulness & Honesty
- **Don't just agree with me or say what I wanna hear.** Tell me the truth to the best of your knowledge or admit if you don't know something and suggest how we can resolve it.
- Never hallucinate API keys, event names, or property names - check existing code first
- Never hallucinate data - when unsure about existing code, search/read the codebase first
- **Ask clarifying questions when unsure about a request or lacking context**
  - Don't assume or guess what the user means
  - Ask specific questions to understand requirements, scope, or constraints
  - Better to ask now than implement the wrong thing

### Planning & Process
- Before creating new pages or files, check whether they already exist
- Before big refactors, carefully analyze the request, identify potential edge cases or pitfalls, and outline a clear step-by-step plan to implement the feature or fix
  - Your steps should include: Which files or components are affected, what changes are needed, expected side effects

### Tools & Environment
- **Always use `pnpm` instead of `npm`** for all package management tasks

### Forbidden
- **NEVER use example.com as a test domain** - use real domain names from the project context

---

## Project Overview
This is a content audit SaaS platform built with Next.js, Supabase, and various AI integrations. The app helps brands audit their website content for quality, consistency, and clarity issues.

## Code Quality Principles
- Keep code simple and focused. Don't over-engineer.
- No unnecessary abstractions, utilities, or premature optimization.
- Trust framework guarantees and internal code. Only validate at system boundaries (user input, external APIs).
- When in doubt, check the codebase for existing patterns before creating new ones.

### Testing & Quality
- Always test code changes, especially for:
  - PDF export functionality
  - API integrations (Supabase, PostHog, OpenAI)
  - Authentication flows
  - Database migrations
- **For AI prompt or model/API changes: always run a real end-to-end audit test before pushing to prod** — prompt wording directly affects output quality and regressions are invisible without live testing
- Run `pnpm build` after major changes to verify compilation
- Check for TypeScript errors before committing

### Version Control
- Create meaningful, atomic commits with clear messages
- Reference the "why" not the "what" in commit messages
- Review diffs carefully before committing
- Use `/push-to-github` command for quick commits

### Analytics & Tracking (PostHog)
- Feature flags: Use enums/const objects, keep usage centralized
- Custom properties used 2+ times: Store in enum/const object
- Naming convention: `UPPERCASE_WITH_UNDERSCORE` for flag/property names
- Gate flag-dependent code with validation checks
- Before creating event/property names, check for existing naming conventions

### Documentation
- Update comments only when logic is non-obvious
- Keep README and docs in sync with actual implementation
- Document breaking changes clearly

## Project Structure
- `/app` - Next.js app router pages and API routes
- `/lib` - Utility functions, helpers, and services
- `/components` - React components (UI and feature components)
- `/types` - TypeScript type definitions
- `.cursor/commands/` - Cursor-style commands
- `.claude/commands/` - Claude Code slash commands

## Useful Commands
- `/check` - Review implementation critically
- `/rating` - Rate an implementation
- `/deslop` - Remove AI-generated code bloat
- `/kill` - Kill all Next.js dev servers
- `/push-to-github` - Push to GitHub with clear commit
- `/vlow` - Reminder to keep verbosity low
- `/confidence` - Rate confidence in assessment

## Key Technologies
- **Frontend:** Next.js 15, React 19, TypeScript
- **Backend:** Next.js API routes, Supabase (PostgreSQL)
- **PDF Export:** Client-side html2pdf.js (migrated from Puppeteer)
- **Analytics:** PostHog
- **AI:** OpenAI API via ai SDK
- **Auth:** Supabase Auth
- **Styling:** Tailwind CSS

## Important URLs
- Production: https://aistyleguide.com (if deployed)
- Supabase Admin URL: Check `.env.local`
- PostHog Dashboard: Check project settings

## Recent Changes
- Migrated PDF export from server-side Puppeteer to client-side html2pdf.js
- Eliminated Chromium system dependency issues in production
- Server generates HTML, client converts to PDF and downloads

## Testing Checklist
Before committing significant changes:
- [ ] Code compiles (`pnpm build`)
- [ ] TypeScript has no errors
- [ ] Feature works as intended
- [ ] No console errors
- [ ] Related tests pass (if applicable)
- [ ] No breaking changes to existing functionality
