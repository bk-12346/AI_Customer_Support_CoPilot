/**
 * RAG Prompt Templates
 *
 * Provides structured prompt templates for AI draft generation.
 * Designed to produce professional, empathetic customer support responses.
 *
 * Design Principles:
 * - Clear role definition for the AI
 * - Explicit guidelines to ensure quality and safety
 * - Context-aware responses using RAG retrieval
 * - Structured output formatting
 */

import type { AssembledContext } from "./context";

// ===========================================
// Types
// ===========================================

/** Chat message format for OpenAI API */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Options for customizing prompt generation */
export interface PromptOptions {
  /** Preferred tone: 'formal', 'friendly', 'empathetic' (default: 'friendly') */
  tone?: "formal" | "friendly" | "empathetic";
  /** Preferred response length: 'concise', 'standard', 'detailed' (default: 'standard') */
  length?: "concise" | "standard" | "detailed";
  /** Include greeting in response (default: true) */
  includeGreeting?: boolean;
  /** Include closing offer to help (default: true) */
  includeClosing?: boolean;
  /** Company/brand name to use in responses */
  companyName?: string;
  /** Agent name to sign off with */
  agentName?: string;
}

// ===========================================
// System Prompt
// ===========================================

/**
 * Core system prompt for customer support draft generation
 *
 * This prompt establishes:
 * 1. The AI's role as a support assistant
 * 2. Quality guidelines for responses
 * 3. Safety constraints (no hallucination)
 * 4. Formatting expectations
 */
export const SYSTEM_PROMPT = `You are a helpful customer support agent assistant. Your role is to draft professional, empathetic responses to customer inquiries.

GUIDELINES:
- Be professional, friendly, and empathetic
- Address all parts of the customer's question
- Provide clear, actionable next steps when applicable
- Use the provided knowledge base and similar ticket resolutions as reference
- If you're unsure or the context doesn't cover the question, say so honestly
- Never make up information not supported by the provided context
- Keep responses concise but complete
- Do not include internal notes or metadata in the response

FORMATTING:
- Use a warm greeting
- Structure the response clearly
- End with an offer to help further`;

/**
 * System prompt variation for formal tone
 */
export const SYSTEM_PROMPT_FORMAL = `You are a professional customer support agent assistant. Your role is to draft polished, business-appropriate responses to customer inquiries.

GUIDELINES:
- Maintain a professional and courteous tone throughout
- Address all aspects of the customer's inquiry comprehensively
- Provide specific, actionable guidance when applicable
- Reference the provided knowledge base and similar resolved tickets
- Acknowledge uncertainty transparently when context is insufficient
- Do not fabricate information beyond the provided context
- Ensure responses are thorough yet efficient
- Exclude internal notes or system metadata from responses

FORMATTING:
- Begin with an appropriate professional greeting
- Organize information logically with clear structure
- Conclude with a professional offer of continued assistance`;

/**
 * System prompt variation for empathetic tone
 */
export const SYSTEM_PROMPT_EMPATHETIC = `You are a caring customer support agent assistant. Your role is to draft warm, understanding responses that make customers feel heard and supported.

GUIDELINES:
- Lead with empathy and acknowledge the customer's feelings
- Show genuine understanding of their situation
- Address all parts of their question with patience
- Use the provided knowledge base and similar ticket resolutions as reference
- Be honest when you need to verify information or escalate
- Never make up information - it's better to acknowledge uncertainty
- Keep responses warm but informative
- Do not include internal notes in the customer-facing response

FORMATTING:
- Start with an empathetic acknowledgment
- Address their concerns with care and clarity
- Reassure them and offer continued support`;

// ===========================================
// Prompt Builders
// ===========================================

/**
 * Build the user prompt combining customer message with RAG context
 *
 * Creates a structured prompt that:
 * 1. Presents the retrieved context (KB articles, similar tickets)
 * 2. Shows the customer's message
 * 3. Provides clear instructions for response generation
 *
 * @param customerMessage - The customer's inquiry
 * @param context - Assembled RAG context
 * @param options - Optional customization options
 * @returns Formatted user prompt string
 *
 * @example
 * ```typescript
 * const userPrompt = buildUserPrompt(
 *   "How do I reset my password?",
 *   assembledContext,
 *   { tone: 'friendly' }
 * );
 * ```
 */
export function buildUserPrompt(
  customerMessage: string,
  context: AssembledContext,
  options: PromptOptions = {}
): string {
  const { tone = "friendly", length = "standard" } = options;

  // Build length guidance
  let lengthGuidance = "";
  switch (length) {
    case "concise":
      lengthGuidance = "Keep the response brief and to the point.";
      break;
    case "detailed":
      lengthGuidance = "Provide a thorough, detailed response.";
      break;
    default:
      lengthGuidance = "Provide a balanced response that is complete but not overly long.";
  }

  // Build tone guidance
  let toneGuidance = "";
  switch (tone) {
    case "formal":
      toneGuidance = "Use a professional, business-appropriate tone.";
      break;
    case "empathetic":
      toneGuidance = "Use a warm, understanding tone that acknowledges the customer's feelings.";
      break;
    default:
      toneGuidance = "Use a friendly, helpful tone.";
  }

  // Build the prompt
  const parts: string[] = [];

  // Add context section
  parts.push("CONTEXT:");
  parts.push(context.systemContext);
  parts.push("");

  // Add customer message
  parts.push("CUSTOMER MESSAGE:");
  parts.push(customerMessage);
  parts.push("");

  // Add instructions
  parts.push("INSTRUCTIONS:");
  parts.push(
    "Draft a professional response to this customer inquiry. " +
    "Use the context above to inform your response. " +
    "If the context doesn't contain relevant information, provide a helpful response based on general best practices and note that you may need to verify details."
  );
  parts.push("");
  parts.push(toneGuidance);
  parts.push(lengthGuidance);

  return parts.join("\n");
}

/**
 * Build complete message array for OpenAI chat completion
 *
 * Returns the properly formatted messages array including:
 * 1. System message with role instructions
 * 2. User message with context and customer inquiry
 *
 * @param customerMessage - The customer's inquiry
 * @param context - Assembled RAG context
 * @param options - Optional customization options
 * @returns Array of chat messages for OpenAI API
 *
 * @example
 * ```typescript
 * const messages = buildMessages(
 *   "How do I cancel my subscription?",
 *   assembledContext
 * );
 *
 * const response = await openai.chat.completions.create({
 *   model: "gpt-4o-mini",
 *   messages
 * });
 * ```
 */
export function buildMessages(
  customerMessage: string,
  context: AssembledContext,
  options: PromptOptions = {}
): ChatMessage[] {
  const { tone = "friendly" } = options;

  // Select appropriate system prompt based on tone
  let systemPrompt: string;
  switch (tone) {
    case "formal":
      systemPrompt = SYSTEM_PROMPT_FORMAL;
      break;
    case "empathetic":
      systemPrompt = SYSTEM_PROMPT_EMPATHETIC;
      break;
    default:
      systemPrompt = SYSTEM_PROMPT;
  }

  // Add company name if provided
  if (options.companyName) {
    systemPrompt += `\n\nYou are representing ${options.companyName}.`;
  }

  // Add agent name if provided
  if (options.agentName) {
    systemPrompt += `\n\nSign off as "${options.agentName}".`;
  }

  // Build user prompt
  const userPrompt = buildUserPrompt(customerMessage, context, options);

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

// ===========================================
// Specialized Prompts
// ===========================================

/**
 * Build a prompt for low-confidence scenarios
 *
 * Used when RAG retrieval doesn't find relevant context.
 * Instructs the AI to be transparent about limitations.
 *
 * @param customerMessage - The customer's inquiry
 * @returns Chat messages for low-confidence response
 */
export function buildLowConfidenceMessages(
  customerMessage: string,
  options: PromptOptions = {}
): ChatMessage[] {
  const systemPrompt = `You are a helpful customer support agent assistant. The knowledge base search did not return relevant results for this inquiry.

GUIDELINES:
- Acknowledge the customer's question professionally
- Provide general guidance if possible, but be clear that you may need to verify specifics
- Suggest escalation or follow-up if the question requires specific account or policy information
- Never make up specific procedures, prices, or policies
- Offer to connect them with a specialist if needed

Be helpful while being transparent about limitations.`;

  const userPrompt = `CUSTOMER MESSAGE:
${customerMessage}

Draft a helpful response that acknowledges we may need to verify specific details or connect them with a specialist who can better assist with their inquiry.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

/**
 * Build a prompt for regenerating a response with feedback
 *
 * Used when an agent wants to regenerate with specific instructions.
 *
 * @param customerMessage - The customer's inquiry
 * @param context - Assembled RAG context
 * @param previousResponse - The previous generated response
 * @param feedback - Agent's feedback for improvement
 * @returns Chat messages for regeneration
 */
export function buildRegenerationMessages(
  customerMessage: string,
  context: AssembledContext,
  previousResponse: string,
  feedback: string,
  options: PromptOptions = {}
): ChatMessage[] {
  const baseMessages = buildMessages(customerMessage, context, options);

  // Add the previous response and feedback
  const regenerationPrompt = `

PREVIOUS RESPONSE:
${previousResponse}

AGENT FEEDBACK:
${feedback}

Please generate an improved response that addresses the feedback while maintaining professionalism and accuracy.`;

  // Append to the user message
  baseMessages[1].content += regenerationPrompt;

  return baseMessages;
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Estimate token count for a message array
 *
 * Rough estimation: ~4 characters per token for English text.
 * Useful for checking if context fits within model limits.
 *
 * @param messages - Array of chat messages
 * @returns Estimated token count
 */
export function estimateTokenCount(messages: ChatMessage[]): number {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(totalChars / 4);
}

/**
 * Check if messages fit within a token limit
 *
 * @param messages - Array of chat messages
 * @param limit - Token limit (default: 4000 for prompt, leaving room for response)
 * @returns Boolean indicating if messages fit
 */
export function fitsWithinLimit(
  messages: ChatMessage[],
  limit: number = 4000
): boolean {
  return estimateTokenCount(messages) <= limit;
}
