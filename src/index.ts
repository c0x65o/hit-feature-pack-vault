/**
 * @hit/feature-pack-vault
 *
 * Password management and 2FA vault feature pack with team sharing, folders, TOTP, and SMS inbox.
 *
 * Components are exported individually for optimal tree-shaking.
 * When used with the route loader system, only the requested component is bundled.
 */

// Pages - exported individually for tree-shaking
export { VaultLanding, default as VaultLandingPage } from './pages/VaultLanding';
export { PersonalVault, default as PersonalVaultPage } from './pages/PersonalVault';
export { SharedVaults, default as SharedVaultsPage } from './pages/SharedVaults';
export { SharedVaultDetail, default as SharedVaultDetailPage } from './pages/SharedVaultDetail';
export { FolderView, default as FolderViewPage } from './pages/FolderView';
export { ItemDetail, default as ItemDetailPage } from './pages/ItemDetail';
export { ItemEdit, default as ItemEditPage } from './pages/ItemEdit';
export { GroupManagement, default as GroupManagementPage } from './pages/GroupManagement';
export { PhoneNumberSetup, default as PhoneNumberSetupPage } from './pages/PhoneNumberSetup';
export { VaultSetup, default as VaultSetupPage } from './pages/VaultSetup';

// Components - exported individually for tree-shaking
export { AddItemModal } from './components/AddItemModal';
export { FolderModal } from './components/FolderModal';
export { FolderAclModal } from './components/FolderAclModal';

// Hooks - exported individually for tree-shaking
export {
  useOtpSubscription,
  getWebSocketStatus,
  isWebSocketAvailable,
  getGlobalWsStatus,
  subscribeGlobalWsStatus,
  getGlobalOtpConnectionType,
  subscribeGlobalOtpConnectionType,
  ensureVaultRealtimeConnection,
} from './hooks/useOtpSubscription';
export type {
  OtpNotification,
  UseOtpSubscriptionOptions,
  UseOtpSubscriptionResult,
} from './hooks/useOtpSubscription';

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
