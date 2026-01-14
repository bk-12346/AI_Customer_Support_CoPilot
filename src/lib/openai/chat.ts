import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  getOpenAIClient,
  DEFAULT_MODEL,
  PREMIUM_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
} from "./client";

/**
 * Options for chat completion
 */
export interface ChatCompletionOptions {
  /** Model to use (default: gpt-4o-mini) */
  model?: string;
  /** Temperature for response randomness (0-2, default: 0.7) */
  temperature?: number;
  /** Maximum tokens in response (default: 1024) */
  maxTokens?: number;
  /** Use premium model (gpt-4o) for complex tasks */
  usePremiumModel?: boolean;
}

/**
 * Result of chat completion
 */
export interface ChatCompletionResult {
  /** The generated response content */
  content: string;
  /** Reason the completion finished */
  finishReason: string | null;
  /** Number of prompt tokens used */
  promptTokens: number;
  /** Number of completion tokens used */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
  /** Model used for generation */
  model: string;
}

/**
 * Generate a chat completion response
 *
 * @param messages - Array of chat messages (system, user, assistant)
 * @param options - Optional configuration
 * @returns Promise containing the generated response
 * @throws Error if messages are empty or API call fails
 *
 * @example
 * ```typescript
 * const result = await generateCompletion([
 *   { role: "system", content: "You are a helpful assistant." },
 *   { role: "user", content: "How do I reset my password?" }
 * ]);
 * console.log(result.content);
 * ```
 */
export async function generateCompletion(
  messages: ChatCompletionMessageParam[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  // Validate input
  if (!messages || messages.length === 0) {
    throw new Error("Messages array cannot be empty");
  }

  const {
    model = options.usePremiumModel ? PREMIUM_MODEL : DEFAULT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = options;

  try {
    const openai = getOpenAIClient();

    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const choice = response.choices[0];
    const content = choice.message.content || "";

    return {
      content,
      finishReason: choice.finish_reason,
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
      model: response.model,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to generate completion: ${error.message}. ` +
        `Model: ${model}, Messages: ${messages.length}`
      );
    }
    throw error;
  }
}

/**
 * Generate a simple completion from a single prompt
 * Convenience wrapper around generateCompletion
 *
 * @param prompt - The user prompt
 * @param systemPrompt - Optional system prompt
 * @param options - Optional configuration
 * @returns Promise containing the generated response string
 *
 * @example
 * ```typescript
 * const response = await generateSimpleCompletion(
 *   "What is the capital of France?",
 *   "You are a geography expert."
 * );
 * console.log(response); // "The capital of France is Paris."
 * ```
 */
export async function generateSimpleCompletion(
  prompt: string,
  systemPrompt?: string,
  options: ChatCompletionOptions = {}
): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({ role: "user", content: prompt });

  const result = await generateCompletion(messages, options);
  return result.content;
}

/**
 * Generate a completion with streaming (returns async generator)
 *
 * @param messages - Array of chat messages
 * @param options - Optional configuration
 * @returns Async generator yielding content chunks
 *
 * @example
 * ```typescript
 * for await (const chunk of generateCompletionStream(messages)) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export async function* generateCompletionStream(
  messages: ChatCompletionMessageParam[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  // Validate input
  if (!messages || messages.length === 0) {
    throw new Error("Messages array cannot be empty");
  }

  const {
    model = options.usePremiumModel ? PREMIUM_MODEL : DEFAULT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = options;

  try {
    const openai = getOpenAIClient();

    const stream = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to generate streaming completion: ${error.message}. ` +
        `Model: ${model}`
      );
    }
    throw error;
  }
}

// Re-export message type for convenience
export type { ChatCompletionMessageParam };
