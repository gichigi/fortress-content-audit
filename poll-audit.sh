#!/bin/bash

RESPONSE_ID="resp_0ce790575edc72ff006945c659d5b881a1ac2f96497e7a44a5"
RUN_ID="e0a40e2f-ad55-4b99-88e9-41e77f3e1fe7"
SESSION_TOKEN="audit_1766180439614_q5jfoqxddve"

MAX_POLLS=60
POLL_COUNT=0

echo "Polling audit status every 15 seconds..."
echo "Response ID: $RESPONSE_ID"
echo ""

while [ $POLL_COUNT -lt $MAX_POLLS ]; do
  POLL_COUNT=$((POLL_COUNT + 1))
  TIMESTAMP=$(date '+%H:%M:%S')
  
  echo "[$TIMESTAMP] Poll #$POLL_COUNT..."
  
  RESULT=$(curl -s -X POST http://localhost:3000/api/audit/poll \
    -H "Content-Type: application/json" \
    -d "{\"responseId\":\"$RESPONSE_ID\",\"runId\":\"$RUN_ID\",\"session_token\":\"$SESSION_TOKEN\"}")
  
  STATUS=$(echo "$RESULT" | jq -r '.status // "unknown"')
  
  echo "Status: $STATUS"
  
  if [ "$STATUS" = "completed" ]; then
    echo ""
    echo "=== AUDIT COMPLETED ==="
    echo "$RESULT" | jq '{
      status,
      totalIssues,
      tier: .meta.tier,
      pagesScanned: .meta.pagesScanned,
      auditedUrls: .meta.auditedUrls,
      sampleIssues: .issues[0:3] | map({title, severity, category, locations: .locations | length})
    }'
    exit 0
  elif [ "$STATUS" = "in_progress" ]; then
    PAGES=$(echo "$RESULT" | jq -r '.progress.pagesScanned // 0')
    ISSUES=$(echo "$RESULT" | jq -r '.progress.issuesFound // 0')
    URLS=$(echo "$RESULT" | jq -r '.progress.auditedUrls // [] | length')
    echo "Progress: $PAGES pages scanned, $ISSUES issues found, $URLS URLs"
    
    # Show any events or updates
    if [ "$PAGES" != "0" ] || [ "$ISSUES" != "0" ] || [ "$URLS" != "0" ]; then
      echo "📊 Progress update detected!"
    fi
  else
    echo "Error or unknown status:"
    echo "$RESULT" | jq '.'
    exit 1
  fi
  
  echo ""
  sleep 15
done

echo "Timeout: Reached max polls ($MAX_POLLS)"
exit 1

