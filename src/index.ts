/**
 * @hit/feature-pack-vault
 *
 * Password management and 2FA vault feature pack with team sharing, folders, CSV import, and TOTP.
 *
 * Components are exported individually for optimal tree-shaking.
 * When used with the route loader system, only the requested component is bundled.
 */

// Pages - exported individually for tree-shaking
export {
  VaultLanding,
  VaultLandingPage,
  PersonalVault,
  PersonalVaultPage,
  SharedVaults,
  SharedVaultsPage,
  SharedVaultDetail,
  SharedVaultDetailPage,
  FolderView,
  FolderViewPage,
  ItemDetail,
  ItemDetailPage,
  ItemEdit,
  ItemEditPage,
  ImportCSV,
  ImportCSVPage,
  GroupManagement,
  GroupManagementPage,
} from './pages/index';

// Components - exported individually for tree-shaking
export * from './components/index';

// Hooks - exported individually for tree-shaking
export * from './hooks/index';

// Navigation config
export { navContributions as nav } from './nav';

// Schema exports - MOVED to @hit/feature-pack-vault/schema to avoid bundling drizzle-orm in client
// Type-only exports are safe (erased at compile time) - BUT importing from schema file still pulls in drizzle
// So we don't re-export anything from schema here. Use @hit/feature-pack-vault/schema for server code.

// Permission constants - defined inline to avoid pulling in schema file
export const VAULT_PERMISSIONS = {
  READ: 'READ',
  WRITE: 'WRITE',
  DELETE: 'DELETE',
  MANAGE_ACL: 'MANAGE_ACL',
} as const;
export type VaultPermission = keyof typeof VAULT_PERMISSIONS;

// Services
export { VaultApiClient, vaultApi } from './services/vault-api';

// Utilities
export {
  extractOtpCode,
  extractOtpWithConfidence,
  isOtpMessage,
  OTP_KEYWORDS,
} from './utils/otp-extractor';
export type { OtpExtractionResult } from './utils/otp-extractor';
