'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save } from 'lucide-react';
export function FolderModal({ onClose, onSave, vaults, folders, isAdmin = false }) {
    const { Modal, Button, Input, Select, Alert } = useUi();
    const [open, setOpen] = useState(true);
    const [name, setName] = useState('');
    const [scope, setScope] = useState('personal');
    const [vaultId, setVaultId] = useState('');
    const [parentId, setParentId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    // Get single vaults by type (there should only be one of each)
    const personalVault = vaults.find(v => v.type === 'personal');
    const sharedVault = vaults.find(v => v.type === 'shared');
    // Only admins can CREATE folders in the shared vault
    // Non-admin users can see folders via ACL but cannot create new ones
    const canCreateInShared = isAdmin && !!sharedVault;
    useEffect(() => {
        // When scope changes, update vaultId to the appropriate single vault
        if (scope === 'personal') {
            setVaultId(personalVault?.id || ''); // Will be created if needed
        }
        else {
            setVaultId(sharedVault?.id || ''); // Will be created if needed
        }
        // Reset parent folder when scope changes
        setParentId(null);
    }, [scope, personalVault, sharedVault]);
    // Get folders for the selected vault
    const selectedVaultId = vaultId || (scope === 'personal' ? personalVault?.id : sharedVault?.id);
    const rootFolders = folders.filter(f => !f.parentId && f.vaultId === selectedVaultId);
    async function handleSave() {
        if (!name.trim()) {
            setError(new Error('Folder name is required'));
            return;
        }
        // Determine target vault ID based on scope (single vault per type)
        const targetVaultId = scope === 'personal'
            ? (vaultId || personalVault?.id || '')
            : (vaultId || sharedVault?.id || '');
        if (!targetVaultId) {
            // Vaults should be auto-created by parent component, but handle error case
            setError(new Error(`${scope === 'personal' ? 'Personal' : 'Shared'} vault not available. Please try again.`));
            return;
        }
        try {
            setSaving(true);
            setError(null);
            await onSave(name.trim(), parentId, targetVaultId);
            handleClose();
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to create folder'));
        }
        finally {
            setSaving(false);
        }
    }
    const handleClose = () => {
        setOpen(false);
        onClose();
    };
    return (_jsx(Modal, { open: open, title: "Create Folder", onClose: handleClose, children: _jsxs("div", { className: "space-y-4", children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), canCreateInShared ? (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Scope *" }), _jsx("p", { className: "text-xs text-muted-foreground mt-1 mb-2", children: "Choose whether this folder is personal (only you can access) or shared (controlled by folder sharing)" }), _jsx(Select, { value: scope, onChange: (value) => setScope(value), options: [
                                { value: 'personal', label: 'Personal (only you can access)' },
                                { value: 'shared', label: 'Shared (controlled by folder sharing)' },
                            ] })] })) : (_jsx("p", { className: "text-sm text-muted-foreground", children: "This folder will be added to your personal vault." })), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Folder Name *" }), _jsx(Input, { value: name, onChange: (value) => setName(value), placeholder: "e.g., Work, Personal" })] }), rootFolders.length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Parent Folder (Optional)" }), _jsx(Select, { value: parentId || '', onChange: (value) => setParentId(value || null), options: [
                                { value: '', label: 'Root (no parent)' },
                                ...rootFolders.map(f => ({
                                    value: f.id,
                                    label: f.name,
                                })),
                            ] })] })), _jsxs("div", { className: "flex justify-end gap-2 pt-4 border-t", children: [_jsx(Button, { variant: "secondary", onClick: handleClose, children: "Cancel" }), _jsxs(Button, { variant: "primary", onClick: handleSave, disabled: saving || !name.trim(), children: [_jsx(Save, { size: 16, className: "mr-2" }), saving ? 'Creating...' : 'Create'] })] })] }) }));
}
