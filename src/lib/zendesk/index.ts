/**
 * Zendesk Integration Library
 *
 * Provides client, OAuth, and sync utilities for Zendesk integration.
 */

export { ZendeskClient, ZendeskAPIError } from "./client";
export type { PaginatedResponse } from "./client";

export {
  encrypt,
  decrypt,
  encryptCredentials,
  decryptCredentials,
  generateEncryptionKey,
  EncryptionError,
} from "./encryption";
export type { EncryptedCredentials, DecryptedCredentials } from "./encryption";

export {
  getZendeskCredentials,
  getZendeskClient,
  isZendeskConnected,
  disconnectZendesk,
} from "./oauth";

export {
  syncTickets,
  syncKBArticles,
  getSyncStatus,
} from "./sync";
export type { SyncResult, ArticleSyncResult } from "./sync";
