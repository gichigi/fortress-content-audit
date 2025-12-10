#!/bin/bash

# Blog Post Generator via API
# Usage: ./scripts/generate-blog.sh "Topic Title" "keyword1,keyword2" "Category (optional)"

TOPIC="${1}"
KEYWORDS="${2:-}"
CATEGORY="${3:-}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_PASSWORD="${ADMIN_BLOG_PASSWORD}"

if [ -z "$TOPIC" ]; then
  echo "Usage: $0 \"Topic Title\" [keywords] [category]"
  echo "Example: $0 \"How to Write Better\" \"writing, copywriting\" \"Tone Of Voice Fundamentals\""
  exit 1
fi

# Cookie jar file
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\": \"$ADMIN_PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q "success"; then
  echo "✅ Login successful"
else
  echo "❌ Login failed: $LOGIN_RESPONSE"
  exit 1
fi

# Build request body
BODY="{\"topic\": \"$TOPIC\", \"publish\": true"
if [ -n "$KEYWORDS" ]; then
  # Convert comma-separated keywords to JSON array
  KEYWORDS_JSON=$(echo "$KEYWORDS" | sed 's/,/","/g' | sed 's/^/["/' | sed 's/$/"]/')
  BODY="$BODY, \"keywords\": $KEYWORDS_JSON"
fi
if [ -n "$CATEGORY" ]; then
  BODY="$BODY, \"category\": \"$CATEGORY\""
fi
BODY="$BODY}"

echo "📝 Generating blog post: \"$TOPIC\"..."
RESPONSE=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/blog/generate" \
  -H "Content-Type: application/json" \
  -d "$BODY")

# Check if successful
if echo "$RESPONSE" | grep -q "\"success\":true"; then
  SLUG=$(echo "$RESPONSE" | grep -o '"slug":"[^"]*' | cut -d'"' -f4)
  TITLE=$(echo "$RESPONSE" | grep -o '"title":"[^"]*' | cut -d'"' -f4)
  echo "✅ Blog post generated successfully!"
  echo "📄 Title: $TITLE"
  echo "🔗 URL: $BASE_URL/blog/$SLUG"
else
  echo "❌ Generation failed:"
  echo "$RESPONSE" | grep -o '"error":"[^"]*' | cut -d'"' -f4 || echo "$RESPONSE"
  exit 1
fi

