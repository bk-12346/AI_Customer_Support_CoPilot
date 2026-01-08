import OpenAI from "openai";

/**
 * OpenAI client singleton
 * Uses GPT-4o as specified in MVP scope
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Default model configuration
 */
export const DEFAULT_MODEL = "gpt-4o" as const;
export const DEFAULT_TEMPERATURE = 0.7;
export const MAX_TOKENS = 1024;
