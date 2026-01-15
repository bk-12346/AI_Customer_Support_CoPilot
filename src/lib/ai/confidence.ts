/**
 * Confidence Scoring System
 *
 * Provides multi-factor confidence scoring for AI-generated draft responses.
 * Uses weighted factors to produce an interpretable confidence score.
 *
 * Factors considered:
 * - Source relevance: How similar are the retrieved sources to the query
 * - Source coverage: How many relevant sources were found
 * - Query clarity: How clear and specific is the customer query
 * - Context match: How well the best source matches the query
 *
 * @example
 * ```typescript
 * import { calculateConfidence } from "@/lib/ai/confidence";
 *
 * const result = calculateConfidence({
 *   sources: [{ similarity: 0.85 }, { similarity: 0.72 }],
 *   queryLength: 50,
 *   kbMatchCount: 2,
 *   ticketMatchCount: 1
 * });
 *
 * console.log(result.score);       // 0.78
 * console.log(result.level);       // "high"
 * console.log(result.explanation); // "High confidence: Strong matches..."
 * ```
 */

// ===========================================
// Configuration Constants
// ===========================================

/**
 * Weights for each confidence factor.
 * These can be tuned based on empirical testing.
 */
export const CONFIDENCE_WEIGHTS = {
  /** Weight for average source relevance (40%) */
  SOURCE_RELEVANCE: 0.4,
  /** Weight for source coverage (25%) */
  SOURCE_COVERAGE: 0.25,
  /** Weight for query clarity (15%) */
  QUERY_CLARITY: 0.15,
  /** Weight for context match (20%) */
  CONTEXT_MATCH: 0.2,
} as const;

/**
 * Thresholds for confidence levels
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Score >= HIGH_THRESHOLD is considered high confidence */
  HIGH: 0.75,
  /** Score >= MEDIUM_THRESHOLD is considered medium confidence */
  MEDIUM: 0.5,
} as const;

/**
 * Query length thresholds for clarity scoring
 */
const QUERY_LENGTH_THRESHOLDS = {
  /** Queries shorter than this are considered too brief */
  TOO_SHORT: 10,
  /** Optimal minimum query length */
  OPTIMAL_MIN: 20,
  /** Optimal maximum query length */
  OPTIMAL_MAX: 200,
  /** Queries longer than this may be unfocused */
  TOO_LONG: 500,
} as const;

/**
 * Number of sources considered "full coverage"
 */
const FULL_COVERAGE_SOURCE_COUNT = 5;

/**
 * Number of top sources to consider for relevance averaging
 */
const TOP_SOURCES_COUNT = 3;

// ===========================================
// Types
// ===========================================

/**
 * Individual factors contributing to confidence score
 */
export interface ConfidenceFactors {
  /** How relevant are the retrieved sources (avg similarity of top sources) */
  sourceRelevance: number;
  /** How many sources were found relative to ideal coverage */
  sourceCoverage: number;
  /** How clear and specific is the customer query */
  queryClarity: number;
  /** How well the best source matches the query */
  contextMatch: number;
}

/**
 * Complete confidence calculation result
 */
export interface ConfidenceResult {
  /** Final weighted confidence score (0-1) */
  score: number;
  /** Individual factor scores */
  factors: ConfidenceFactors;
  /** Human-readable confidence level */
  level: "high" | "medium" | "low";
  /** Human-readable explanation of the confidence */
  explanation: string;
}

/**
 * Parameters for confidence calculation
 */
export interface ConfidenceParams {
  /** Array of sources with their similarity scores */
  sources: Array<{ similarity: number }>;
  /** Length of the customer query in characters */
  queryLength: number;
  /** Number of knowledge base articles matched */
  kbMatchCount: number;
  /** Number of similar tickets matched */
  ticketMatchCount: number;
}

// ===========================================
// Main Functions
// ===========================================

/**
 * Calculate comprehensive confidence score for a draft response
 *
 * Uses multiple factors with configurable weights to produce a
 * final score that reflects the reliability of the generated response.
 *
 * @param params - Parameters for confidence calculation
 * @returns Complete confidence result with score, factors, level, and explanation
 *
 * @example
 * ```typescript
 * const result = calculateConfidence({
 *   sources: [{ similarity: 0.85 }, { similarity: 0.72 }, { similarity: 0.65 }],
 *   queryLength: 75,
 *   kbMatchCount: 2,
 *   ticketMatchCount: 1
 * });
 *
 * if (result.level === "low") {
 *   // Flag for human review
 * }
 * ```
 */
export function calculateConfidence(params: ConfidenceParams): ConfidenceResult {
  const { sources, queryLength, kbMatchCount, ticketMatchCount } = params;

  // Calculate individual factors
  const factors = calculateFactors(sources, queryLength, kbMatchCount, ticketMatchCount);

  // Calculate weighted final score
  const score = calculateWeightedScore(factors);

  // Determine confidence level
  const level = getConfidenceLevel(score);

  // Generate explanation
  const explanation = getConfidenceExplanation(factors, level);

  return {
    score,
    factors,
    level,
    explanation,
  };
}

/**
 * Determine confidence level from a score
 *
 * @param score - Confidence score (0-1)
 * @returns Confidence level: 'high', 'medium', or 'low'
 */
export function getConfidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) {
    return "high";
  }
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return "medium";
  }
  return "low";
}

/**
 * Generate human-readable explanation for confidence result
 *
 * @param factors - The calculated confidence factors
 * @param level - The confidence level
 * @returns Human-readable explanation string
 */
export function getConfidenceExplanation(
  factors: ConfidenceFactors,
  level: "high" | "medium" | "low"
): string {
  const explanations: string[] = [];

  // Analyze each factor and build explanation
  if (level === "high") {
    explanations.push("High confidence:");

    if (factors.sourceRelevance >= 0.7) {
      explanations.push("Strong matches found in knowledge base.");
    }
    if (factors.sourceCoverage >= 0.6) {
      explanations.push("Multiple relevant sources identified.");
    }
    if (factors.contextMatch >= 0.8) {
      explanations.push("Excellent context match for this query.");
    }
  } else if (level === "medium") {
    explanations.push("Medium confidence:");

    if (factors.sourceRelevance >= 0.5) {
      explanations.push("Partial matches found in sources.");
    } else {
      explanations.push("Limited source relevance.");
    }
    if (factors.sourceCoverage < 0.4) {
      explanations.push("Few sources available.");
    }
    if (factors.queryClarity < 0.5) {
      explanations.push("Query could be more specific.");
    }
  } else {
    explanations.push("Low confidence:");

    if (factors.sourceRelevance < 0.3) {
      explanations.push("No highly relevant sources found.");
    }
    if (factors.sourceCoverage === 0) {
      explanations.push("Response based on general knowledge only.");
    }
    if (factors.contextMatch < 0.3) {
      explanations.push("Context may not fully address the query.");
    }
    if (factors.queryClarity < 0.3) {
      explanations.push("Query is unclear or too brief.");
    }
  }

  // Add recommendation for low confidence
  if (level === "low") {
    explanations.push("Manual review recommended.");
  }

  return explanations.join(" ");
}

// ===========================================
// Internal Helper Functions
// ===========================================

/**
 * Calculate all confidence factors from input parameters
 *
 * @param sources - Array of sources with similarity scores
 * @param queryLength - Length of query in characters
 * @param kbMatchCount - Number of KB matches
 * @param ticketMatchCount - Number of ticket matches
 * @returns Calculated confidence factors
 */
function calculateFactors(
  sources: Array<{ similarity: number }>,
  queryLength: number,
  kbMatchCount: number,
  ticketMatchCount: number
): ConfidenceFactors {
  return {
    sourceRelevance: calculateSourceRelevance(sources),
    sourceCoverage: calculateSourceCoverage(kbMatchCount, ticketMatchCount),
    queryClarity: calculateQueryClarity(queryLength),
    contextMatch: calculateContextMatch(sources),
  };
}

/**
 * Calculate source relevance factor
 *
 * Averages the similarity scores of the top N sources.
 * Returns 0 if no sources are available.
 *
 * @param sources - Array of sources with similarity scores
 * @returns Source relevance score (0-1)
 */
function calculateSourceRelevance(sources: Array<{ similarity: number }>): number {
  // Handle empty sources
  if (!sources || sources.length === 0) {
    return 0;
  }

  // Sort by similarity (descending) and take top N
  const sortedSources = [...sources]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP_SOURCES_COUNT);

  // Calculate average similarity
  const totalSimilarity = sortedSources.reduce((sum, s) => sum + s.similarity, 0);
  const averageSimilarity = totalSimilarity / sortedSources.length;

  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, averageSimilarity));
}

/**
 * Calculate source coverage factor
 *
 * Measures how many sources were found relative to ideal coverage.
 * Full coverage is achieved at FULL_COVERAGE_SOURCE_COUNT sources.
 *
 * @param kbMatchCount - Number of knowledge base matches
 * @param ticketMatchCount - Number of similar ticket matches
 * @returns Source coverage score (0-1)
 */
function calculateSourceCoverage(kbMatchCount: number, ticketMatchCount: number): number {
  const totalSources = kbMatchCount + ticketMatchCount;

  // Handle no sources
  if (totalSources === 0) {
    return 0;
  }

  // Linear scaling up to full coverage, capped at 1
  const coverage = totalSources / FULL_COVERAGE_SOURCE_COUNT;

  return Math.min(1, coverage);
}

/**
 * Calculate query clarity factor
 *
 * Scores queries based on length:
 * - Very short (<10 chars): Low clarity (may be too vague)
 * - Short (10-20 chars): Medium-low clarity
 * - Optimal (20-200 chars): High clarity
 * - Long (200-500 chars): Slightly reduced clarity (may be unfocused)
 * - Very long (>500 chars): Lower clarity (likely contains multiple questions)
 *
 * @param queryLength - Length of query in characters
 * @returns Query clarity score (0-1)
 */
function calculateQueryClarity(queryLength: number): number {
  // Handle edge cases
  if (queryLength <= 0) {
    return 0;
  }

  const { TOO_SHORT, OPTIMAL_MIN, OPTIMAL_MAX, TOO_LONG } = QUERY_LENGTH_THRESHOLDS;

  if (queryLength < TOO_SHORT) {
    // Very short queries: low clarity (0.2-0.4)
    return 0.2 + (queryLength / TOO_SHORT) * 0.2;
  }

  if (queryLength < OPTIMAL_MIN) {
    // Short queries: medium-low clarity (0.4-0.7)
    const progress = (queryLength - TOO_SHORT) / (OPTIMAL_MIN - TOO_SHORT);
    return 0.4 + progress * 0.3;
  }

  if (queryLength <= OPTIMAL_MAX) {
    // Optimal length: high clarity (0.85-1.0)
    // Peak at around 50-100 chars, slight reduction at edges
    const midpoint = (OPTIMAL_MIN + OPTIMAL_MAX) / 2;
    const distanceFromMid = Math.abs(queryLength - midpoint);
    const maxDistance = (OPTIMAL_MAX - OPTIMAL_MIN) / 2;
    const peakBonus = (1 - distanceFromMid / maxDistance) * 0.15;
    return 0.85 + peakBonus;
  }

  if (queryLength <= TOO_LONG) {
    // Long queries: slightly reduced clarity (0.6-0.85)
    const progress = (queryLength - OPTIMAL_MAX) / (TOO_LONG - OPTIMAL_MAX);
    return 0.85 - progress * 0.25;
  }

  // Very long queries: lower clarity (0.4-0.6)
  // Further reduction for extremely long queries
  const excessLength = queryLength - TOO_LONG;
  const reduction = Math.min(0.2, excessLength / 1000 * 0.2);
  return Math.max(0.4, 0.6 - reduction);
}

/**
 * Calculate context match factor
 *
 * Returns the highest similarity score among all sources.
 * This indicates how well the best available context matches the query.
 *
 * @param sources - Array of sources with similarity scores
 * @returns Context match score (0-1)
 */
function calculateContextMatch(sources: Array<{ similarity: number }>): number {
  // Handle empty sources
  if (!sources || sources.length === 0) {
    return 0;
  }

  // Find the highest similarity score
  const maxSimilarity = Math.max(...sources.map((s) => s.similarity));

  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, maxSimilarity));
}

/**
 * Calculate weighted final score from factors
 *
 * Applies configured weights to each factor and sums them.
 *
 * @param factors - The calculated confidence factors
 * @returns Weighted confidence score (0-1)
 */
function calculateWeightedScore(factors: ConfidenceFactors): number {
  const score =
    factors.sourceRelevance * CONFIDENCE_WEIGHTS.SOURCE_RELEVANCE +
    factors.sourceCoverage * CONFIDENCE_WEIGHTS.SOURCE_COVERAGE +
    factors.queryClarity * CONFIDENCE_WEIGHTS.QUERY_CLARITY +
    factors.contextMatch * CONFIDENCE_WEIGHTS.CONTEXT_MATCH;

  // Clamp to 0-1 range (should already be in range, but ensure)
  return Math.max(0, Math.min(1, score));
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Check if a draft should be flagged for human review based on confidence
 *
 * @param result - Confidence calculation result
 * @returns True if the draft needs human review
 */
export function shouldFlagForReview(result: ConfidenceResult): boolean {
  // Flag if low confidence
  if (result.level === "low") {
    return true;
  }

  // Flag if no sources found
  if (result.factors.sourceCoverage === 0) {
    return true;
  }

  // Flag if query clarity is very low (might be misinterpreted)
  if (result.factors.queryClarity < 0.3) {
    return true;
  }

  return false;
}

/**
 * Get a brief confidence summary for display
 *
 * @param result - Confidence calculation result
 * @returns Brief summary string
 */
export function getConfidenceSummary(result: ConfidenceResult): string {
  const percentage = Math.round(result.score * 100);
  const levelEmoji =
    result.level === "high" ? "+" :
    result.level === "medium" ? "~" : "-";

  return `[${levelEmoji}] ${percentage}% confidence`;
}
