import { getOpenAIClient, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from "./client";

/**
 * Options for embedding generation
 */
export interface EmbeddingOptions {
  /** Model to use (default: text-embedding-3-small) */
  model?: string;
  /** Number of dimensions (default: 1536) */
  dimensions?: number;
}

/**
 * Result of embedding generation
 */
export interface EmbeddingResult {
  /** The embedding vector */
  embedding: number[];
  /** Number of tokens used */
  tokensUsed: number;
  /** Model used for generation */
  model: string;
}

/**
 * Generate an embedding vector for the given text
 *
 * @param text - The text to generate an embedding for
 * @param options - Optional configuration
 * @returns Promise containing the embedding vector (1536 dimensions by default)
 * @throws Error if text is empty or API call fails
 *
 * @example
 * ```typescript
 * const { embedding } = await generateEmbedding("How do I reset my password?");
 * // embedding is a number[] with 1536 dimensions
 * ```
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<EmbeddingResult> {
  // Validate input
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const {
    model = EMBEDDING_MODEL,
    dimensions = EMBEDDING_DIMENSIONS,
  } = options;

  try {
    const openai = getOpenAIClient();

    const response = await openai.embeddings.create({
      model,
      input: text.trim(),
      dimensions,
    });

    const result = response.data[0];

    return {
      embedding: result.embedding,
      tokensUsed: response.usage.total_tokens,
      model: response.model,
    };
  } catch (error) {
    if (error instanceof Error) {
      // Enhance error message with context
      throw new Error(
        `Failed to generate embedding: ${error.message}. ` +
        `Text length: ${text.length} chars. Model: ${model}`
      );
    }
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 *
 * @param texts - Array of texts to generate embeddings for
 * @param options - Optional configuration
 * @returns Promise containing array of embedding vectors
 * @throws Error if any text is empty or API call fails
 *
 * @example
 * ```typescript
 * const embeddings = await generateEmbeddings([
 *   "How do I reset my password?",
 *   "What are your business hours?"
 * ]);
 * ```
 */
export async function generateEmbeddings(
  texts: string[],
  options: EmbeddingOptions = {}
): Promise<EmbeddingResult[]> {
  // Validate inputs
  if (!texts || texts.length === 0) {
    throw new Error("Cannot generate embeddings for empty array");
  }

  const emptyIndex = texts.findIndex(t => !t || t.trim().length === 0);
  if (emptyIndex !== -1) {
    throw new Error(`Cannot generate embedding for empty text at index ${emptyIndex}`);
  }

  const {
    model = EMBEDDING_MODEL,
    dimensions = EMBEDDING_DIMENSIONS,
  } = options;

  try {
    const openai = getOpenAIClient();

    const response = await openai.embeddings.create({
      model,
      input: texts.map(t => t.trim()),
      dimensions,
    });

    // Calculate tokens per embedding (approximate)
    const tokensPerEmbedding = Math.floor(response.usage.total_tokens / texts.length);

    return response.data.map((result) => ({
      embedding: result.embedding,
      tokensUsed: tokensPerEmbedding,
      model: response.model,
    }));
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to generate embeddings: ${error.message}. ` +
        `Batch size: ${texts.length}. Model: ${model}`
      );
    }
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 *
 * @param a - First embedding vector
 * @param b - Second embedding vector
 * @returns Similarity score between -1 and 1 (1 = identical)
 * @throws Error if vectors have different dimensions
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Embedding dimensions must match. Got ${a.length} and ${b.length}`
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}
