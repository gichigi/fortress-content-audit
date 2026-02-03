#!/bin/bash
# API Integration Tests for Brand Voice Validation
# These tests would be run against a live API with valid auth token
#
# Usage:
#   export AUTH_TOKEN="your-bearer-token"
#   export API_BASE="http://localhost:3000"
#   bash test-brand-voice-api.sh
#
# OR check the curl commands below for manual testing

set -e

API_BASE="${API_BASE:-http://localhost:3000}"
TOKEN="${AUTH_TOKEN:-test-token}"
DOMAIN="example.com"

echo "🧪 BRAND VOICE API INTEGRATION TESTS"
echo "===================================="
echo ""
echo "API Base: $API_BASE"
echo "Token: ${TOKEN:0:20}..."
echo ""

# ============================================================================
# Test 1: Enum Validation - Invalid readability_level
# ============================================================================
echo "Test 1: Reject invalid readability_level"
echo "-----------------------------------------"
curl -X PUT "$API_BASE/api/brand-voice" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "'$DOMAIN'",
    "readability_level": "invalid_value",
    "formality": null,
    "locale": null,
    "flag_keywords": [],
    "ignore_keywords": []
  }' \
  | jq '.error' || true
echo ""

# ============================================================================
# Test 2: Enum Validation - Valid readability_level
# ============================================================================
echo "Test 2: Accept valid readability_level"
echo "--------------------------------------"
curl -X PUT "$API_BASE/api/brand-voice" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "'$DOMAIN'",
    "readability_level": "grade_6_8",
    "formality": "casual",
    "locale": "en-US",
    "flag_keywords": [],
    "ignore_keywords": []
  }' \
  | jq '.readability_level' || true
echo ""

# ============================================================================
# Test 3: Size Limits - voice_summary too long
# ============================================================================
echo "Test 3: Reject oversized voice_summary"
echo "--------------------------------------"
LONG_TEXT=$(python3 -c "print('a' * 10001)")
curl -X PUT "$API_BASE/api/brand-voice" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "'$DOMAIN'",
    "voice_summary": "'$LONG_TEXT'",
    "flag_keywords": [],
    "ignore_keywords": []
  }' \
  | jq '.error' || true
echo ""

# ============================================================================
# Test 4: Size Limits - Too many keywords
# ============================================================================
echo "Test 4: Reject too many keywords"
echo "--------------------------------"
KEYWORDS=$(python3 -c "import json; print(json.dumps(['kw'] * 51))")
curl -X PUT "$API_BASE/api/brand-voice" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "'$DOMAIN'",
    "flag_keywords": '$KEYWORDS',
    "ignore_keywords": []
  }' \
  | jq '.error' || true
echo ""

# ============================================================================
# Test 5: Domain Validation - Invalid domain
# ============================================================================
echo "Test 5: Reject invalid domain format"
echo "------------------------------------"
curl -X PUT "$API_BASE/api/brand-voice" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "invalid",
    "flag_keywords": [],
    "ignore_keywords": []
  }' \
  | jq '.error' || true
echo ""

# ============================================================================
# Test 6: Keyword Sanitization - newline in keyword
# ============================================================================
echo "Test 6: Reject keyword with newline"
echo "-----------------------------------"
curl -X PUT "$API_BASE/api/brand-voice" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "'$DOMAIN'",
    "flag_keywords": ["keyword\nwith\nnewline"],
    "ignore_keywords": []
  }' \
  | jq '.error' || true
echo ""

# ============================================================================
# Test 7: Bearer Token - Missing token
# ============================================================================
echo "Test 7: Reject missing Bearer token"
echo "----------------------------------"
curl -X PUT "$API_BASE/api/brand-voice" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "'$DOMAIN'",
    "flag_keywords": [],
    "ignore_keywords": []
  }' \
  | jq '.error' || true
echo ""

echo ""
echo "✅ API Integration Tests Complete"
echo "Note: To run these tests, start the dev server with: pnpm dev"
echo "Then export AUTH_TOKEN and run: bash test-brand-voice-api.sh"
