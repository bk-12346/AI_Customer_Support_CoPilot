/**
 * Knowledge Base Seeding Script
 *
 * Seeds knowledge_articles table with articles from JSON files
 * and generates embeddings for RAG similarity search.
 *
 * Usage: npm run seed-kb
 */

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Load environment variables from .env.local
config({ path: ".env.local" });

// ===========================================
// Configuration
// ===========================================

const BATCH_SIZE = 5; // Articles per batch
const BATCH_DELAY_MS = 1000; // Delay between batches (rate limiting)
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

// Test organization details
const TEST_ORG_NAME = "Test Organization";
const TEST_ORG_SLUG = "test-org";

// ===========================================
// Types
// ===========================================

interface KBArticle {
  title: string;
  content: string;
  category: string;
  source: "generated";
}

interface SeedResult {
  success: number;
  skipped: number;
  failed: number;
  errors: Array<{ title: string; error: string }>;
}

// ===========================================
// Environment Validation
// ===========================================

function validateEnv(): { supabaseUrl: string; supabaseKey: string; openaiKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set in environment");
  }
  // Supabase JS expects the project API URL like: https://<project-ref>.supabase.co
  // If this is accidentally set to Supabase Studio/Dashboard (supabase.com), requests will return HTML.
  try {
    const u = new URL(supabaseUrl);
    const host = u.hostname.toLowerCase();
    if (host.endsWith("supabase.com")) {
      throw new Error(
        `NEXT_PUBLIC_SUPABASE_URL appears to be a Supabase dashboard URL (${supabaseUrl}). ` +
          `Set it to your project API URL: https://<project-ref>.supabase.co`
      );
    }
    if (!host.endsWith("supabase.co") && !host.includes("localhost")) {
      console.warn(
        `  Warning: NEXT_PUBLIC_SUPABASE_URL host (${host}) doesn't look like a Supabase project API URL. ` +
          `Expected https://<project-ref>.supabase.co (or local dev).`
      );
    }
  } catch (e) {
    if (e instanceof Error) throw e;
  }
  if (!supabaseKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in environment");
  }
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY is not set in environment");
  }

  return { supabaseUrl, supabaseKey, openaiKey };
}

// ===========================================
// Clients
// ===========================================

function createSupabaseAdmin(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Generate embedding for text using OpenAI
 */
async function generateEmbedding(
  openai: OpenAI,
  text: string
): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.trim(),
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Load articles from JSON file
 */
function loadArticles(filename: string): KBArticle[] {
  const filepath = path.join(process.cwd(), "data", filename);

  if (!fs.existsSync(filepath)) {
    console.warn(`  Warning: ${filename} not found, skipping`);
    return [];
  }

  const content = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(content);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get or create test organization
 */
async function getOrCreateTestOrg(
  supabase: ReturnType<typeof createSupabaseAdmin>
): Promise<string> {
  // Check if test org exists
  const { data: existingOrg, error: existingOrgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", TEST_ORG_SLUG)
    .single();

  // If the org isn't found, Supabase may return an error (e.g., PGRST116)
  // We only treat it as fatal if we got an error AND no data.
  if (existingOrgError && !existingOrg) {
    console.error("  Failed to query organizations table:", {
      message: existingOrgError.message,
      details: (existingOrgError as any).details,
      hint: (existingOrgError as any).hint,
      code: (existingOrgError as any).code,
    });
  }

  if (existingOrg) {
    console.log(`  Using existing organization: ${TEST_ORG_NAME} (${existingOrg.id})`);
    return existingOrg.id;
  }

  // Create new test org
  const { data: newOrg, error } = await supabase
    .from("organizations")
    .insert({
      name: TEST_ORG_NAME,
      slug: TEST_ORG_SLUG,
    })
    .select("id")
    .single();

  if (error) {
    console.error("  Failed to create test organization:", {
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
      code: (error as any).code,
    });
    throw new Error(`Failed to create test organization: ${error.message}`);
  }

  console.log(`  Created new organization: ${TEST_ORG_NAME} (${newOrg.id})`);
  return newOrg.id;
}

/**
 * Check if article already exists
 */
async function articleExists(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  orgId: string,
  title: string
): Promise<boolean> {
  const { data } = await supabase
    .from("knowledge_articles")
    .select("id")
    .eq("organization_id", orgId)
    .eq("title", title)
    .single();

  return !!data;
}

/**
 * Seed articles in batches
 */
async function seedArticles(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  openai: OpenAI,
  articles: KBArticle[],
  orgId: string,
  sourceLabel: string
): Promise<SeedResult> {
  const result: SeedResult = {
    success: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  if (articles.length === 0) {
    console.log(`  No ${sourceLabel} to seed`);
    return result;
  }

  console.log(`\n  Seeding ${articles.length} ${sourceLabel}...`);

  // Process in batches
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(articles.length / BATCH_SIZE);

    console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} articles)`);

    for (const article of batch) {
      try {
        // Check for duplicate
        const exists = await articleExists(supabase, orgId, article.title);
        if (exists) {
          result.skipped++;
          continue;
        }

        // Generate embedding
        const textForEmbedding = `${article.title}\n\n${article.content}`;
        const embedding = await generateEmbedding(openai, textForEmbedding);

        // Insert article
        const { error } = await supabase.from("knowledge_articles").insert({
          organization_id: orgId,
          title: article.title,
          content: article.content,
          source: "generated",
          embedding,
        });

        if (error) {
          throw new Error(error.message);
        }

        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          title: article.title,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Progress update
    const processed = Math.min(i + BATCH_SIZE, articles.length);
    console.log(`  Processed ${processed}/${articles.length} (${result.success} success, ${result.skipped} skipped, ${result.failed} failed)`);

    // Rate limiting delay between batches
    if (i + BATCH_SIZE < articles.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return result;
}

// ===========================================
// Main Script
// ===========================================

async function main() {
  console.log("=".repeat(60));
  console.log("Knowledge Base Seeding Script");
  console.log("=".repeat(60));

  try {
    // Validate environment
    console.log("\n[1/5] Validating environment...");
    const { supabaseUrl, supabaseKey, openaiKey } = validateEnv();
    console.log("  Environment OK");

    // Initialize clients
    console.log("\n[2/5] Initializing clients...");
    const supabase = createSupabaseAdmin(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey });
    console.log("  Clients initialized");

    // Get or create test organization
    console.log("\n[3/5] Setting up test organization...");
    const orgId = await getOrCreateTestOrg(supabase);

    // Load articles
    console.log("\n[4/5] Loading articles...");
    const kbArticles = loadArticles("kb-articles.json");
    const faqArticles = loadArticles("faq-articles.json");
    console.log(`  Loaded ${kbArticles.length} KB articles`);
    console.log(`  Loaded ${faqArticles.length} FAQ articles`);

    // Seed articles
    console.log("\n[5/5] Seeding articles to database...");

    const kbResult = await seedArticles(
      supabase,
      openai,
      kbArticles,
      orgId,
      "KB articles"
    );

    const faqResult = await seedArticles(
      supabase,
      openai,
      faqArticles,
      orgId,
      "FAQ articles"
    );

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("Seeding Complete!");
    console.log("=".repeat(60));

    const totalSuccess = kbResult.success + faqResult.success;
    const totalSkipped = kbResult.skipped + faqResult.skipped;
    const totalFailed = kbResult.failed + faqResult.failed;
    const totalErrors = [...kbResult.errors, ...faqResult.errors];

    console.log(`\nResults:`);
    console.log(`  ✅ Success: ${totalSuccess}`);
    console.log(`  ⏭️  Skipped (duplicates): ${totalSkipped}`);
    console.log(`  ❌ Failed: ${totalFailed}`);

    if (totalErrors.length > 0) {
      console.log(`\nErrors:`);
      for (const err of totalErrors) {
        console.log(`  - "${err.title}": ${err.error}`);
      }
    }

    console.log(`\nOrganization ID: ${orgId}`);
    console.log(`(Save this ID for testing queries)`);

  } catch (error) {
    console.error("\nFatal error:", error);
    process.exit(1);
  }
}

// Run
main();
