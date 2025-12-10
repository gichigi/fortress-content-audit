import OpenAI from "openai";
import { config } from "dotenv";

// Load .env.local
config({ path: ".env.local" });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const result = await openai.responses.create({
  model: "gpt-5.1",
  input: "Write a haiku about code.",
  reasoning: { effort: "low" },
  text: { verbosity: "low" },
});

console.log(result.output_text);

