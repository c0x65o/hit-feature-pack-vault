/**
 * Vault Pages
 *
 * Using direct exports for optimal tree-shaking and code splitting.
 * Each component is only bundled when actually imported/used.
 */
export { VaultLanding, default as VaultLandingPage } from './VaultLanding';
export { PersonalVault, default as PersonalVaultPage } from './PersonalVault';
export { SharedVaults, default as SharedVaultsPage } from './SharedVaults';
export { SharedVaultDetail, default as SharedVaultDetailPage } from './SharedVaultDetail';
export { FolderView, default as FolderViewPage } from './FolderView';
export { ItemDetail, default as ItemDetailPage } from './ItemDetail';
export { ItemEdit, default as ItemEditPage } from './ItemEdit';
export { GroupManagement, default as GroupManagementPage } from './GroupManagement';
export { PhoneNumberSetup, default as PhoneNumberSetupPage } from './PhoneNumberSetup';
export { VaultSetup, default as VaultSetupPage } from './VaultSetup';
