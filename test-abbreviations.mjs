import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testStyleGuideRules() {
  console.log("=== Testing 4o style guide rule generation ===\n");
  
  const prompt = `Create 3 writing style rules for FoodieHub (a restaurant platform).

Rules to create:
1. Abbreviated Words
2. Acronyms
3. Active vs. Passive Voice

For each rule, provide:
- Category name
- Short description (8-12 words)
- Good example (✅)
- Bad example (❌)

The Good and Bad examples should show THE SAME CONTENT, just done correctly vs incorrectly.

Format:
### 1. Category Name
Description here.
✅ Good example
❌ Bad example`;

  console.log("Prompt:\n", prompt, "\n\n");
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500
  });
  
  console.log("Response:\n", response.choices[0].message.content);
}

testStyleGuideRules().catch(console.error);

