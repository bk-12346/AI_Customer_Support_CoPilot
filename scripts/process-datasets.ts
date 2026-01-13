/**
 * Dataset Processing Pipeline
 *
 * Downloads and processes customer support datasets from Hugging Face:
 * - Bitext: Customer support chatbot training data (grouped by intent -> KB articles)
 * - MakTek: Customer support FAQs (converted to article format)
 * - Gold-set: Stratified sample for evaluation
 */

import * as fs from 'fs';
import * as path from 'path';

// Types
interface BitextRecord {
  instruction: string;
  intent: string;
  category: string;
  response: string;
}

interface MakTekRecord {
  Question: string;
  Answer: string;
}

interface KBArticle {
  title: string;
  content: string;
  category: string;
  source: 'generated';
}

interface GoldSetExample {
  input: string;
  expected_output: string;
  intent: string;
  category: string;
}

// Paths
const DATA_DIR = path.join(process.cwd(), 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');

// Hugging Face dataset URLs (using the datasets API for JSON access)
const BITEXT_URL = 'https://datasets-server.huggingface.co/rows?dataset=bitext%2FBitext-customer-support-llm-chatbot-training-dataset&config=default&split=train&offset=0&length=100';
const MAKTEK_URL = 'https://datasets-server.huggingface.co/rows?dataset=MakTek%2FCustomer_support_faqs_dataset&config=default&split=train&offset=0&length=100';

// For full dataset, we need to paginate
const BITEXT_PARQUET_URL = 'https://huggingface.co/datasets/bitext/Bitext-customer-support-llm-chatbot-training-dataset/resolve/main/data/train-00000-of-00001.parquet';
const MAKTEK_PARQUET_URL = 'https://huggingface.co/datasets/MakTek/Customer_support_faqs_dataset/resolve/main/data/train-00000-of-00001.parquet';

/**
 * Download a file from URL and save to disk
 */
async function downloadFile(url: string, outputPath: string): Promise<Buffer> {
  console.log(`  Downloading from: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  fs.writeFileSync(outputPath, buffer);
  console.log(`  Saved to: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  return buffer;
}

/**
 * Fetch all rows from Hugging Face datasets API with pagination
 */
async function fetchAllRows<T>(datasetName: string, maxRows: number = 50000): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 100;
  let offset = 0;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  let rateLimitBackoff = 1000; // Start with 1 second for rate limit backoff

  console.log(`  Fetching rows from ${datasetName}...`);

  while (offset < maxRows) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(datasetName)}&config=default&split=train&offset=${offset}&length=${pageSize}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`  Reached end of dataset at offset ${offset}`);
          break;
        }
        
        // Handle rate limiting (429) with exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : rateLimitBackoff;
          
          console.warn(`  Rate limited (429) at offset ${offset}. Waiting ${waitTime / 1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Exponential backoff: double the wait time for next rate limit
          rateLimitBackoff = Math.min(rateLimitBackoff * 2, 60000); // Cap at 60 seconds
          consecutiveErrors++;
          
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error(`  Too many rate limit errors. Stopping at ${rows.length} rows.`);
            break;
          }
          
          // Don't increment offset, retry the same request
          continue;
        }
        
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json() as { rows: { row: T }[] };

      if (!data.rows || data.rows.length === 0) {
        console.log(`  No more rows at offset ${offset}`);
        break;
      }

      rows.push(...data.rows.map(r => r.row));
      offset += pageSize;
      consecutiveErrors = 0; // Reset on success
      rateLimitBackoff = 1000; // Reset backoff on success

      if (offset % 1000 === 0) {
        console.log(`  Fetched ${rows.length} rows...`);
      }

      // Increased delay to avoid rate limiting (500ms instead of 100ms)
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      consecutiveErrors++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('EAI_AGAIN') || errorMessage.includes('fetch failed')) {
        console.error(`  Network error: Unable to reach Hugging Face API.`);
        console.error(`  Please check your internet connection and try again.`);
        throw new Error('Network unavailable - cannot fetch datasets');
      }

      console.error(`  Error at offset ${offset}: ${errorMessage}`);

      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error(`  Too many consecutive errors, stopping.`);
        break;
      }

      // Exponential backoff for other errors
      const waitTime = Math.min(1000 * Math.pow(2, consecutiveErrors - 1), 30000);
      console.log(`  Waiting ${waitTime / 1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  console.log(`  Total rows fetched: ${rows.length}`);
  return rows;
}

/**
 * Process Bitext dataset: Group responses by intent to create KB articles
 */
function processBitextToKB(records: BitextRecord[]): KBArticle[] {
  console.log('\n  Processing Bitext records into KB articles...');

  // Group by intent
  const byIntent = new Map<string, BitextRecord[]>();

  for (const record of records) {
    const existing = byIntent.get(record.intent) || [];
    existing.push(record);
    byIntent.set(record.intent, existing);
  }

  console.log(`  Found ${byIntent.size} unique intents`);

  // Create one KB article per intent
  const articles: KBArticle[] = [];

  for (const [intent, intentRecords] of byIntent) {
    // Get unique responses (deduplicated)
    const uniqueResponses = [...new Set(intentRecords.map(r => r.response))];

    // Get the category (should be same for all records of this intent)
    const category = intentRecords[0].category;

    // Create article content by combining best responses
    // Take top 3 unique responses as examples
    const responseExamples = uniqueResponses.slice(0, 3);

    // Format intent as readable title
    const title = formatIntentAsTitle(intent);

    // Build comprehensive content
    const content = buildKBContent(intent, category, intentRecords, responseExamples);

    articles.push({
      title,
      content,
      category: formatCategory(category),
      source: 'generated'
    });
  }

  console.log(`  Created ${articles.length} KB articles`);
  return articles;
}

/**
 * Format intent string as readable title
 */
function formatIntentAsTitle(intent: string): string {
  // e.g., "cancel_order" -> "How to Cancel an Order"
  const words = intent.split('_');
  const formatted = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // Add appropriate prefix based on intent type
  if (intent.includes('cancel')) return `How to ${formatted}`;
  if (intent.includes('change') || intent.includes('edit')) return `How to ${formatted}`;
  if (intent.includes('check') || intent.includes('track')) return `How to ${formatted}`;
  if (intent.includes('create') || intent.includes('set')) return `How to ${formatted}`;
  if (intent.includes('complaint')) return `Handling ${formatted}`;
  if (intent.includes('contact')) return `${formatted} Information`;
  if (intent.includes('delivery')) return `${formatted} Information`;
  if (intent.includes('get') || intent.includes('review')) return `How to ${formatted}`;
  if (intent.includes('newsletter')) return `${formatted} Management`;
  if (intent.includes('payment') || intent.includes('refund')) return `${formatted} Process`;
  if (intent.includes('place') || intent.includes('registration')) return `How to ${formatted}`;
  if (intent.includes('recover') || intent.includes('delete')) return `How to ${formatted}`;
  if (intent.includes('switch')) return `How to ${formatted}`;

  return formatted;
}

/**
 * Format category string
 */
function formatCategory(category: string): string {
  return category
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Build comprehensive KB article content
 */
function buildKBContent(
  intent: string,
  category: string,
  records: BitextRecord[],
  responses: string[]
): string {
  // Get sample questions
  const sampleQuestions = [...new Set(records.map(r => r.instruction))].slice(0, 5);

  let content = `## Overview\n\n`;
  content += `This article covers how to handle "${intent.replace(/_/g, ' ')}" requests in the ${formatCategory(category)} category.\n\n`;

  content += `## Common Customer Questions\n\n`;
  for (const q of sampleQuestions) {
    content += `- ${q}\n`;
  }

  content += `\n## Recommended Response\n\n`;
  content += responses[0] + '\n';

  if (responses.length > 1) {
    content += `\n## Alternative Responses\n\n`;
    for (let i = 1; i < responses.length; i++) {
      content += `### Option ${i + 1}\n${responses[i]}\n\n`;
    }
  }

  return content;
}

/**
 * Process MakTek dataset: Convert FAQs to article format
 */
function processMakTekToFAQ(records: MakTekRecord[]): KBArticle[] {
  console.log('\n  Processing MakTek FAQs...');

  const articles: KBArticle[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    // Skip duplicates
    const key = record.Question.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    // Skip empty records
    if (!record.Question || !record.Answer) continue;

    articles.push({
      title: record.Question.trim(),
      content: record.Answer.trim(),
      category: 'FAQ',
      source: 'generated'
    });
  }

  console.log(`  Created ${articles.length} FAQ articles`);
  return articles;
}

/**
 * Create gold-set: Stratified sample from Bitext for evaluation
 */
function createGoldSet(records: BitextRecord[], targetSize: number = 150): GoldSetExample[] {
  console.log('\n  Creating gold-set for evaluation...');

  // Group by intent for stratified sampling
  const byIntent = new Map<string, BitextRecord[]>();

  for (const record of records) {
    const existing = byIntent.get(record.intent) || [];
    existing.push(record);
    byIntent.set(record.intent, existing);
  }

  const intents = Array.from(byIntent.keys());
  const samplesPerIntent = Math.ceil(targetSize / intents.length);

  console.log(`  Sampling ~${samplesPerIntent} examples from each of ${intents.length} intents`);

  const goldSet: GoldSetExample[] = [];

  for (const [intent, intentRecords] of byIntent) {
    // Shuffle and take samples
    const shuffled = [...intentRecords].sort(() => Math.random() - 0.5);
    const samples = shuffled.slice(0, samplesPerIntent);

    for (const sample of samples) {
      goldSet.push({
        input: sample.instruction,
        expected_output: sample.response,
        intent: sample.intent,
        category: formatCategory(sample.category)
      });
    }
  }

  // Shuffle final result
  const shuffledGoldSet = goldSet.sort(() => Math.random() - 0.5);

  // Trim to target size if over
  const finalSet = shuffledGoldSet.slice(0, targetSize);

  console.log(`  Created gold-set with ${finalSet.length} examples`);
  return finalSet;
}

/**
 * Save JSON to file
 */
function saveJSON(data: unknown, filename: string): void {
  const filepath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`  Saved: ${filepath}`);
}

/**
 * Main processing pipeline
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Dataset Processing Pipeline');
  console.log('='.repeat(60));

  // Ensure directories exist
  fs.mkdirSync(RAW_DIR, { recursive: true });

  try {
    // 1. Fetch Bitext dataset
    console.log('\n[1/5] Fetching Bitext dataset...');
    const bitextRecords = await fetchAllRows<BitextRecord>(
      'bitext/Bitext-customer-support-llm-chatbot-training-dataset',
      30000 // Limit to 30k rows for reasonable processing time
    );

    // Save raw data
    saveJSON(bitextRecords, 'raw/bitext-raw.json');

    // 2. Fetch MakTek dataset
    console.log('\n[2/5] Fetching MakTek dataset...');
    const maktekRecords = await fetchAllRows<MakTekRecord>(
      'MakTek/Customer_support_faqs_dataset',
      5000
    );

    // Save raw data
    saveJSON(maktekRecords, 'raw/maktek-raw.json');

    // 3. Process Bitext -> KB Articles
    console.log('\n[3/5] Processing Bitext into KB articles...');
    const kbArticles = processBitextToKB(bitextRecords);
    saveJSON(kbArticles, 'kb-articles.json');

    // 4. Process MakTek -> FAQ Articles
    console.log('\n[4/5] Processing MakTek into FAQ articles...');
    const faqArticles = processMakTekToFAQ(maktekRecords);
    saveJSON(faqArticles, 'faq-articles.json');

    // 5. Create Gold-set
    console.log('\n[5/5] Creating evaluation gold-set...');
    const goldSet = createGoldSet(bitextRecords, 150);
    saveJSON(goldSet, 'gold-set.json');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Processing Complete!');
    console.log('='.repeat(60));
    console.log(`\nOutput files:`);
    console.log(`  - data/kb-articles.json    (${kbArticles.length} articles)`);
    console.log(`  - data/faq-articles.json   (${faqArticles.length} articles)`);
    console.log(`  - data/gold-set.json       (${goldSet.length} examples)`);
    console.log(`  - data/raw/bitext-raw.json (${bitextRecords.length} records)`);
    console.log(`  - data/raw/maktek-raw.json (${maktekRecords.length} records)`);

  } catch (error) {
    console.error('\nError during processing:', error);
    process.exit(1);
  }
}

// Run
main();
