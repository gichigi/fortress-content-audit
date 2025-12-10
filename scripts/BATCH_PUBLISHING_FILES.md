# Batch Publishing - Related Files Reference

## Core Scripts
- `scripts/generate-blog.sh` - Single post generator (curl-based API wrapper)
- `scripts/batch-publish.sh` - **NEW** Batch publisher with rate limiting and error handling
- `scripts/generate-blog-posts.js` - Legacy Node.js batch generator (uses direct OpenAI/Supabase)
- `scripts/generate-blog-dry-run.js` - Dry run tester (no database writes)

## Planning & Configuration
- `scripts/batch-publishing-plan.md` - High-level batch plan (5 batches)
- `scripts/content-batch-plan.md` - Detailed content plan with titles, keywords, internal links
- `scripts/README-batch-publish.md` - Batch script documentation
- `scripts/ai-link-automation-plan.md` - Plan for AI-assisted retro-link updates (OpenAI + Supabase MCP)

## API Endpoints
- `app/api/blog/generate/route.ts` - Main blog generation API endpoint
- `app/api/blog/route.ts` - Blog listing and manual POST endpoint
- `app/api/blog/[slug]/route.ts` - Individual post GET/PUT/PATCH
- `app/api/admin/login/route.ts` - Admin authentication

## Prompt Files
- `lib/blog-prompts.js` - Prompt generation functions (outline + article)
- `lib/prompts/system-prompt.md` - System-level AI instructions
- `lib/prompts/outline-instructions.md` - Outline generation instructions
- `lib/prompts/article-instructions.md` - Article writing instructions

## Components
- `components/blog/BlogContent.tsx` - Blog post content renderer (with quote italicization)
- `app/admin/blog/page.tsx` - Admin blog interface
- `app/admin/blog/components/BlogGenerator.tsx` - UI blog generator component
- `app/admin/blog/components/LoginForm.tsx` - Admin login form

## Database & Schema
- `supabase/migrations/001_create_blog_posts.sql` - Blog posts table schema

## Utilities
- `lib/openai.ts` - OpenAI API wrapper
- `lib/firecrawl.ts` - Firecrawl search integration
- `lib/api-utils.ts` - API utilities (retry logic, etc.)

## Documentation
- `BLOG_SYSTEM_README.md` - Blog system documentation
- `BLOG_SYSTEM_ROADMAP.md` - Roadmap and completed features
- `SECURITY_REVIEW.md` - Security review for admin interface

## Environment Variables (`.env`)
- `ADMIN_BLOG_PASSWORD` - Admin authentication password
- `OPENAI_API_KEY` - OpenAI API key
- `FIRECRAWL_API_KEY` - Firecrawl API key (optional)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

## Output Files (Generated)
- `scripts/dry-run-output.md` - Dry run test output
- `dry-run-output.md` - Copy of dry run output in root
- `scripts/batch-publish.log` - Batch publishing progress log (created by batch script)

