/**
 * PII Detection Module
 *
 * Detects Personally Identifiable Information (PII) in text using
 * regex patterns. Supports detection of emails, phone numbers, SSNs,
 * credit card numbers, IP addresses, and street addresses.
 *
 * @example
 * ```typescript
 * import { detectPII, detectEmails } from "@/lib/safety";
 *
 * const result = detectPII("Contact me at john@example.com or 555-123-4567");
 * console.log(result.hasPII); // true
 * console.log(result.types); // ['email', 'phone']
 *
 * const emails = detectEmails("john@example.com and jane@test.org");
 * console.log(emails.length); // 2
 * ```
 */

// ===========================================
// Types
// ===========================================

/**
 * Types of PII that can be detected
 */
export type PIIType =
  | "email"
  | "phone"
  | "ssn"
  | "credit_card"
  | "ip_address"
  | "address";

/**
 * A single PII match with its location in the text
 */
export interface PIIMatch {
  /** The type of PII detected */
  type: PIIType;
  /** The actual value that was matched */
  value: string;
  /** Starting index in the original text */
  startIndex: number;
  /** Ending index in the original text (exclusive) */
  endIndex: number;
}

/**
 * Result of PII detection on a text
 */
export interface PIIDetectionResult {
  /** Whether any PII was found */
  hasPII: boolean;
  /** All PII matches found */
  matches: PIIMatch[];
  /** Unique types of PII found */
  types: PIIType[];
}

// ===========================================
// Regex Patterns
// ===========================================

/**
 * Email pattern
 * Matches: user@domain.com, user.name+tag@sub.domain.co.uk
 *
 * Parts:
 * - [a-zA-Z0-9._%+-]+ : Local part (letters, digits, dots, underscores, percent, plus, hyphen)
 * - @ : At symbol
 * - [a-zA-Z0-9.-]+ : Domain (letters, digits, dots, hyphens)
 * - \. : Dot before TLD
 * - [a-zA-Z]{2,} : TLD (2+ letters)
 */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Phone number pattern
 * Matches various formats:
 * - (123) 456-7890
 * - 123-456-7890
 * - 123.456.7890
 * - 1234567890
 * - +1 123 456 7890
 * - +1-123-456-7890
 *
 * Parts:
 * - (?:\+1[-.\s]?)? : Optional +1 country code with separator
 * - (?:\(?\d{3}\)?[-.\s]?) : Area code with optional parens and separator
 * - \d{3}[-.\s]? : First 3 digits with optional separator
 * - \d{4} : Last 4 digits
 * - \b : Word boundaries to avoid matching random digit sequences
 */
const PHONE_PATTERN = /(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;

/**
 * SSN (Social Security Number) pattern
 * Matches: 123-45-6789, 123 45 6789
 *
 * Format: AAA-GG-SSSS where:
 * - AAA: Area number (3 digits)
 * - GG: Group number (2 digits)
 * - SSSS: Serial number (4 digits)
 *
 * Note: Does not match SSNs starting with 000, 666, or 9xx (invalid per SSA rules)
 */
const SSN_PATTERN = /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g;

/**
 * Credit card number pattern
 * Matches 13-19 digit sequences with optional spaces/dashes
 *
 * Common formats:
 * - Visa: 4xxx xxxx xxxx xxxx (16 digits, starts with 4)
 * - MasterCard: 5xxx xxxx xxxx xxxx (16 digits, starts with 51-55)
 * - Amex: 3xxx xxxxxx xxxxx (15 digits, starts with 34 or 37)
 * - Discover: 6xxx xxxx xxxx xxxx (16 digits, starts with 6011, 65)
 *
 * Pattern matches digit groups with optional separators
 */
const CREDIT_CARD_PATTERN = /\b(?:\d{4}[-\s]?){3}\d{1,7}\b|\b\d{13,19}\b/g;

/**
 * IPv4 address pattern
 * Matches: 192.168.1.1, 10.0.0.255
 *
 * Parts:
 * - Each octet: 0-255
 * - (?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d) matches:
 *   - 250-255 (25[0-5])
 *   - 200-249 (2[0-4]\d)
 *   - 100-199 (1\d{2})
 *   - 0-99 ([1-9]?\d)
 */
const IP_ADDRESS_PATTERN = /\b(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/g;

/**
 * Street address pattern
 * Matches basic US street addresses
 *
 * Format: [Number] [Street Name] [Street Type]
 * Examples:
 * - 123 Main Street
 * - 456 Oak Ave
 * - 789 First St.
 *
 * Parts:
 * - \d{1,6} : Street number (1-6 digits)
 * - \s+ : Whitespace
 * - [A-Za-z0-9\s]{2,30} : Street name (letters, numbers, spaces)
 * - Street type suffixes (case insensitive)
 */
const ADDRESS_PATTERN = /\b\d{1,6}\s+[A-Za-z0-9\s]{2,30}\s+(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Road|Rd\.?|Lane|Ln\.?|Court|Ct\.?|Place|Pl\.?|Way|Circle|Cir\.?|Trail|Trl\.?)\b/gi;

// ===========================================
// Individual Detector Functions
// ===========================================

/**
 * Detect email addresses in text
 *
 * @param text - Text to search
 * @returns Array of email matches
 *
 * @example
 * ```typescript
 * const emails = detectEmails("Contact john@example.com or support@company.org");
 * // Returns 2 matches
 * ```
 */
export function detectEmails(text: string): PIIMatch[] {
  return findMatches(text, EMAIL_PATTERN, "email");
}

/**
 * Detect phone numbers in text
 *
 * @param text - Text to search
 * @returns Array of phone number matches
 *
 * @example
 * ```typescript
 * const phones = detectPhones("Call (555) 123-4567 or 800-555-1234");
 * // Returns 2 matches
 * ```
 */
export function detectPhones(text: string): PIIMatch[] {
  return findMatches(text, PHONE_PATTERN, "phone");
}

/**
 * Detect Social Security Numbers in text
 *
 * @param text - Text to search
 * @returns Array of SSN matches
 *
 * @example
 * ```typescript
 * const ssns = detectSSNs("SSN: 123-45-6789");
 * // Returns 1 match
 * ```
 */
export function detectSSNs(text: string): PIIMatch[] {
  return findMatches(text, SSN_PATTERN, "ssn");
}

/**
 * Detect credit card numbers in text
 *
 * @param text - Text to search
 * @returns Array of credit card matches
 *
 * @example
 * ```typescript
 * const cards = detectCreditCards("Card: 4111-1111-1111-1111");
 * // Returns 1 match
 * ```
 */
export function detectCreditCards(text: string): PIIMatch[] {
  // Additional validation: Luhn algorithm check could be added here
  const matches = findMatches(text, CREDIT_CARD_PATTERN, "credit_card");

  // Filter out numbers that are clearly not credit cards (e.g., all same digit)
  return matches.filter((match) => {
    const digitsOnly = match.value.replace(/[-\s]/g, "");
    // Check it's not all the same digit (except for test cards)
    const uniqueDigits = new Set(digitsOnly.split("")).size;
    return uniqueDigits > 1 && digitsOnly.length >= 13 && digitsOnly.length <= 19;
  });
}

/**
 * Detect IPv4 addresses in text
 *
 * @param text - Text to search
 * @returns Array of IP address matches
 *
 * @example
 * ```typescript
 * const ips = detectIPAddresses("Server at 192.168.1.1 and 10.0.0.1");
 * // Returns 2 matches
 * ```
 */
export function detectIPAddresses(text: string): PIIMatch[] {
  const matches = findMatches(text, IP_ADDRESS_PATTERN, "ip_address");

  // Filter out common non-PII IPs (localhost, broadcast, etc.)
  return matches.filter((match) => {
    const ip = match.value;
    // Keep IPs that could be PII (not localhost, not broadcast, not private reserved)
    // Note: We keep private IPs as they could still be sensitive
    return ip !== "127.0.0.1" && ip !== "0.0.0.0" && ip !== "255.255.255.255";
  });
}

/**
 * Detect street addresses in text
 *
 * @param text - Text to search
 * @returns Array of address matches
 *
 * @example
 * ```typescript
 * const addresses = detectAddresses("Located at 123 Main Street, Suite 100");
 * // Returns 1 match
 * ```
 */
export function detectAddresses(text: string): PIIMatch[] {
  return findMatches(text, ADDRESS_PATTERN, "address");
}

// ===========================================
// Main Detection Function
// ===========================================

/**
 * Detect all types of PII in text
 *
 * Scans the provided text for emails, phone numbers, SSNs,
 * credit card numbers, IP addresses, and street addresses.
 *
 * @param text - Text to scan for PII
 * @returns Detection result with all matches and types found
 *
 * @example
 * ```typescript
 * const result = detectPII(`
 *   Customer: john@example.com
 *   Phone: (555) 123-4567
 *   Card: 4111-1111-1111-1111
 * `);
 *
 * console.log(result.hasPII);  // true
 * console.log(result.types);   // ['email', 'phone', 'credit_card']
 * console.log(result.matches); // Array of 3 PIIMatch objects
 * ```
 */
export function detectPII(text: string): PIIDetectionResult {
  if (!text || typeof text !== "string") {
    return {
      hasPII: false,
      matches: [],
      types: [],
    };
  }

  // Collect matches from all detectors
  const allMatches: PIIMatch[] = [
    ...detectEmails(text),
    ...detectPhones(text),
    ...detectSSNs(text),
    ...detectCreditCards(text),
    ...detectIPAddresses(text),
    ...detectAddresses(text),
  ];

  // Sort matches by start index
  allMatches.sort((a, b) => a.startIndex - b.startIndex);

  // Get unique types
  const types = [...new Set(allMatches.map((m) => m.type))];

  return {
    hasPII: allMatches.length > 0,
    matches: allMatches,
    types,
  };
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Find all matches of a pattern in text
 *
 * @param text - Text to search
 * @param pattern - Regex pattern (must have global flag)
 * @param type - PII type to assign to matches
 * @returns Array of matches
 */
function findMatches(text: string, pattern: RegExp, type: PIIType): PIIMatch[] {
  const matches: PIIMatch[] = [];

  // Reset regex state (important for global patterns)
  pattern.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      type,
      value: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  // Reset again for next use
  pattern.lastIndex = 0;

  return matches;
}

/**
 * Check if text contains any PII (quick check)
 *
 * @param text - Text to check
 * @returns True if any PII is detected
 *
 * @example
 * ```typescript
 * if (containsPII(userInput)) {
 *   console.warn("Input contains PII");
 * }
 * ```
 */
export function containsPII(text: string): boolean {
  return detectPII(text).hasPII;
}

/**
 * Get a summary of PII found in text
 *
 * @param text - Text to analyze
 * @returns Human-readable summary string
 */
export function getPIISummary(text: string): string {
  const result = detectPII(text);

  if (!result.hasPII) {
    return "No PII detected";
  }

  const counts = result.matches.reduce(
    (acc, match) => {
      acc[match.type] = (acc[match.type] || 0) + 1;
      return acc;
    },
    {} as Record<PIIType, number>
  );

  const parts = Object.entries(counts).map(
    ([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`
  );

  return `Found PII: ${parts.join(", ")}`;
}
