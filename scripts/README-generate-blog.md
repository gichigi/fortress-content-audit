# Blog Post Generation via API

Generate blog posts directly via the API using curl.

## Quick Start

```bash
# Set your admin password (or it will use ADMIN_BLOG_PASSWORD from .env)
export ADMIN_BLOG_PASSWORD="your-password"

# Generate a post
./scripts/generate-blog.sh "Your Topic Title" "keyword1,keyword2" "Category (optional)"
```

## Examples

```bash
# Basic post
./scripts/generate-blog.sh "How to Write Better Copy"

# With keywords
./scripts/generate-blog.sh "Brand Voice Guide" "brand voice, tone of voice, writing"

# With category
./scripts/generate-blog.sh "Voice Examples" "examples" "Examples & Case Studies"

# Full example
./scripts/generate-blog.sh "How to Build Authentic Voice" "authentic voice, brand voice" "Brand Voice Foundations"
```

## Direct curl (if you prefer)

```bash
# 1. Login and save cookie
curl -c /tmp/cookies.txt -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}'

# 2. Generate post
curl -b /tmp/cookies.txt -X POST http://localhost:3000/api/blog/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Your Topic Here",
    "keywords": ["keyword1", "keyword2"],
    "publish": true
  }'
```

## Environment Variables

- `ADMIN_BLOG_PASSWORD` - Admin password (can also be set in .env)
- `BASE_URL` - API base URL (defaults to http://localhost:3000)

