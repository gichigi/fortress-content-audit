# Fortress - Content Audit

A powerful web application that automatically audits websites for content inconsistencies. Identify terminology conflicts, contradictory claims, voice inconsistencies, and naming conflicts across your site with AI-powered analysis.

## Features

- **AI-Powered Content Auditing**: Default scan of up to 3 key pages (search-first, then map/select/scrape, with crawl/homepage fallback)
- **Focused Issue Detection**:
  - Spelling/grammar/typos
  - Naming, terminology, factual conflicts
  - Contradictory claims
  - (Ignores spacing/formatting/layout noise like nav/footers/consent UI)
- **Transparent Results**: Response includes audited URLs (`meta.auditedUrls`) and map info when used
- **Detailed Reports**: Prioritized recommendations with concrete snippets and URLs
- **Dashboard**: Save and track your audit results over time

## Technologies

- Next.js 15.2
- React 19
- TypeScript
- Tailwind CSS
- Radix UI Components
- OpenAI API (GPT-5.1)
- Firecrawl for website crawling
- Supabase for authentication and data storage
- PostHog for analytics

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- OpenAI API key
- Firecrawl API key
- Supabase project (for authentication and database)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/fortress-content-audit.git
   cd fortress-content-audit
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Set up environment variables
   Create a `.env.local` file with:
   ```
   OPENAI_API_KEY=your_openai_api_key
   FIRECRAWL_API_KEY=your_firecrawl_api_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

4. Set up database
   Run the Supabase migrations in the `supabase/migrations/` directory

5. Start the development server
   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) to view the app

## Usage

1. Enter a website URL on the homepage
2. Backend flow:
   - Firecrawl `searchBrief site:<domain>` to pick top pages
   - If needed, Firecrawl `map` + GPT-4.1 selector + `scrape` to fetch markdown
   - Fallback to `crawl` or direct homepage fetch
   - Pages/URLs are deduped and returned in `meta.auditedUrls`
3. AI (GPT-5.1) analyzes collected page copy for the focused issue set
4. View prioritized issues with examples and URLs
5. Save audits to your dashboard (sign up required)

## Project Structure

- `app/` - Next.js app router pages and API routes
- `components/` - React components
- `lib/` - Core utilities (audit logic, API clients)
- `supabase/migrations/` - Database migrations
- `scripts/` - Utility scripts for content generation

## License

MIT

## Acknowledgements

- OpenAI for AI capabilities
- Firecrawl for website crawling
- Vercel for hosting and deployment
- Supabase for backend infrastructure