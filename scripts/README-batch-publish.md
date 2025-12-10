# Batch Publishing Script

Automated batch publisher for blog posts with rate limiting, error handling, and progress tracking.

## Quick Start

```bash
# Test run (doesn't publish)
./scripts/batch-publish.sh 1 --dry-run

# Publish Batch 1 with default 3-second delay
./scripts/batch-publish.sh 1

# Publish with custom delay (5 seconds between posts)
./scripts/batch-publish.sh 1 --delay=5
```

## Usage

```bash
./scripts/batch-publish.sh [batch-number] [options]
```

### Batch Numbers
- `1` - Launch Hubs & Core Definitions
- `2` - Templates & Documentation  
- `3` - Examples & Comparisons
- `4` - Brand Breakdowns & Strategy
- `5` - Channel & Support Intents

### Options
- `--dry-run` - Test mode: generates posts but sets `publish=false`
- `--delay=N` - Delay between posts in seconds (default: 3)

## Features

✅ **Rate Limiting** - Configurable delay between API calls  
✅ **Error Handling** - Continues on individual failures  
✅ **Duplicate Detection** - Skips posts with existing slugs  
✅ **Progress Tracking** - Logs to `scripts/batch-publish.log`  
✅ **Session Management** - Handles authentication automatically  

## How It Works

1. **Extracts Topics** - Reads from `content-batch-plan.md` (preferred) or `batch-publishing-plan.md` (fallback)
2. **Authenticates** - Logs in using `ADMIN_BLOG_PASSWORD` from `.env`
3. **Generates Posts** - Calls `/api/blog/generate` for each topic
4. **Tracks Progress** - Logs success/failure/skip for each post
5. **Rate Limits** - Waits between requests to avoid API overload

## Output

- **Console** - Real-time progress and summary
- **Log File** - Detailed log at `scripts/batch-publish.log`

## Example Output

```
🔐 Logging in...
✅ Login successful
📋 Extracting topics for Batch 1...
✅ Found 10 topics

[1/10] Processing: "Tone of Voice: What It Is, Why It Matters..."
  ✅ Success: Tone of Voice: What It Is, Why It Matters...
  🔗 Slug: tone-of-voice-what-it-is-why-it-matters
  ⏳ Waiting 3 seconds...

[2/10] Processing: "Brand Voice 101: Build a Standout Voice..."
  ✅ Success: Brand Voice 101: Build a Standout Voice...
  🔗 Slug: brand-voice-101-build-a-standout-voice
  ⏳ Waiting 3 seconds...

...

==========================================
🎉 Batch 1 Complete!
==========================================
✅ Successful: 10
⚠️  Skipped: 0
❌ Failed: 0
📊 Total: 10
```

## Troubleshooting

**No topics found**
- Check that `content-batch-plan.md` or `batch-publishing-plan.md` exists
- Verify batch number matches the plan file format

**Login failed**
- Ensure `ADMIN_BLOG_PASSWORD` is set in `.env`
- Check that dev server is running on `localhost:3000`

**API errors**
- Check OpenAI API key is set
- Verify Supabase credentials
- Check network connectivity

**Duplicate slugs**
- Script automatically skips duplicates
- Check log file for details

## Related Files

See `scripts/BATCH_PUBLISHING_FILES.md` for complete list of related files.

