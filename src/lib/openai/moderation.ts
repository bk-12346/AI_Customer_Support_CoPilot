import { getOpenAIClient } from "./client";

/**
 * Moderation check result
 */
export interface ModerationResult {
  /** Whether the content was flagged as potentially harmful */
  flagged: boolean;
  /** Categories that were flagged (true = flagged) */
  categories: Record<string, boolean>;
  /** Confidence scores for each category (0-1) */
  categoryScores: Record<string, number>;
}

/**
 * Extended moderation result with additional metadata
 */
export interface ExtendedModerationResult extends ModerationResult {
  /** List of category names that were flagged */
  flaggedCategories: string[];
  /** Highest category score */
  maxScore: number;
  /** Category with highest score */
  maxScoreCategory: string | null;
}

/**
 * Check content against OpenAI's moderation endpoint
 *
 * @param text - The text to check for policy violations
 * @returns Promise containing moderation results
 * @throws Error if text is empty or API call fails
 *
 * @example
 * ```typescript
 * const result = await checkModeration("Some user input");
 * if (result.flagged) {
 *   console.log("Content flagged:", result.flaggedCategories);
 * }
 * ```
 */
export async function checkModeration(text: string): Promise<ExtendedModerationResult> {
  // Validate input
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot moderate empty text");
  }

  try {
    const openai = getOpenAIClient();

    const response = await openai.moderations.create({
      input: text.trim(),
    });

    const result = response.results[0];

    // Extract flagged categories
    const flaggedCategories = Object.entries(result.categories)
      .filter(([, flagged]) => flagged)
      .map(([category]) => category);

    // Find highest scoring category
    let maxScore = 0;
    let maxScoreCategory: string | null = null;

    for (const [category, score] of Object.entries(result.category_scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxScoreCategory = category;
      }
    }

    return {
      flagged: result.flagged,
      categories: result.categories as Record<string, boolean>,
      categoryScores: result.category_scores as Record<string, number>,
      flaggedCategories,
      maxScore,
      maxScoreCategory,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to check moderation: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Check if content is safe (not flagged)
 * Convenience wrapper around checkModeration
 *
 * @param text - The text to check
 * @returns Promise<boolean> - true if safe, false if flagged
 *
 * @example
 * ```typescript
 * if (await isContentSafe(userInput)) {
 *   // Process the input
 * } else {
 *   // Reject the input
 * }
 * ```
 */
export async function isContentSafe(text: string): Promise<boolean> {
  const result = await checkModeration(text);
  return !result.flagged;
}

/**
 * Moderate both input and output content
 * Useful for checking user input and AI-generated responses
 *
 * @param input - The user's input text
 * @param output - The AI-generated output text
 * @returns Promise containing moderation results for both
 *
 * @example
 * ```typescript
 * const result = await moderateConversation(userMessage, aiResponse);
 * if (!result.safe) {
 *   console.log("Issues found:", {
 *     inputIssues: result.inputResult.flaggedCategories,
 *     outputIssues: result.outputResult.flaggedCategories
 *   });
 * }
 * ```
 */
export async function moderateConversation(
  input: string,
  output: string
): Promise<{
  inputResult: ExtendedModerationResult;
  outputResult: ExtendedModerationResult;
  inputSafe: boolean;
  outputSafe: boolean;
  safe: boolean;
}> {
  const [inputResult, outputResult] = await Promise.all([
    checkModeration(input),
    checkModeration(output),
  ]);

  return {
    inputResult,
    outputResult,
    inputSafe: !inputResult.flagged,
    outputSafe: !outputResult.flagged,
    safe: !inputResult.flagged && !outputResult.flagged,
  };
}

/**
 * Get a human-readable description of moderation flags
 *
 * @param result - The moderation result
 * @returns Human-readable description of issues found
 */
export function getModerationDescription(result: ExtendedModerationResult): string {
  if (!result.flagged) {
    return "Content passed moderation checks.";
  }

  const issues = result.flaggedCategories
    .map(cat => cat.replace(/_/g, " ").replace(/\//g, " / "))
    .join(", ");

  return `Content flagged for: ${issues}`;
}
