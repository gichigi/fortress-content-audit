# AI Style Guide Blog System

A complete blog system built with Next.js, Supabase, and automated content generation using OpenAI.

## 🚀 Features

- **Modern Blog Interface**: Clean, responsive design using Tailwind CSS
- **SEO Optimized**: Full Schema.org structured data and meta tags
- **Automated Content Generation**: Generate blog posts from CSV topics using OpenAI
- **Pagination**: Efficient pagination for blog listing
- **Database Integration**: Supabase backend with proper indexing
- **TypeScript**: Full type safety throughout the application

## 📁 File Structure

```
app/
├── blog/
│   ├── page.tsx              # Blog listing page
│   └── [slug]/
│       └── page.tsx          # Individual blog post page
└── api/
    └── blog/
        ├── route.ts          # Blog API endpoints (GET, POST)
        └── [slug]/
            └── route.ts      # Individual post API (GET, PUT, DELETE)

components/blog/
├── BlogCard.tsx              # Blog post card component
├── BlogContent.tsx           # Styled content renderer
└── Pagination.tsx            # Pagination component

scripts/
└── generate-blog-posts.js    # Content generation script
```

## 🗄️ Database Schema

The `blog_posts` table includes:

- `id` (UUID) - Primary key
- `title` (TEXT) - Blog post title
- `slug` (TEXT) - URL-friendly slug (unique)
- `content` (TEXT) - Full blog post content
- `excerpt` (TEXT) - Short summary
- `keywords` (TEXT[]) - SEO keywords array
- `category` (TEXT) - Post category
- `featured_image` (TEXT) - Optional featured image URL
- `author_name` (TEXT) - Author name
- `published_at` (TIMESTAMPTZ) - Publication date
- `updated_at` (TIMESTAMPTZ) - Last update date
- `created_at` (TIMESTAMPTZ) - Creation date
- `word_count` (INTEGER) - Word count
- `reading_time` (INTEGER) - Estimated reading time in minutes
- `is_published` (BOOLEAN) - Publication status

## 🎯 Content Generation

### CSV Format

Your CSV should have this structure:
```csv
Page Title,Target Keywords
"What Is Brand Voice? A Simple Guide","brand voice, what is brand voice, brand voice meaning"
"Brand Voice vs Tone of Voice","brand voice vs tone of voice, difference between voice and tone"
```

### Generation Commands

```bash
# Dry run (test without saving)
pnpm run generate-blog:dry

# Generate 3 posts (limited)
pnpm run generate-blog:limit

# Generate all posts from CSV
pnpm run generate-blog
```

### Script Features

- **Rate Limiting**: 2-second delays between API calls
- **Duplicate Detection**: Skips existing slugs
- **Error Handling**: Continues on individual failures
- **Progress Tracking**: Shows detailed progress and statistics
- **Dry Run Mode**: Test without database writes
- **Firecrawl Integration**: Automatically fetches recent web context before generating outlines (requires `FIRECRAWL_API_KEY`)

### Firecrawl Search Briefing

The blog generation system includes optional Firecrawl search integration to provide recent context and avoid outdated information:

- **Automatic Research**: Before generating an outline, the system searches for recent articles and resources related to the topic
- **Context Injection**: Search results are included in the outline prompt to ensure current best practices
- **Fail-Safe**: If Firecrawl is unavailable or API key is missing, generation continues without briefing
- **Configuration**: Set `FIRECRAWL_API_KEY` in your `.env` file to enable (optional).

The search briefing helps ensure generated content reflects current industry standards and avoids hallucinated or outdated brand examples.

## 🔧 API Endpoints

### Blog Listing
```
GET /api/blog?page=1&limit=10&category=Brand%20Strategy
```

Response:
```json
{
  "posts": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Individual Post
```
GET /api/blog/[slug]
```

### Create Post
```
POST /api/blog
Content-Type: application/json

{
  "title": "Blog Post Title",
  "slug": "blog-post-slug",
  "content": "Full blog post content...",
  "excerpt": "Short summary...",
  "keywords": ["keyword1", "keyword2"],
  "is_published": true
}
```

## 🎨 Design System

### Typography Hierarchy
- **H1**: `text-4xl font-bold` (post titles)
- **H2**: `text-2xl font-semibold` (section headers)
- **H3**: `text-xl font-medium` (subsections)
- **Body**: `text-base leading-relaxed` (content)
- **Meta**: `text-sm text-muted-foreground` (dates, reading time)

### Components
- **BlogCard**: Hover effects, responsive images, metadata display
- **BlogContent**: Styled prose with proper spacing and typography
- **Pagination**: Clean pagination with numbered pages and prev/next

## 🔍 SEO Features

### Schema.org Structured Data
- BlogPosting schema for individual posts
- Organization schema for publisher info
- Proper meta tags and Open Graph data

### Meta Tags
- Dynamic title and description per post
- Twitter Card support
- Canonical URLs
- Keyword optimization

## 🚀 Deployment

1. **Environment Variables**: Ensure all required env vars are set in production:
   - `OPENAI_API_KEY` (required)
   - `FIRECRAWL_API_KEY` (optional, enables search briefing)
   - `NEXT_PUBLIC_SUPABASE_URL`