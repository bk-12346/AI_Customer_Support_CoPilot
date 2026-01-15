/**
 * Pipeline Integration Test Script
 *
 * Tests the complete AI draft generation pipeline:
 * 1. Input sanitization (prompt injection, PII detection)
 * 2. RAG context retrieval
 * 3. Draft generation
 * 4. Content moderation
 *
 * Usage:
 *   npx tsx scripts/test-pipeline.ts          # Default: 20 samples
 *   npx tsx scripts/test-pipeline.ts --quick  # Quick: 5 samples
 *   npx tsx scripts/test-pipeline.ts --full   # Full: all samples
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

/**
 * IMPORTANT:
 * This script must load dotenv BEFORE importing any app modules.
 * Some modules (e.g. OpenAI client) read env vars at import time.
 * Static ESM imports run before the module body, so we use dynamic imports below.
 */
type ProcessedInput = import("../src/lib/safety").ProcessedInput;
type DraftOutput = import("../src/lib/ai").DraftOutput;
type ExtendedModerationResult = import("../src/lib/openai/moderation").ExtendedModerationResult;

async function loadPipelineModules() {
  const safety = await import("../src/lib/safety");
  const ai = await import("../src/lib/ai");
  const moderation = await import("../src/lib/openai/moderation");

  return {
    processUserInput: safety.processUserInput,
    generateDraft: ai.generateDraft,
    checkModeration: moderation.checkModeration,
  };
}

// ===========================================
// Types
// ===========================================

interface TestResult {
  /** Original input */
  input: string;
  /** Sanitized input */
  sanitizedInput: string;
  /** PII-redacted input for logging */
  piiRedactedInput: string;
  /** Safety processing result */
  safetyResult: ProcessedInput;
  /** Generated draft (null if blocked or errored) */
  draft: DraftOutput | null;
  /** Moderation result (null if not run) */
  moderationResult: ExtendedModerationResult | null;
  /** Whether the test passed */
  passed: boolean;
  /** Error message if failed */
  error?: string;
  /** Timing information */
  timings: {
    sanitization: number;
    generation: number;
    moderation: number;
    total: number;
  };
}

interface EvaluationMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  blockedInputs: number;
  fallbackCount: number;
  fallbackRate: number;
  averageConfidence: number;
  averageGenerationTime: number;
  moderationFlags: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

interface EvaluationReport {
  timestamp: string;
  organizationId: string;
  sampleSize: number;
  metrics: EvaluationMetrics;
  results: TestResult[];
}

interface GoldSetItem {
  query: string;
  expectedIntent?: string;
  category?: string;
}

// ===========================================
// Configuration
// ===========================================

/** Default organization ID from seeding */
const DEFAULT_ORG_ID = "0a2cf873-9887-4a5c-9544-29b036e8fac5";

/** Default user ID for testing */
const DEFAULT_USER_ID = "test-user-001";

/** Sample test queries if gold-set is empty */
const SAMPLE_QUERIES: GoldSetItem[] = [
  { query: "How do I reset my password?", category: "account" },
  { query: "I can't log into my account, it says invalid credentials", category: "account" },
  { query: "What are your business hours?", category: "general" },
  { query: "I want to cancel my subscription", category: "billing" },
  { query: "My order hasn't arrived yet. Order #12345", category: "shipping" },
  { query: "How do I update my billing information?", category: "billing" },
  { query: "Is there a mobile app available?", category: "product" },
  { query: "I'm getting an error when trying to checkout", category: "technical" },
  { query: "Can I get a refund for my purchase?", category: "billing" },
  { query: "How do I change my email address?", category: "account" },
  { query: "The product I received is damaged", category: "shipping" },
  { query: "Do you offer discounts for bulk orders?", category: "sales" },
  { query: "I forgot my username", category: "account" },
  { query: "How long does shipping usually take?", category: "shipping" },
  { query: "My payment was declined but I was still charged", category: "billing" },
  { query: "Can I speak to a manager?", category: "escalation" },
  { query: "Your service is terrible, I want compensation", category: "complaint" },
  { query: "How do I export my data?", category: "technical" },
  { query: "Is my data secure with your service?", category: "security" },
  { query: "I need help setting up two-factor authentication", category: "security" },
  { query: "The website is very slow today", category: "technical" },
  { query: "Can I pause my subscription instead of canceling?", category: "billing" },
  { query: "I was charged twice for the same order", category: "billing" },
  { query: "How do I invite team members to my account?", category: "account" },
  { query: "What payment methods do you accept?", category: "billing" },
];

// ===========================================
// Main Functions
// ===========================================

/**
 * Test a single query through the complete pipeline
 */
async function testSingleQuery(
  query: string,
  organizationId: string,
  userId: string = DEFAULT_USER_ID
): Promise<TestResult> {
  const { processUserInput, generateDraft, checkModeration } = await loadPipelineModules();
  const startTime = Date.now();
  let sanitizationTime = 0;
  let generationTime = 0;
  let moderationTime = 0;

  // Step 1: Sanitize input
  const sanitizationStart = Date.now();
  const safetyResult = processUserInput(query);
  sanitizationTime = Date.now() - sanitizationStart;

  // Check if input should be blocked
  if (safetyResult.shouldBlock) {
    return {
      input: query,
      sanitizedInput: safetyResult.sanitized,
      piiRedactedInput: safetyResult.piiRedacted,
      safetyResult,
      draft: null,
      moderationResult: null,
      passed: false,
      error: `Input blocked due to high risk: ${safetyResult.flags.join(", ")}`,
      timings: {
        sanitization: sanitizationTime,
        generation: 0,
        moderation: 0,
        total: Date.now() - startTime,
      },
    };
  }

  // Step 2: Generate draft
  let draft: DraftOutput | null = null;
  try {
    const generationStart = Date.now();
    draft = await generateDraft({
      // Must be a UUID because RAG similar-tickets search expects a uuid ticket_id
      ticketId: randomUUID(),
      customerMessage: safetyResult.sanitized,
      organizationId,
      userId,
    });
    generationTime = Date.now() - generationStart;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      input: query,
      sanitizedInput: safetyResult.sanitized,
      piiRedactedInput: safetyResult.piiRedacted,
      safetyResult,
      draft: null,
      moderationResult: null,
      passed: false,
      error: `Generation failed: ${errorMessage}`,
      timings: {
        sanitization: sanitizationTime,
        generation: generationTime,
        moderation: 0,
        total: Date.now() - startTime,
      },
    };
  }

  // Step 3: Check moderation on output
  let moderationResult: ExtendedModerationResult | null = null;
  try {
    const moderationStart = Date.now();
    moderationResult = await checkModeration(draft.content);
    moderationTime = Date.now() - moderationStart;
  } catch (error) {
    // Moderation failure is not a test failure, just log it
    console.warn(`[Test] Moderation check failed: ${error}`);
  }

  const totalTime = Date.now() - startTime;

  return {
    input: query,
    sanitizedInput: safetyResult.sanitized,
    piiRedactedInput: safetyResult.piiRedacted,
    safetyResult,
    draft,
    moderationResult,
    passed: true,
    timings: {
      sanitization: sanitizationTime,
      generation: generationTime,
      moderation: moderationTime,
      total: totalTime,
    },
  };
}

/**
 * Run evaluation on the gold set
 */
async function runGoldSetEvaluation(
  organizationId: string,
  sampleSize?: number
): Promise<EvaluationReport> {
  // Load gold set or use samples
  let queries: GoldSetItem[] = [];

  try {
    const goldSetPath = path.join(process.cwd(), "data", "gold-set.json");
    const goldSetData = fs.readFileSync(goldSetPath, "utf-8");
    const parsed = JSON.parse(goldSetData);

    if (Array.isArray(parsed) && parsed.length > 0) {
      queries = parsed.map((item: unknown) => {
        if (typeof item === "string") {
          return { query: item };
        }
        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>;
          return {
            query: String(obj.query || obj.question || obj.input || ""),
            category: obj.category ? String(obj.category) : undefined,
            expectedIntent: obj.expectedIntent ? String(obj.expectedIntent) : undefined,
          };
        }
        return { query: String(item) };
      }).filter((item: GoldSetItem) => item.query.length > 0);
    }
  } catch {
    console.log("[Test] Gold set not found or empty, using sample queries");
  }

  // Use sample queries if gold set is empty
  if (queries.length === 0) {
    queries = SAMPLE_QUERIES;
  }

  // Apply sample size limit
  const effectiveSampleSize = sampleSize || Math.min(20, queries.length);
  const selectedQueries = queries.slice(0, effectiveSampleSize);

  console.log("\n" + "=".repeat(60));
  console.log("Pipeline Integration Test");
  console.log("=".repeat(60));
  console.log(`\nOrganization ID: ${organizationId}`);
  console.log(`Total queries available: ${queries.length}`);
  console.log(`Running tests on: ${selectedQueries.length} samples\n`);

  const results: TestResult[] = [];
  const metrics: EvaluationMetrics = {
    totalTests: selectedQueries.length,
    passedTests: 0,
    failedTests: 0,
    blockedInputs: 0,
    fallbackCount: 0,
    fallbackRate: 0,
    averageConfidence: 0,
    averageGenerationTime: 0,
    moderationFlags: 0,
    confidenceDistribution: { high: 0, medium: 0, low: 0 },
  };

  let totalConfidence = 0;
  let totalGenerationTime = 0;
  let confidenceCount = 0;

  // Run tests
  for (let i = 0; i < selectedQueries.length; i++) {
    const item = selectedQueries[i];
    const testNum = i + 1;

    console.log(`[Test ${testNum}/${selectedQueries.length}]`);
    console.log(`Input: "${truncateString(item.query, 60)}"`);

    try {
      const result = await testSingleQuery(item.query, organizationId);
      results.push(result);

      // Update metrics
      if (result.passed) {
        metrics.passedTests++;

        if (result.draft) {
          // Track confidence
          totalConfidence += result.draft.confidenceScore;
          confidenceCount++;

          // Track confidence distribution
          if (result.draft.confidenceLevel === "high") {
            metrics.confidenceDistribution.high++;
          } else if (result.draft.confidenceLevel === "medium") {
            metrics.confidenceDistribution.medium++;
          } else {
            metrics.confidenceDistribution.low++;
          }

          // Track fallbacks
          if (result.draft.isFallback) {
            metrics.fallbackCount++;
          }

          // Track moderation flags
          if (result.moderationResult?.flagged) {
            metrics.moderationFlags++;
          }
        }

        // Track generation time
        totalGenerationTime += result.timings.generation;
      } else {
        metrics.failedTests++;
        if (result.safetyResult.shouldBlock) {
          metrics.blockedInputs++;
        }
      }

      // Print result summary
      printTestResult(result, testNum);

    } catch (error) {
      console.error(`  ERROR: ${error}`);
      metrics.failedTests++;
      results.push({
        input: item.query,
        sanitizedInput: item.query,
        piiRedactedInput: item.query,
        safetyResult: {
          sanitized: item.query,
          piiRedacted: item.query,
          hasPII: false,
          piiTypes: [],
          riskLevel: "none",
          flags: [],
          wasModified: false,
          shouldBlock: false,
        },
        draft: null,
        moderationResult: null,
        passed: false,
        error: String(error),
        timings: { sanitization: 0, generation: 0, moderation: 0, total: 0 },
      });
    }

    console.log("");
  }

  // Calculate final metrics
  metrics.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
  metrics.averageGenerationTime = metrics.passedTests > 0
    ? totalGenerationTime / metrics.passedTests
    : 0;
  metrics.fallbackRate = confidenceCount > 0
    ? (metrics.fallbackCount / confidenceCount) * 100
    : 0;

  // Print summary
  printSummary(metrics);

  // Create report
  const report: EvaluationReport = {
    timestamp: new Date().toISOString(),
    organizationId,
    sampleSize: selectedQueries.length,
    metrics,
    results,
  };

  // Save results to file
  saveResults(report);

  return report;
}

// ===========================================
// Output Formatting
// ===========================================

/**
 * Print a single test result
 */
function printTestResult(result: TestResult, testNum: number): void {
  // Sanitization status
  const sanitizationStatus = result.safetyResult.riskLevel === "none"
    ? "OK (no risks detected)"
    : `Risk: ${result.safetyResult.riskLevel} [${result.safetyResult.flags.join(", ")}]`;
  console.log(`  Sanitization: ${sanitizationStatus}`);

  // PII status
  const piiStatus = result.safetyResult.hasPII
    ? `Found: ${result.safetyResult.piiTypes.join(", ")}`
    : "None detected";
  console.log(`  PII: ${piiStatus}`);

  if (result.draft) {
    // Sources
    const kbCount = result.draft.metadata.retrievedKbCount;
    const ticketCount = result.draft.metadata.retrievedTicketCount;
    console.log(`  Sources found: ${kbCount} KB articles, ${ticketCount} similar tickets`);

    // Confidence
    const confScore = result.draft.confidenceScore.toFixed(2);
    const confLevel = result.draft.confidenceLevel;
    console.log(`  Confidence: ${confScore} (${confLevel})`);

    // Fallback status
    if (result.draft.isFallback) {
      console.log(`  Fallback: YES - ${result.draft.fallbackReason}`);
    }

    // Generation time
    const genTime = (result.timings.generation / 1000).toFixed(2);
    console.log(`  Generation time: ${genTime}s`);

    // Moderation
    const modStatus = result.moderationResult
      ? (result.moderationResult.flagged ? "FLAGGED" : "Passed")
      : "Not checked";
    console.log(`  Moderation: ${modStatus}`);

    // Draft preview
    console.log(`\n  Draft:`);
    console.log("  ---");
    const draftLines = result.draft.content.split("\n").slice(0, 5);
    for (const line of draftLines) {
      console.log(`  ${truncateString(line, 70)}`);
    }
    if (result.draft.content.split("\n").length > 5) {
      console.log("  ...");
    }
    console.log("  ---");
  } else if (result.error) {
    console.log(`  ERROR: ${result.error}`);
  }
}

/**
 * Print evaluation summary
 */
function printSummary(metrics: EvaluationMetrics): void {
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  console.log(`Total tests: ${metrics.totalTests}`);
  console.log(`Passed: ${metrics.passedTests}`);
  console.log(`Failed: ${metrics.failedTests}`);
  console.log(`Blocked inputs: ${metrics.blockedInputs}`);
  console.log("");
  console.log(`Average confidence: ${metrics.averageConfidence.toFixed(2)}`);
  console.log(`Confidence distribution:`);
  console.log(`  - High: ${metrics.confidenceDistribution.high}`);
  console.log(`  - Medium: ${metrics.confidenceDistribution.medium}`);
  console.log(`  - Low: ${metrics.confidenceDistribution.low}`);
  console.log("");
  console.log(`Fallback rate: ${metrics.fallbackRate.toFixed(1)}%`);
  console.log(`Average generation time: ${(metrics.averageGenerationTime / 1000).toFixed(2)}s`);
  console.log(`Moderation flags: ${metrics.moderationFlags}`);
  console.log("=".repeat(60));
}

/**
 * Save results to JSON file
 */
function saveResults(report: EvaluationReport): void {
  try {
    const outputPath = path.join(process.cwd(), "data", "test-results.json");
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);
  } catch (error) {
    console.error(`Failed to save results: ${error}`);
  }
}

/**
 * Truncate string with ellipsis
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

// ===========================================
// CLI Entry Point
// ===========================================

async function main(): Promise<void> {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const isQuick = args.includes("--quick");
  const isFull = args.includes("--full");

  // Determine sample size
  let sampleSize: number | undefined;
  if (isQuick) {
    sampleSize = 5;
  } else if (isFull) {
    sampleSize = undefined; // All samples
  } else {
    sampleSize = 20; // Default
  }

  // Check for required environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY environment variable is not set");
    console.error("Please set it in .env.local or .env file");
    process.exit(1);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("WARNING: Supabase environment variables not fully set");
    console.warn("RAG retrieval may not work correctly");
  }

  try {
    const report = await runGoldSetEvaluation(DEFAULT_ORG_ID, sampleSize);

    // Exit with error code if tests failed
    if (report.metrics.failedTests > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("\nFatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
main();
