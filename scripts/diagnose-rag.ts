/**
 * RAG Diagnostic Script
 *
 * Diagnoses retrieval issues by testing queries against the knowledge base
 * with different similarity thresholds and analyzing coverage.
 *
 * Usage:
 *   npx tsx scripts/diagnose-rag.ts
 *   pnpm diagnose-rag
 */

import * as dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/**
 * IMPORTANT:
 * Load dotenv BEFORE importing app modules that read env vars at import time.
 * We use a dynamic import for embeddings to avoid OpenAI client initialization
 * happening before dotenv runs.
 */
async function loadEmbeddingModule() {
  const mod = await import("../src/lib/openai/embeddings");
  return { generateEmbedding: mod.generateEmbedding };
}

// ===========================================
// Types
// ===========================================

interface KBArticle {
  id: string;
  title: string;
  content: string;
  source: string;
  created_at: string;
}

interface SearchResult {
  id: string;
  title: string;
  similarity: number;
}

interface ThresholdResult {
  threshold: number;
  matchCount: number;
  topResults: SearchResult[];
}

interface QueryCoverageResult {
  query: string;
  bestMatch: SearchResult | null;
  matchCount: number;
}

// ===========================================
// Configuration
// ===========================================

/** Default organization ID from seeding */
const DEFAULT_ORG_ID = "0a2cf873-9887-4a5c-9544-29b036e8fac5";

/** Thresholds to test */
const THRESHOLDS_TO_TEST = [0.3, 0.4, 0.5, 0.6, 0.7];

/** Test queries for coverage analysis */
const TEST_QUERIES = [
  "cancel order",
  "modify purchase",
  "change my order",
  "refund request",
  "reset password",
  "shipping status",
  "billing problem",
  "account locked",
  "return item",
  "contact support",
];

/** Primary test query for threshold analysis */
const PRIMARY_TEST_QUERY = "how do I cancel my order";

// ===========================================
// Supabase Client
// ===========================================

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "Missing Supabase environment variables. " +
        "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
      );
    }

    _supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return _supabaseAdmin;
}

// ===========================================
// KB Article Analysis
// ===========================================

/**
 * Get all KB articles for an organization
 */
async function getKBArticles(organizationId: string): Promise<KBArticle[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("knowledge_articles")
    .select("id, title, content, source, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch KB articles: ${error.message}`);
  }

  return (data || []) as KBArticle[];
}

/**
 * Analyze KB article coverage
 */
function analyzeKBCoverage(articles: KBArticle[]): {
  total: number;
  sources: Record<string, number>;
  sampleTitles: string[];
} {
  const sources: Record<string, number> = {};

  for (const article of articles) {
    // Count by source
    sources[article.source] = (sources[article.source] || 0) + 1;
  }

  return {
    total: articles.length,
    sources,
    sampleTitles: articles.slice(0, 10).map((a) => a.title),
  };
}

// ===========================================
// Vector Search
// ===========================================

/**
 * Search KB with a specific threshold (direct implementation)
 */
async function searchWithThreshold(
  queryEmbedding: number[],
  organizationId: string,
  threshold: number,
  limit: number = 10
): Promise<SearchResult[]> {
  const supabase = getSupabaseAdmin();

  try {
    const { data, error } = await supabase.rpc("match_knowledge", {
      query_embedding: queryEmbedding as unknown as string,
      match_threshold: threshold,
      match_count: limit,
      org_id: organizationId,
    });

    if (error) {
      // If the RPC function doesn't exist, we'll return empty
      console.warn(`  Warning: match_knowledge RPC error: ${error.message}`);
      return [];
    }

    return (data || []).map((item: { id: string; title: string; similarity: number }) => ({
      id: item.id,
      title: item.title,
      similarity: item.similarity,
    }));
  } catch {
    return [];
  }
}

/**
 * Test query at multiple thresholds
 */
async function testThresholds(
  query: string,
  organizationId: string
): Promise<ThresholdResult[]> {
  const { generateEmbedding } = await loadEmbeddingModule();
  console.log(`\nGenerating embedding for: "${query}"...`);
  const { embedding } = await generateEmbedding(query);

  const results: ThresholdResult[] = [];

  for (const threshold of THRESHOLDS_TO_TEST) {
    process.stdout.write(`  Testing threshold ${threshold}... `);

    const matches = await searchWithThreshold(
      embedding,
      organizationId,
      threshold,
      5
    );

    results.push({
      threshold,
      matchCount: matches.length,
      topResults: matches,
    });

    console.log(`${matches.length} matches`);
  }

  return results;
}

/**
 * Test multiple queries for coverage
 */
async function testQueryCoverage(
  queries: string[],
  organizationId: string,
  threshold: number = 0.4
): Promise<QueryCoverageResult[]> {
  const { generateEmbedding } = await loadEmbeddingModule();
  const results: QueryCoverageResult[] = [];

  for (const query of queries) {
    process.stdout.write(`  "${query}"... `);

    try {
      const { embedding } = await generateEmbedding(query);

      // First try at the given threshold
      const matches = await searchWithThreshold(
        embedding,
        organizationId,
        threshold,
        1
      );

      let bestMatch = matches.length > 0 ? matches[0] : null;
      let belowThreshold = false;

      // If no match at threshold, try at 0.1 to see actual best score
      if (!bestMatch) {
        const lowThresholdMatches = await searchWithThreshold(
          embedding,
          organizationId,
          0.1,
          1
        );
        if (lowThresholdMatches.length > 0) {
          bestMatch = lowThresholdMatches[0];
          belowThreshold = true;
        }
      }

      results.push({
        query,
        bestMatch: belowThreshold ? null : bestMatch, // Only count as match if above threshold
        matchCount: matches.length,
      });

      if (bestMatch) {
        if (belowThreshold) {
          console.log(`→ BELOW THRESHOLD: "${truncate(bestMatch.title, 30)}" (${bestMatch.similarity.toFixed(3)})`);
        } else {
          console.log(`→ "${truncate(bestMatch.title, 40)}" (${bestMatch.similarity.toFixed(3)})`);
        }
      } else {
        console.log("→ No match at all");
      }
    } catch (error) {
      console.log(`→ Error: ${error}`);
      results.push({
        query,
        bestMatch: null,
        matchCount: 0,
      });
    }
  }

  return results;
}

// ===========================================
// Output Formatting
// ===========================================

/**
 * Print KB coverage analysis
 */
function printKBCoverage(coverage: ReturnType<typeof analyzeKBCoverage>): void {
  console.log("\nKB Article Coverage:");
  console.log(`  Total articles: ${coverage.total}`);

  if (Object.keys(coverage.sources).length > 0) {
    console.log("\n  By source:");
    for (const [source, count] of Object.entries(coverage.sources)) {
      console.log(`    - ${source}: ${count}`);
    }
  }

  if (coverage.sampleTitles.length > 0) {
    console.log("\n  Sample titles:");
    for (const title of coverage.sampleTitles) {
      console.log(`    - "${truncate(title, 60)}"`);
    }
  }
}

/**
 * Print threshold analysis results
 */
function printThresholdAnalysis(
  query: string,
  results: ThresholdResult[]
): void {
  console.log(`\nThreshold Analysis for "${query}":`);

  for (const result of results) {
    const { threshold, matchCount, topResults } = result;

    if (matchCount === 0) {
      console.log(`  At ${threshold}: ${matchCount} matches`);
    } else {
      const best = topResults[0];
      console.log(
        `  At ${threshold}: ${matchCount} match${matchCount > 1 ? "es" : ""} ` +
        `(best: "${truncate(best.title, 35)}" @ ${best.similarity.toFixed(3)})`
      );
    }
  }

  // Show detailed results at lowest threshold
  const lowestThreshold = results[0];
  if (lowestThreshold.matchCount > 0) {
    console.log(`\n  Top 5 results at threshold ${lowestThreshold.threshold}:`);
    for (let i = 0; i < Math.min(5, lowestThreshold.topResults.length); i++) {
      const result = lowestThreshold.topResults[i];
      console.log(
        `    ${i + 1}. "${truncate(result.title, 50)}" (${result.similarity.toFixed(3)})`
      );
    }
  }
}

/**
 * Print query coverage summary
 */
function printQueryCoverage(
  results: QueryCoverageResult[],
  threshold: number
): void {
  console.log(`\nQuery Coverage Test (threshold ${threshold}):`);

  const matched = results.filter((r) => r.bestMatch !== null);
  const unmatched = results.filter((r) => r.bestMatch === null);

  console.log(`  Matched: ${matched.length}/${results.length}`);
  console.log(`  Unmatched: ${unmatched.length}/${results.length}`);

  if (unmatched.length > 0) {
    console.log("\n  Queries with no match:");
    for (const result of unmatched) {
      console.log(`    - "${result.query}"`);
    }
  }

  // Calculate average similarity for matched queries
  if (matched.length > 0) {
    const avgSimilarity =
      matched.reduce((sum, r) => sum + (r.bestMatch?.similarity || 0), 0) /
      matched.length;
    console.log(`\n  Average similarity of matches: ${avgSimilarity.toFixed(3)}`);
  }
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

// ===========================================
// Main Entry Point
// ===========================================

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("RAG Diagnostic Report");
  console.log("=".repeat(60));
  console.log(`\nOrganization ID: ${DEFAULT_ORG_ID}`);
  console.log(`Test time: ${new Date().toISOString()}`);

  // Check environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error("\nERROR: OPENAI_API_KEY environment variable is not set");
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("\nERROR: Supabase environment variables not set");
    console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  try {
    // Step 1: Analyze KB coverage
    console.log("\n" + "-".repeat(60));
    console.log("Step 1: KB Article Coverage");
    console.log("-".repeat(60));

    const articles = await getKBArticles(DEFAULT_ORG_ID);
    const coverage = analyzeKBCoverage(articles);
    printKBCoverage(coverage);

    if (coverage.total === 0) {
      console.log("\n⚠️  WARNING: No KB articles found in database!");
      console.log("   Run 'pnpm seed-kb' to populate the knowledge base.");
      console.log("\n" + "=".repeat(60));
      return;
    }

    // Step 2: Threshold analysis
    console.log("\n" + "-".repeat(60));
    console.log("Step 2: Threshold Analysis");
    console.log("-".repeat(60));

    const thresholdResults = await testThresholds(
      PRIMARY_TEST_QUERY,
      DEFAULT_ORG_ID
    );
    printThresholdAnalysis(PRIMARY_TEST_QUERY, thresholdResults);

    // Step 3: Query coverage test
    console.log("\n" + "-".repeat(60));
    console.log("Step 3: Query Coverage Test");
    console.log("-".repeat(60));

    console.log("\nTesting queries at threshold 0.4:");
    const coverageResults = await testQueryCoverage(
      TEST_QUERIES,
      DEFAULT_ORG_ID,
      0.4
    );
    printQueryCoverage(coverageResults, 0.4);

    // Summary and recommendations
    console.log("\n" + "=".repeat(60));
    console.log("Recommendations");
    console.log("=".repeat(60));

    const bestThreshold = thresholdResults.find((r) => r.matchCount > 0);
    const matchedQueries = coverageResults.filter((r) => r.bestMatch !== null).length;

    if (!bestThreshold) {
      console.log("\n⚠️  No matches found at any threshold!");
      console.log("   This could indicate:");
      console.log("   - KB articles don't have embeddings");
      console.log("   - The match_knowledge RPC function doesn't exist");
      console.log("   - Organization ID mismatch");
    } else {
      console.log(`\n✓ Best performing threshold: ${bestThreshold.threshold}`);
      console.log(`  Found ${bestThreshold.matchCount} matches`);

      if (bestThreshold.threshold < 0.4) {
        console.log("\n⚠️  Consider lowering default threshold");
        console.log("   Current default is 0.4, but best results at " +
          bestThreshold.threshold);
      }
    }

    console.log(`\n✓ Query coverage: ${matchedQueries}/${TEST_QUERIES.length} queries matched`);

    if (matchedQueries < TEST_QUERIES.length * 0.5) {
      console.log("\n⚠️  Low query coverage detected");
      console.log("   Consider adding more KB articles for common queries");
    }

    console.log("\n" + "=".repeat(60));
  } catch (error) {
    console.error("\nFatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
main();
