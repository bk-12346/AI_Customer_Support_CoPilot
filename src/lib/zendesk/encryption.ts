/**
 * Token Encryption Utilities
 *
 * Provides AES-256-GCM encryption for securely storing OAuth tokens
 * in the database. Tokens are encrypted before storage and decrypted
 * when retrieved.
 *
 * Requires ENCRYPTION_KEY environment variable (32-byte hex string).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ===========================================
// Configuration
// ===========================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// ===========================================
// Environment Validation
// ===========================================

/**
 * Get encryption key from environment
 * Key must be 32 bytes (64 hex characters)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new EncryptionError(
      "ENCRYPTION_KEY environment variable is not set. " +
      "Generate one with: openssl rand -hex 32"
    );
  }

  if (key.length !== 64) {
    throw new EncryptionError(
      "ENCRYPTION_KEY must be 64 hex characters (32 bytes). " +
      "Generate one with: openssl rand -hex 32"
    );
  }

  return Buffer.from(key, "hex");
}

// ===========================================
// Encryption Functions
// ===========================================

/**
 * Encrypt a plaintext string
 *
 * @param plaintext - The text to encrypt
 * @returns Base64-encoded string containing IV + ciphertext + auth tag
 *
 * @example
 * const encrypted = encrypt("my-secret-token");
 * // Store encrypted in database
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine IV + encrypted + authTag into single buffer
  const combined = Buffer.concat([iv, encrypted, authTag]);

  return combined.toString("base64");
}

/**
 * Decrypt an encrypted string
 *
 * @param encryptedData - Base64-encoded string from encrypt()
 * @returns Original plaintext string
 *
 * @example
 * const decrypted = decrypt(encryptedFromDB);
 * // Use decrypted token
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, "base64");

  // Extract IV, ciphertext, and auth tag
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    throw new EncryptionError(
      "Failed to decrypt data. The encryption key may have changed or the data is corrupted."
    );
  }
}

// ===========================================
// Credential Storage Helpers
// ===========================================

export interface EncryptedCredentials {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
}

export interface DecryptedCredentials {
  accessToken: string;
  refreshToken: string;
}

/**
 * Encrypt OAuth credentials for database storage
 */
export function encryptCredentials(
  accessToken: string,
  refreshToken: string
): EncryptedCredentials {
  return {
    accessTokenEncrypted: encrypt(accessToken),
    refreshTokenEncrypted: encrypt(refreshToken),
  };
}

/**
 * Decrypt OAuth credentials from database
 */
export function decryptCredentials(
  accessTokenEncrypted: string,
  refreshTokenEncrypted: string
): DecryptedCredentials {
  return {
    accessToken: decrypt(accessTokenEncrypted),
    refreshToken: decrypt(refreshTokenEncrypted),
  };
}

// ===========================================
// Key Generation Helper
// ===========================================

/**
 * Generate a new encryption key
 * Use this to create a key for ENCRYPTION_KEY environment variable
 *
 * @returns 64-character hex string
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}

// ===========================================
// Error Class
// ===========================================

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}
