import type { VaultVault, VaultFolder } from '../schema/vault';
interface Props {
    onClose: () => void;
    onSave: (name: string, parentId: string | null, vaultId: string) => Promise<void>;
    vaults: VaultVault[];
    folders: VaultFolder[];
    isAdmin?: boolean;
}
export declare function FolderModal({ onClose, onSave, vaults, folders, isAdmin }: Props): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=FolderModal.d.ts.map