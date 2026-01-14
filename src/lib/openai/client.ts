import OpenAI from "openai";

/**
 * Validates that the OpenAI API key is configured
 * @throws Error if API key is missing
 */
function validateApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. " +
      "Please add it to your .env.local file. " +
      "Get your API key from: https://platform.openai.com/api-keys"
    );
  }

  if (!apiKey.startsWith("sk-")) {
    throw new Error(
      "OPENAI_API_KEY appears to be invalid. " +
      "OpenAI API keys should start with 'sk-'. " +
      "Please check your .env.local file."
    );
  }

  return apiKey;
}

/**
 * OpenAI client singleton
 * Initialized lazily to allow for environment validation
 */
let _openai: OpenAI | null = null;

/**
 * Get the OpenAI client instance
 * @returns Configured OpenAI client
 * @throws Error if API key is missing or invalid
 */
export function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const apiKey = validateApiKey();
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

/**
 * OpenAI client singleton (for backward compatibility)
 * Note: Prefer using getOpenAIClient() for better error handling
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===========================================
// Model Configuration Constants
// ===========================================

/** Default chat model - cost-effective for most use cases */
export const DEFAULT_MODEL = "gpt-4o-mini" as const;

/** Premium model for complex reasoning tasks */
export const PREMIUM_MODEL = "gpt-4o" as const;

/** Embedding model - 1536 dimensions */
export const EMBEDDING_MODEL = "text-embedding-3-small" as const;

/** Embedding dimensions for text-embedding-3-small */
export const EMBEDDING_DIMENSIONS = 1536;

// ===========================================
// Default Parameters
// ===========================================

/** Default temperature for chat completions (0-2, higher = more creative) */
export const DEFAULT_TEMPERATURE = 0.7;

/** Default max tokens for chat completions */
export const DEFAULT_MAX_TOKENS = 1024;

/** Max tokens for longer responses */
export const EXTENDED_MAX_TOKENS = 2048;
