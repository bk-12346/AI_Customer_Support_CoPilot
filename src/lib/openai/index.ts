/**
 * OpenAI Integration Module
 *
 * Provides a unified interface for OpenAI services:
 * - Chat completions (gpt-4o-mini, gpt-4o)
 * - Embeddings (text-embedding-3-small)
 * - Content moderation
 *
 * @example
 * ```typescript
 * import {
 *   generateCompletion,
 *   generateEmbedding,
 *   checkModeration
 * } from "@/lib/openai";
 *
 * // Generate a chat response
 * const response = await generateCompletion([
 *   { role: "system", content: "You are helpful." },
 *   { role: "user", content: "Hello!" }
 * ]);
 *
 * // Generate an embedding
 * const { embedding } = await generateEmbedding("Some text to embed");
 *
 * // Check content safety
 * const moderation = await checkModeration("User input");
 * ```
 */

// ===========================================
// Client & Configuration
// ===========================================
export {
  openai,
  getOpenAIClient,
  DEFAULT_MODEL,
  PREMIUM_MODEL,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  EXTENDED_MAX_TOKENS,
} from "./client";

// ===========================================
// Chat Completions
// ===========================================
export {
  generateCompletion,
  generateSimpleCompletion,
  generateCompletionStream,
  type ChatCompletionOptions,
  type ChatCompletionResult,
  type ChatCompletionMessageParam,
} from "./chat";

// ===========================================
// Embeddings
// ===========================================
export {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  type EmbeddingOptions,
  type EmbeddingResult,
} from "./embeddings";

// ===========================================
// Moderation
// ===========================================
export {
  checkModeration,
  isContentSafe,
  moderateConversation,
  getModerationDescription,
  type ModerationResult,
  type ExtendedModerationResult,
} from "./moderation";

// ===========================================
// Prompts
// ===========================================
export {
  SYSTEM_PROMPT,
  RAG_CONTEXT_PROMPT,
  LOW_CONFIDENCE_PROMPT,
} from "./prompts";
