import { openai } from "./client";

/**
 * Check if content passes OpenAI moderation
 * Returns true if content is safe, false if flagged
 */
export async function checkModeration(content: string): Promise<{
  safe: boolean;
  categories: string[];
}> {
  const response = await openai.moderations.create({
    input: content,
  });

  const result = response.results[0];
  const flaggedCategories = Object.entries(result.categories)
    .filter(([, flagged]) => flagged)
    .map(([category]) => category);

  return {
    safe: !result.flagged,
    categories: flaggedCategories,
  };
}

/**
 * Moderate both input and output for safety
 */
export async function moderateContent(input: string, output: string) {
  const [inputCheck, outputCheck] = await Promise.all([
    checkModeration(input),
    checkModeration(output),
  ]);

  return {
    inputSafe: inputCheck.safe,
    outputSafe: outputCheck.safe,
    inputCategories: inputCheck.categories,
    outputCategories: outputCheck.categories,
    safe: inputCheck.safe && outputCheck.safe,
  };
}
