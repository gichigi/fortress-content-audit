# Fortress - Content Audit

A powerful web application that automatically audits websites for content inconsistencies. Identify terminology conflicts, contradictory claims, voice inconsistencies, and naming conflicts across your site with AI-powered analysis.

## Features

- **AI-Powered Content Auditing**: Automatically scan up to 10 pages of any website
- **Comprehensive Issue Detection**: Find 4 core issue types:
  - Terminology conflicts - Same concept called different names
  - Contradictory claims - Facts/numbers that don't match across pages
  - Voice inconsistencies - Formal vs casual tone switching
  - Naming conflicts - Product/brand names spelled differently
- **Free 10-Page Scans**: No signup required for initial audits
- **Detailed Reports**: Get prioritized recommendations with specific examples and URLs
- **Dashboard**: Save and track your audit results over time

## Technologies

- Next.js 15.2
- React 19
- TypeScript
- Tailwind CSS
- Radix UI Components
- OpenAI API (Deep Research models: o3-deep-research, o4-mini-deep-research)
- Supabase for authentication and data storage
- PostHog for analytics

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- OpenAI API key
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
2. The system automatically crawls up to 10 pages
3. AI analyzes content for inconsistencies
4. View detailed audit results with prioritized issues
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

- OpenAI for AI capabilities (Deep Research)
- Vercel for hosting and deployment
- Supabase for backend infrastructure