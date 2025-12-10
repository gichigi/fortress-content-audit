#!/bin/bash

# Batch Blog Post Publisher
# Usage: ./scripts/batch-publish.sh [batch-number] [--dry-run] [--delay=seconds]
# Example: ./scripts/batch-publish.sh 1 --dry-run --delay=3

set -e

BATCH_NUM="${1}"
DRY_RUN=false
DELAY=3
BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_PASSWORD="${ADMIN_BLOG_PASSWORD}"
LOG_FILE="scripts/batch-publish.log"
PLAN_FILE="scripts/batch-publishing-plan.md"
CONTENT_PLAN_FILE="scripts/content-batch-plan.md"
FIELD_DELIMITER=$'\x1F'
LIMIT=""
FILTER=""

trim() {
  local var="$1"
  var="${var#"${var%%[![:space:]]*}"}"
  var="${var%"${var##*[![:space:]]}"}"
  printf '%s' "$var"
}

to_lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

json_escape() {
  node -e 'process.stdout.write(JSON.stringify(process.argv[1] || ""))' "$1"
}

map_pillar_to_category() {
  case "$1" in
    "Tone Fundamentals") echo "Tone Of Voice Fundamentals" ;;
    "Tone Of Voice Fundamentals") echo "Tone Of Voice Fundamentals" ;;
    "Brand Voice Foundations") echo "Brand Voice Foundations" ;;
    "Guidelines & Templates") echo "Guidelines & Templates" ;;
    "Examples & Case Studies") echo "Examples & Case Studies" ;;
    "Channel & Execution") echo "Channel & Execution" ;;
    *) echo "" ;;
  esac
}

# Parse arguments
for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --delay=*)
      DELAY="${arg#*=}"
      shift
      ;;
    --limit=*)
      LIMIT="${arg#*=}"
      shift
      ;;
    --filter=*)
      FILTER="${arg#*=}"
      shift
      ;;
    *)
      ;;
  esac
done

if [ -z "$BATCH_NUM" ]; then
  echo "Usage: $0 [batch-number] [--dry-run] [--delay=seconds]"
  echo ""
  echo "Batch numbers:"
  echo "  1 - Launch Hubs & Core Definitions"
  echo "  2 - Templates & Documentation"
  echo "  3 - Examples & Comparisons"
  echo "  4 - Brand Breakdowns & Strategy"
  echo "  5 - Channel & Support Intents"
  echo ""
  echo "Options:"
  echo "  --dry-run    Test without publishing (publish=false)"
  echo "  --delay=N    Delay between posts in seconds (default: 3)"
  exit 1
fi

# Initialize log file
echo "=== Batch $BATCH_NUM Publishing Started: $(date) ===" >> "$LOG_FILE"
if [ "$DRY_RUN" = true ]; then
  echo "DRY RUN MODE - Posts will not be published" >> "$LOG_FILE"
fi

# Cookie jar file
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

# Login
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_JAR" -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"password\": \"$ADMIN_PASSWORD\"}")

if ! echo "$LOGIN_RESPONSE" | grep -q "success"; then
  echo "❌ Login failed: $LOGIN_RESPONSE"
  echo "❌ Login failed: $LOGIN_RESPONSE" >> "$LOG_FILE"
  exit 1
fi

echo "✅ Login successful"
echo "✅ Login successful" >> "$LOG_FILE"

# Extract topics from batch plan
extract_batch_topics() {
  local batch_num=$1
  local topics=()
  
  # First, try to extract from content-batch-plan.md (more structured)
  if [ -f "$CONTENT_PLAN_FILE" ]; then
    local in_batch=false
    while IFS= read -r line; do
      # Detect batch section start
      if [[ "$line" =~ ^###\ Batch\ $batch_num ]]; then
        in_batch=true
        continue
      fi
      
      # Stop at next batch
      if [[ "$in_batch" = true ]] && [[ "$line" =~ ^###\ Batch ]]; then
        break
      fi
      
      # Extract from table rows
      if [[ "$in_batch" = true ]] && [[ "$line" =~ ^\| ]]; then
        # Skip header and separator rows
        if [[ "$line" =~ \#.*\| ]] || [[ "$line" =~ ^\|.*--- ]]; then
          continue
        fi
        
        # Parse pipe-separated values
        IFS='|' read -ra fields <<< "$line"
        if [ ${#fields[@]} -ge 6 ]; then
          local number
          number=$(trim "${fields[1]}")
          local pillar
          pillar=$(trim "${fields[2]}")
          local primary
          primary=$(trim "${fields[3]}")
          local title
          title=$(trim "${fields[4]}")
          local supporting
          supporting=$(trim "${fields[5]}")
          local internal_plan=""
          if [ ${#fields[@]} -ge 7 ]; then
            internal_plan=$(trim "${fields[6]}")
          fi

          if [ -n "$title" ] && [[ ! "$title" =~ ^#[[:space:]]*$ ]] && [[ ! "$title" =~ ^Working\ Title$ ]]; then
            topics+=("${title}${FIELD_DELIMITER}${primary}${FIELD_DELIMITER}${supporting}${FIELD_DELIMITER}${internal_plan}${FIELD_DELIMITER}${pillar}${FIELD_DELIMITER}${number}")
          fi
        fi
      fi
    done < "$CONTENT_PLAN_FILE"
  fi
  
  # Fallback: extract from batch-publishing-plan.md (less structured)
  if [ ${#topics[@]} -eq 0 ] && [ -f "$PLAN_FILE" ]; then
    local in_batch=false
    while IFS= read -r line; do
      # Detect batch start
      if [[ "$line" =~ ^###\ Batch\ $batch_num ]]; then
        in_batch=true
        continue
      fi
      
      # Stop at next batch
      if [[ "$in_batch" = true ]] && [[ "$line" =~ ^###\ Batch ]]; then
        break
      fi
      
      # Extract topics from "Posts:" line
      if [[ "$in_batch" = true ]] && [[ "$line" =~ Posts:\ (.+) ]]; then
        local posts_line="${BASH_REMATCH[1]}"
        # Split by comma and clean up
        IFS=',' read -ra POSTS <<< "$posts_line"
        for post in "${POSTS[@]}"; do
          post=$(echo "$post" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
          if [ -n "$post" ]; then
            local title="$post"
            local primary="$post"
            local supporting=""
            local internal_plan=""
            local pillar=""
            local number=""
            topics+=("${title}${FIELD_DELIMITER}${primary}${FIELD_DELIMITER}${supporting}${FIELD_DELIMITER}${internal_plan}${FIELD_DELIMITER}${pillar}${FIELD_DELIMITER}${number}")
          fi
        done
      fi
    done < "$PLAN_FILE"
  fi
  
  printf '%s\n' "${topics[@]}"
}

# Get topics for this batch
echo "📋 Extracting topics for Batch $BATCH_NUM..."
TOPIC_RECORDS=()
while IFS= read -r topic_line; do
  if [ -n "$topic_line" ]; then
    TOPIC_RECORDS+=("$topic_line")
  fi
done < <(extract_batch_topics "$BATCH_NUM")

if [ ${#TOPIC_RECORDS[@]} -eq 0 ]; then
  echo "❌ No topics found for Batch $BATCH_NUM"
  echo "   Please check:"
  echo "   - $CONTENT_PLAN_FILE (preferred - structured table format)"
  echo "   - $PLAN_FILE (fallback - less structured)"
  exit 1
fi

if [ -n "$FILTER" ]; then
  FILTER_LOWER=$(to_lower "$FILTER")
  FILTERED_RECORDS=()
  for record in "${TOPIC_RECORDS[@]}"; do
    IFS=$FIELD_DELIMITER read -r WORKING_TITLE _ <<< "$record"
    TITLE_LOWER=$(to_lower "$WORKING_TITLE")
    if [[ "$TITLE_LOWER" == *"$FILTER_LOWER"* ]]; then
      FILTERED_RECORDS+=("$record")
    fi
  done
  TOPIC_RECORDS=("${FILTERED_RECORDS[@]}")
fi

if [ ${#TOPIC_RECORDS[@]} -eq 0 ]; then
  echo "❌ No topics matched the provided filters"
  echo "❌ No topics matched the provided filters" >> "$LOG_FILE"
  exit 1
fi

if [ -n "$LIMIT" ]; then
  LIMITED_RECORDS=()
  COUNT=0
  for record in "${TOPIC_RECORDS[@]}"; do
    if [ "$COUNT" -ge "$LIMIT" ]; then
      break
    fi
    LIMITED_RECORDS+=("$record")
    COUNT=$((COUNT + 1))
  done
  TOPIC_RECORDS=("${LIMITED_RECORDS[@]}")
fi

echo "✅ Found ${#TOPIC_RECORDS[@]} topics"
echo "✅ Found ${#TOPIC_RECORDS[@]} topics" >> "$LOG_FILE"

# Publish each topic
SUCCESSFUL=0
FAILED=0
SKIPPED=0
TOTAL=${#TOPIC_RECORDS[@]}

for i in "${!TOPIC_RECORDS[@]}"; do
  RECORD="${TOPIC_RECORDS[$i]}"
  IFS=$FIELD_DELIMITER read -r WORKING_TITLE PRIMARY_KEYWORD SUPPORTING_KEYWORDS INTERNAL_PLAN PILLAR POST_NUMBER <<< "$RECORD"

  TOPIC=$(trim "$WORKING_TITLE")
  PRIMARY_KEYWORD=$(trim "$PRIMARY_KEYWORD")
  SUPPORTING_KEYWORDS=$(echo "$SUPPORTING_KEYWORDS" | sed 's/<br>/, /gi' | sed 's/[“”]/"/g')
  PILLAR=$(trim "$PILLAR")

  KEYWORDS_ARRAY=()

  add_keyword() {
    local candidate
    candidate=$(trim "$1")
    if [ -z "$candidate" ]; then
      return
    fi
    local candidate_lower
    candidate_lower=$(to_lower "$candidate")
    for existing in "${KEYWORDS_ARRAY[@]}"; do
      local existing_lower
      existing_lower=$(to_lower "$existing")
      if [ "$existing_lower" = "$candidate_lower" ]; then
        return
      fi
    done
    KEYWORDS_ARRAY+=("$candidate")
  }

  if [ -n "$PRIMARY_KEYWORD" ]; then
    add_keyword "$PRIMARY_KEYWORD"
  fi

  TEMP_SUPPORT="$SUPPORTING_KEYWORDS"
  while [[ "$TEMP_SUPPORT" == *\"*\"* ]]; do
    TEMP_SUPPORT="${TEMP_SUPPORT#*\"}"
    QUOTED_VALUE="${TEMP_SUPPORT%%\"*}"
    add_keyword "$QUOTED_VALUE"
    TEMP_SUPPORT="${TEMP_SUPPORT#*\"}"
  done

  if [ ${#KEYWORDS_ARRAY[@]} -eq 0 ] && [ -n "$TOPIC" ]; then
    add_keyword "$TOPIC"
  fi

  KEYWORDS_JSON="["
  for idx in "${!KEYWORDS_ARRAY[@]}"; do
    KEYWORD_JSON=$(json_escape "${KEYWORDS_ARRAY[$idx]}")
    if [ "$idx" -gt 0 ]; then
      KEYWORDS_JSON+=", "
    fi
    KEYWORDS_JSON+="$KEYWORD_JSON"
  done
  KEYWORDS_JSON+="]"

  CATEGORY_OVERRIDE=$(map_pillar_to_category "$PILLAR")
  CATEGORY_JSON=""
  if [ -n "$CATEGORY_OVERRIDE" ]; then
    CATEGORY_JSON=$(json_escape "$CATEGORY_OVERRIDE")
  fi

  INDEX=$((i + 1))
  
  echo ""
  echo "[$INDEX/$TOTAL] Processing: \"$TOPIC\""
  echo "[$INDEX/$TOTAL] Processing: \"$TOPIC\"" >> "$LOG_FILE"
  
  # Build request body
  PUBLISH_VALUE="false"
  if [ "$DRY_RUN" = false ]; then
    PUBLISH_VALUE="true"
  fi
  
  TOPIC_JSON=$(json_escape "$TOPIC")
  BODY="{\"topic\": $TOPIC_JSON, \"publish\": $PUBLISH_VALUE"
  if [ ${#KEYWORDS_ARRAY[@]} -gt 0 ]; then
    BODY="$BODY, \"keywords\": $KEYWORDS_JSON"
    echo "  🔑 Keywords: $KEYWORDS_JSON"
    echo "  🔑 Keywords: $KEYWORDS_JSON" >> "$LOG_FILE"
  fi
  if [ -n "$CATEGORY_JSON" ]; then
    BODY="$BODY, \"category\": $CATEGORY_JSON"
  fi
  BODY="$BODY}"
  
  # Make API call
  ATTEMPT=1
  MAX_ATTEMPTS=3
  POST_STATUS="failed"
  while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    RESPONSE=$(curl -s -b "$COOKIE_JAR" -X POST "$BASE_URL/api/blog/generate" \
      -H "Content-Type: application/json" \
      -d "$BODY")
    
    if [ "$DRY_RUN" = true ]; then
      mkdir -p tmp
      echo "$RESPONSE" > "tmp/response-${BATCH_NUM}-${INDEX}-attempt${ATTEMPT}.json"
    fi
    
    if echo "$RESPONSE" | grep -q "\"success\":true"; then
      SLUG=$(echo "$RESPONSE" | grep -o '"slug":"[^"]*' | cut -d'"' -f4 || echo "unknown")
      TITLE=$(echo "$RESPONSE" | grep -o '"title":"[^"]*' | cut -d'"' -f4 || echo "$TOPIC")
      
      echo "  ✅ Success: $TITLE"
      echo "  🔗 Slug: $SLUG"
      echo "  ✅ Success: $TITLE (slug: $SLUG)" >> "$LOG_FILE"
      SUCCESSFUL=$((SUCCESSFUL + 1))
      POST_STATUS="succeeded"
      break
    elif echo "$RESPONSE" | grep -q "already exists\|duplicate\|409"; then
      echo "  ⚠️  Skipped (duplicate slug)"
      echo "  ⚠️  Skipped (duplicate slug)" >> "$LOG_FILE"
      SKIPPED=$((SKIPPED + 1))
      POST_STATUS="skipped"
      break
    else
      ERROR_MSG=$(echo "$RESPONSE" | grep -o '"error":"[^"]*' | cut -d'"' -f4 || echo "$RESPONSE")
      echo "  ❌ Attempt $ATTEMPT failed: $ERROR_MSG"
      echo "  ❌ Attempt $ATTEMPT failed: $ERROR_MSG" >> "$LOG_FILE"
      ATTEMPT=$((ATTEMPT + 1))
      if [ $ATTEMPT -le $MAX_ATTEMPTS ]; then
        echo "  🔁 Retrying in ${DELAY}s..."
        echo "  🔁 Retrying in ${DELAY}s..." >> "$LOG_FILE"
        sleep "$DELAY"
      else
        POST_STATUS="failed"
      fi
    fi
  done
  
  if [ "$POST_STATUS" = "failed" ]; then
    echo "  ⚠️  Skipped after ${MAX_ATTEMPTS} attempts"
    echo "  ⚠️  Skipped after ${MAX_ATTEMPTS} attempts" >> "$LOG_FILE"
    SKIPPED=$((SKIPPED + 1))
  fi
  
  # Rate limiting (except for last item)
  if [ $INDEX -lt $TOTAL ]; then
    echo "  ⏳ Waiting ${DELAY} seconds..."
    sleep "$DELAY"
  fi
done

# Summary
echo ""
echo "=========================================="
echo "🎉 Batch $BATCH_NUM Complete!"
echo "=========================================="
echo "✅ Successful: $SUCCESSFUL"
echo "⚠️  Skipped: $SKIPPED"
echo "❌ Failed: $FAILED"
echo "📊 Total: $TOTAL"
echo ""
echo "Full log: $LOG_FILE"

echo "" >> "$LOG_FILE"
echo "=== Batch $BATCH_NUM Summary ===" >> "$LOG_FILE"
echo "✅ Successful: $SUCCESSFUL" >> "$LOG_FILE"
echo "⚠️  Skipped: $SKIPPED" >> "$LOG_FILE"
echo "❌ Failed: $FAILED" >> "$LOG_FILE"
echo "📊 Total: $TOTAL" >> "$LOG_FILE"
echo "=== Batch $BATCH_NUM Completed: $(date) ===" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

