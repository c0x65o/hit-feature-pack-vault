/**
 * @hit/feature-pack-vault
 *
 * Password management and 2FA vault feature pack with team sharing, folders, CSV import, TOTP, and SMS inbox.
 *
 * Components are exported individually for optimal tree-shaking.
 * When used with the route loader system, only the requested component is bundled.
 */
export { VaultLanding, VaultLandingPage, PersonalVault, PersonalVaultPage, SharedVaults, SharedVaultsPage, SharedVaultDetail, SharedVaultDetailPage, FolderView, FolderViewPage, ItemDetail, ItemDetailPage, ItemEdit, ItemEditPage, ImportCSV, ImportCSVPage, GroupManagement, GroupManagementPage, VaultSetup, VaultSetupPage, } from './pages/index';
export * from './components/index';
export * from './hooks/index';
export { navContributions as nav } from './nav';
export { vaultVaults, vaultFolders, vaultItems, vaultAcls, vaultSmsNumbers, vaultSmsMessages, vaultAuditEvents, vaultStaticGroups, vaultGroupMembers, vaultTypeEnum, itemTypeEnum, principalTypeEnum, smsStatusEnum, auditActionEnum, type VaultVault, type VaultFolder, type VaultItem, type VaultAcl, type VaultSmsNumber, type VaultSmsMessage, type VaultAuditEvent, type VaultStaticGroup, type VaultGroupMember, type InsertVaultVault, type InsertVaultFolder, type InsertVaultItem, type InsertVaultAcl, type InsertVaultSmsNumber, type InsertVaultSmsMessage, type InsertVaultAuditEvent, type InsertVaultStaticGroup, type InsertVaultGroupMember, VAULT_PERMISSIONS, type VaultPermission, } from './schema/vault';
export { VaultApiClient, vaultApi } from './services/vault-api';
//# sourceMappingURL=index.d.ts.map