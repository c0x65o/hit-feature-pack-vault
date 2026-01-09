/**
 * @hit/feature-pack-vault
 *
 * Password management and 2FA vault feature pack with team sharing, folders, CSV import, TOTP, and SMS inbox.
 *
 * Components are exported individually for optimal tree-shaking.
 * When used with the route loader system, only the requested component is bundled.
 */
export { VaultLanding, default as VaultLandingPage } from './pages/VaultLanding';
export { PersonalVault, default as PersonalVaultPage } from './pages/PersonalVault';
export { SharedVaults, default as SharedVaultsPage } from './pages/SharedVaults';
export { SharedVaultDetail, default as SharedVaultDetailPage } from './pages/SharedVaultDetail';
export { FolderView, default as FolderViewPage } from './pages/FolderView';
export { ItemDetail, default as ItemDetailPage } from './pages/ItemDetail';
export { ItemEdit, default as ItemEditPage } from './pages/ItemEdit';
export { ImportCSV, default as ImportCSVPage } from './pages/ImportCSV';
export { GroupManagement, default as GroupManagementPage } from './pages/GroupManagement';
export { PhoneNumberSetup, default as PhoneNumberSetupPage } from './pages/PhoneNumberSetup';
export { VaultSetup, default as VaultSetupPage } from './pages/VaultSetup';
export { AddItemModal } from './components/AddItemModal';
export { FolderModal } from './components/FolderModal';
export { FolderAclModal } from './components/FolderAclModal';
export { useOtpSubscription, getWebSocketStatus, isWebSocketAvailable, getGlobalWsStatus, subscribeGlobalWsStatus, getGlobalOtpConnectionType, subscribeGlobalOtpConnectionType, ensureVaultRealtimeConnection, } from './hooks/useOtpSubscription';
export type { OtpNotification, UseOtpSubscriptionOptions, UseOtpSubscriptionResult, } from './hooks/useOtpSubscription';
export { navContributions as nav } from './nav';
export declare const VAULT_PERMISSIONS: {
    readonly READ: "READ";
    readonly WRITE: "WRITE";
    readonly DELETE: "DELETE";
    readonly MANAGE_ACL: "MANAGE_ACL";
};
export type VaultPermission = keyof typeof VAULT_PERMISSIONS;
export { VaultApiClient, vaultApi } from './services/vault-api';
export { extractOtpCode, extractOtpWithConfidence, isOtpMessage, OTP_KEYWORDS, } from './utils/otp-extractor';
export type { OtpExtractionResult } from './utils/otp-extractor';
//# sourceMappingURL=index.d.ts.map