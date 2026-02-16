# LangSmith Integration - Setup Complete ✅

LangSmith tracing has been successfully integrated into your Fortress Content Audit application. All OpenAI API calls will now be automatically traced to LangSmith for monitoring, debugging, and optimization.

## What Was Implemented

### 1. **Installed LangSmith SDK**
```bash
pnpm add langsmith
```

### 2. **Created Centralized Traced OpenAI Client**
- **File**: `lib/langsmith-openai.ts`
- Wraps OpenAI client with LangSmith's `wrapOpenAI` function
- Automatically traces all API calls when tracing is enabled
- Supports all OpenAI client options (timeout, etc.)

### 3. **Updated All OpenAI Usage**
All files now use the traced OpenAI client:
- ✅ `lib/openai.ts` - Main OpenAI utilities
- ✅ `lib/audit.ts` - Content audit functions
- ✅ `lib/page-selector.ts` - Page selection logic
- ✅ `lib/brand-voice-audit.ts` - Brand voice auditing
- ✅ `app/api/extract-website/route.ts` - Website extraction API

### 4. **Environment Variables**
Added to `.env.local` and `.env.example`:
```bash
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_your_api_key_here
LANGSMITH_PROJECT=aicontentaudit
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
```

## How It Works

### Automatic Tracing
Every OpenAI API call is now automatically traced to LangSmith:
- **Inputs**: User prompts, system prompts, model parameters
- **Outputs**: Model responses, token usage, latency
- **Metadata**: Model name, temperature, max_tokens, etc.
- **Errors**: Failures and retry attempts

### Example Trace Structure
```
Root Trace: Content Audit Request
├─ Mini Audit (gpt-5.1-2025-11-13)
│  ├─ Token usage: 1,234 prompt + 567 completion
│  └─ Latency: 2.3s
├─ Brand Voice Extraction (gpt-4o)
│  ├─ Token usage: 890 prompt + 234 completion
│  └─ Latency: 1.2s
└─ Advanced Rules Generation (gpt-4o-mini)
   ├─ Token usage: 456 prompt + 123 completion
   └─ Latency: 0.8s
```

## Accessing Your Traces

1. **Visit LangSmith Dashboard**
   - Go to: https://smith.langchain.com
   - Login with your account

2. **Select Your Project**
   - Project name: `aicontentaudit`

3. **View Traces**
   - See all API calls in real-time
   - Filter by time, status, model, or custom metadata
   - Analyze token usage and costs
   - Debug errors and retries

## Enabling/Disabling Tracing

### To Enable Tracing (Currently Enabled)
```bash
# In .env.local
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=your-api-key
```

### To Disable Tracing
```bash
# In .env.local
LANGSMITH_TRACING=false
# or comment out the line
```

When disabled, the application works exactly as before with no tracing overhead.

## Advanced Usage

### Nested Tracing with Custom Functions
To add custom nested traces for your own functions:

```typescript
import { traceable } from "langsmith/traceable"
import { tracedOpenAI } from "@/lib/langsmith-openai"

const myCustomFunction = traceable(
  async (input: string) => {
    // This will appear as a nested trace in LangSmith
    const response = await tracedOpenAI.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: input }]
    })
    return response.choices[0].message.content
  },
  { name: "Custom Function Name" }
)
```

### Adding Custom Metadata to Traces
```typescript
import { traceable } from "langsmith/traceable"

const auditWithMetadata = traceable(
  async (domain: string, userId: string) => {
    // Function implementation
  },
  {
    name: "Audit Request",
    metadata: {
      feature: "content-audit",
      tier: "paid"
    }
  }
)
```

## Monitoring Key Metrics

### Token Usage & Costs
- View token consumption per request
- Track costs across different models
- Identify expensive operations

### Performance
- Monitor latency per API call
- Identify slow requests
- Optimize prompts for faster responses

### Error Tracking
- See all failed requests
- Debug retry attempts
- Track error patterns

## Best Practices

1. **Use Descriptive Trace Names**
   - Help identify operations in the dashboard
   - Makes debugging easier

2. **Add Relevant Metadata**
   - User IDs, domain names, audit types
   - Helps filter and analyze traces

3. **Monitor Regularly**
   - Check dashboard for anomalies
   - Track token usage trends
   - Optimize based on insights

4. **Set Up Alerts** (Optional)
   - LangSmith can alert on high token usage
   - Notify on error rate spikes
   - Track performance degradation

## Troubleshooting

### Traces Not Appearing in LangSmith

1. **Check Environment Variables**
   ```bash
   echo $LANGSMITH_TRACING
   echo $LANGSMITH_API_KEY
   ```

2. **Verify API Key**
   - Ensure API key is valid
   - Check project permissions

3. **Restart Development Server**
   ```bash
   pnpm dev
   ```

4. **Check Console Output**
   - Should see: `🔍 LangSmith tracing enabled`
   - Not: `⚠️ LangSmith tracing disabled`

### High Token Usage

- Use LangSmith to identify expensive operations
- Consider using cheaper models (gpt-4o-mini) where appropriate
- Optimize prompts to reduce token counts

### Performance Issues

- Check latency in LangSmith dashboard
- Identify slow API calls
- Consider caching frequently used results

## Next Steps

1. **Run Your App**
   ```bash
   pnpm dev
   ```

2. **Trigger Some API Calls**
   - Run a content audit
   - Generate brand voice suggestions
   - Extract website content

3. **View Traces**
   - Visit https://smith.langchain.com
   - Navigate to `aicontentaudit` project
   - Explore your traces!

## Resources

- **LangSmith Docs**: https://docs.smith.langchain.com
- **SDK Docs**: https://github.com/langchain-ai/langsmith-sdk
- **Dashboard**: https://smith.langchain.com

---

## Summary

✅ LangSmith SDK installed
✅ Traced OpenAI client created
✅ All OpenAI calls updated to use traced client
✅ Environment variables configured
✅ Build tested and passing

Your application is now fully instrumented with LangSmith tracing. All OpenAI API calls are automatically logged for monitoring, debugging, and optimization.
