/**
 * @hit/feature-pack-vault
 *
 * Password management and 2FA vault feature pack with team sharing, folders, CSV import, and TOTP.
 *
 * Components are exported individually for optimal tree-shaking.
 * When used with the route loader system, only the requested component is bundled.
 */
export { VaultLanding, VaultLandingPage, PersonalVault, PersonalVaultPage, SharedVaults, SharedVaultsPage, SharedVaultDetail, SharedVaultDetailPage, FolderView, FolderViewPage, ItemDetail, ItemDetailPage, ItemEdit, ItemEditPage, ImportCSV, ImportCSVPage, GroupManagement, GroupManagementPage, } from './pages/index';
export * from './components/index';
export * from './hooks/index';
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