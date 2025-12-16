'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect, useMemo } from 'react';
import { useUi } from '@hit/ui-kit';
import { Plus, Folder, FolderPlus, Trash2, ChevronRight, ChevronDown, Key, FileText, Lock, ShieldCheck, ArrowRightLeft, Check } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { AddItemModal } from '../components/AddItemModal';
import { FolderModal } from '../components/FolderModal';
export function VaultLanding({ onNavigate }) {
    const { Page, Card, Button, Select, Alert } = useUi();
    const [vaultFilter, setVaultFilter] = useState('all');
    const [vaults, setVaults] = useState([]);
    const [folders, setFolders] = useState([]);
    const [items, setItems] = useState([]);
    const [selectedFolderId, setSelectedFolderId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [showAddFolderModal, setShowAddFolderModal] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState(null);
    const [expandedFolderIds, setExpandedFolderIds] = useState(new Set());
    const [totpCopiedFor, setTotpCopiedFor] = useState(null);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vaultFilter]);
    const loadData = React.useCallback(async () => {
        try {
            setLoading(true);
            const allVaults = await vaultApi.getVaults();
            // Get or create single personal vault
            let personalVault = allVaults.find(v => v.type === 'personal');
            if (!personalVault) {
                personalVault = await vaultApi.createVault({
                    type: 'personal',
                    name: 'Personal Vault',
                });
            }
            // Get or create single shared vault
            let sharedVault = allVaults.find(v => v.type === 'shared');
            if (!sharedVault) {
                sharedVault = await vaultApi.createVault({
                    type: 'shared',
                    name: 'Shared Vault',
                });
            }
            // Store both vaults
            const vaultsList = [personalVault, sharedVault].filter(Boolean);
            setVaults(vaultsList);
            // Filter vaults based on selection
            let filteredVaults = vaultsList;
            if (vaultFilter === 'personal') {
                filteredVaults = [personalVault].filter(Boolean);
            }
            else if (vaultFilter === 'shared') {
                filteredVaults = [sharedVault].filter(Boolean);
            }
            // Load folders and items for filtered vaults
            const foldersPromises = filteredVaults.map(v => vaultApi.getFolders(v.id));
            const itemsPromises = filteredVaults.map(v => vaultApi.getItems(v.id));
            const foldersResults = await Promise.all(foldersPromises);
            const itemsResults = await Promise.all(itemsPromises);
            setFolders(foldersResults.flat());
            setItems(itemsResults.flat());
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load vault data'));
        }
        finally {
            setLoading(false);
        }
    }, [vaultFilter]);
    async function handleCreateFolder(name, parentId, vaultId) {
        try {
            // VaultId should always be provided (from FolderModal scope selection)
            // But if not, use personal vault as fallback
            let targetVaultId = vaultId;
            if (!targetVaultId) {
                const personalVault = vaults.find(v => v.type === 'personal');
                if (!personalVault) {
                    // This shouldn't happen as loadData ensures vaults exist, but handle it anyway
                    await loadData();
                    const updatedVaults = await vaultApi.getVaults();
                    const fallbackVault = updatedVaults.find(v => v.type === 'personal');
                    if (!fallbackVault) {
                        throw new Error('Personal vault not available');
                    }
                    targetVaultId = fallbackVault.id;
                }
                else {
                    targetVaultId = personalVault.id;
                }
            }
            // Backend calculates path automatically, no need to pass it
            await vaultApi.createFolder({
                vaultId: targetVaultId,
                parentId,
                name,
            });
            await loadData();
            setShowAddFolderModal(false);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to create folder'));
        }
    }
    async function handleDeleteFolder(folder) {
        // Count items in folder and subfolders
        const folderItems = items.filter(item => item.folderId === folder.id);
        const subfolders = folders.filter(f => f.parentId === folder.id || (f.path.startsWith(folder.path + '/') && f.id !== folder.id));
        // Count items in subfolders recursively
        let totalSubfolderItems = 0;
        const countSubfolderItems = (parentFolderId) => {
            const directItems = items.filter(item => item.folderId === parentFolderId).length;
            const childFolders = folders.filter(f => f.parentId === parentFolderId);
            const childItems = childFolders.reduce((sum, child) => sum + countSubfolderItems(child.id), 0);
            return directItems + childItems;
        };
        totalSubfolderItems = countSubfolderItems(folder.id);
        const totalItems = folderItems.length + totalSubfolderItems;
        const confirmMessage = `Delete folder "${folder.name}"?\n\nThis will delete:\n- ${totalItems} item(s)\n- ${subfolders.length} subfolder(s)\n\nThis action cannot be undone.`;
        if (!confirm(confirmMessage)) {
            return;
        }
        try {
            await vaultApi.deleteFolder(folder.id);
            await loadData();
            setFolderToDelete(null);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to delete folder'));
        }
    }
    async function handleCreateItem(itemData) {
        try {
            // Use personal vault by default (vaults are ensured by loadData)
            const personalVault = vaults.find(v => v.type === 'personal');
            if (!personalVault) {
                // Reload to ensure vaults exist
                await loadData();
                const updatedVaults = await vaultApi.getVaults();
                const fallbackVault = updatedVaults.find(v => v.type === 'personal');
                if (!fallbackVault) {
                    throw new Error('Personal vault not available');
                }
                // Use fallback vault
                const createdItem = await vaultApi.createItem({
                    ...itemData,
                    vaultId: fallbackVault.id,
                    folderId: selectedFolderId || null,
                });
                if (itemData.totpSecret && createdItem.id) {
                    await vaultApi.importTotp(createdItem.id, itemData.totpSecret);
                }
                await loadData();
                setShowAddItemModal(false);
                return;
            }
            // Backend will set createdBy from authenticated user
            const createdItem = await vaultApi.createItem({
                ...itemData,
                vaultId: personalVault.id,
                folderId: selectedFolderId || null,
            });
            // If TOTP secret was provided, import it after creating the item
            if (itemData.totpSecret && createdItem.id) {
                await vaultApi.importTotp(createdItem.id, itemData.totpSecret);
            }
            await loadData();
            setShowAddItemModal(false);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to create item'));
        }
    }
    // Group items by folder
    const rootFolders = folders.filter(f => !f.parentId);
    const rootItems = items.filter(item => !item.folderId);
    const itemsByFolder = folders.reduce((acc, folder) => {
        acc[folder.id] = items.filter(item => item.folderId === folder.id);
        return acc;
    }, {});
    const vaultTypeById = useMemo(() => {
        const map = {};
        for (const v of vaults)
            map[v.id] = v.type;
        return map;
    }, [vaults]);
    const toggleFolderExpanded = (folderId) => {
        setExpandedFolderIds(prev => {
            const next = new Set(prev);
            if (next.has(folderId))
                next.delete(folderId);
            else
                next.add(folderId);
            return next;
        });
    };
    async function handleMoveItem(itemId, newFolderId) {
        try {
            await vaultApi.moveItem(itemId, newFolderId);
            await loadData();
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to move item'));
        }
    }
    async function handleQuickTotp(item) {
        try {
            const result = await vaultApi.generateTotpCode(item.id);
            await navigator.clipboard.writeText(result.code);
            setTotpCopiedFor(item.id);
            setTimeout(() => setTotpCopiedFor(null), 2000);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to generate 2FA code'));
        }
    }
    if (loading) {
        return (_jsx(Page, { title: "Vault", description: "Loading...", children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    return (_jsxs(Page, { title: "Vault", description: "Manage your passwords and 2FA secrets", actions: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "[&>div]:!mb-0", children: _jsx(Select, { value: vaultFilter, onChange: (value) => setVaultFilter(value), options: [
                            { value: 'all', label: 'All Vaults' },
                            { value: 'personal', label: 'Personal Only' },
                            { value: 'shared', label: 'Shared Only' },
                        ] }) }), _jsxs(Button, { variant: "secondary", onClick: () => setShowAddFolderModal(true), children: [_jsx(FolderPlus, { size: 16, className: "mr-2" }), "Add Folder"] }), _jsxs(Button, { variant: "primary", onClick: () => setShowAddItemModal(true), children: [_jsx(Plus, { size: 16, className: "mr-2" }), "Add Item"] })] }), children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), _jsxs("div", { className: "space-y-6", children: [rootItems.length > 0 && (_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold mb-3", children: "Items" }), _jsx("div", { className: "grid gap-2", children: rootItems.map(item => (_jsx(ItemRow, { item: item, folders: folders.filter(f => f.vaultId === item.vaultId), onNavigate: navigate, onMoveItem: handleMoveItem, onQuickTotp: handleQuickTotp, totpCopied: totpCopiedFor === item.id }, item.id))) })] })), rootFolders.map(folder => (_jsx(FolderSection, { folder: folder, allFolders: folders, allItems: items, vaultTypeById: vaultTypeById, onNavigate: navigate, onDelete: handleDeleteFolder, onSelectFolder: setSelectedFolderId, onAddItem: () => {
                            setSelectedFolderId(folder.id);
                            setShowAddItemModal(true);
                        }, expandedFolderIds: expandedFolderIds, onToggleExpanded: toggleFolderExpanded, onMoveItem: handleMoveItem, onQuickTotp: handleQuickTotp, totpCopiedFor: totpCopiedFor }, folder.id))), rootFolders.length === 0 && rootItems.length === 0 && (_jsx(Card, { children: _jsxs("div", { className: "p-12 text-center", children: [_jsx(Lock, { className: "h-12 w-12 mx-auto mb-4 text-muted-foreground" }), _jsx("h3", { className: "text-lg font-semibold mb-2", children: "Your vault is empty" }), _jsx("p", { className: "text-sm text-muted-foreground mb-4", children: "Get started by adding your first password, SSH key, or secure note" }), _jsxs("div", { className: "flex justify-center gap-2", children: [_jsxs(Button, { variant: "secondary", onClick: () => setShowAddFolderModal(true), children: [_jsx(FolderPlus, { size: 16, className: "mr-2" }), "Create Folder"] }), _jsxs(Button, { variant: "primary", onClick: () => setShowAddItemModal(true), children: [_jsx(Plus, { size: 16, className: "mr-2" }), "Add Item"] })] })] }) }))] }), showAddItemModal && (_jsx(AddItemModal, { onClose: () => {
                    setShowAddItemModal(false);
                    setSelectedFolderId(null);
                }, onSave: handleCreateItem, folderId: selectedFolderId })), showAddFolderModal && (_jsx(FolderModal, { onClose: () => setShowAddFolderModal(false), onSave: handleCreateFolder, vaults: vaults, folders: folders }))] }));
}
function FolderSection({ folder, allFolders, allItems, vaultTypeById, onNavigate, onDelete, onSelectFolder, onAddItem, expandedFolderIds, onToggleExpanded, onMoveItem, onQuickTotp, totpCopiedFor, }) {
    const { Button } = useUi();
    const expanded = expandedFolderIds.has(folder.id);
    const subfolders = allFolders.filter(f => f.parentId === folder.id);
    const directItems = allItems.filter(item => item.folderId === folder.id);
    const folderScope = vaultTypeById[folder.vaultId];
    // Count items in this folder and all subfolders (with cycle detection)
    const totalItems = useMemo(() => {
        const visited = new Set();
        const countRecursive = (folderId) => {
            // Prevent infinite loops from circular references
            if (visited.has(folderId)) {
                console.warn(`Circular reference detected in folder ${folderId}`);
                return 0;
            }
            visited.add(folderId);
            try {
                const directItemsCount = allItems.filter(item => item.folderId === folderId).length;
                const childFolders = allFolders.filter(f => f.parentId === folderId);
                const childItems = childFolders.reduce((sum, child) => {
                    return sum + countRecursive(child.id);
                }, 0);
                return directItemsCount + childItems;
            }
            finally {
                visited.delete(folderId);
            }
        };
        return countRecursive(folder.id);
    }, [folder.id, allItems, allFolders]);
    return (_jsxs("div", { className: "border rounded-lg", children: [_jsxs("div", { className: "px-3 py-2 bg-secondary/40 flex items-center justify-between", children: [_jsxs("button", { onClick: () => onToggleExpanded(folder.id), className: "flex items-center gap-2 flex-1 text-left", children: [expanded ? _jsx(ChevronDown, { className: "h-4 w-4" }) : _jsx(ChevronRight, { className: "h-4 w-4" }), _jsx(Folder, { className: "h-4 w-4" }), _jsx("span", { className: "font-medium text-sm", children: folder.name }), folderScope && (_jsx("span", { className: [
                                    'text-[11px] px-2 py-0.5 rounded border',
                                    folderScope === 'personal'
                                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                                        : 'bg-violet-50 border-violet-200 text-violet-800',
                                ].join(' '), title: folderScope === 'personal' ? 'Personal Vault' : 'Shared Vault', children: folderScope === 'personal' ? 'Personal' : 'Shared' })), _jsxs("span", { className: "text-sm text-muted-foreground", children: ["(", totalItems, " item", totalItems !== 1 ? 's' : '', ")"] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: onAddItem, children: _jsx(Plus, { size: 14 }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => onDelete(folder), children: _jsx(Trash2, { size: 14 }) })] })] }), expanded && (_jsxs("div", { className: "px-3 py-2 space-y-1", children: [subfolders.map(subfolder => (_jsx(FolderSection, { folder: subfolder, allFolders: allFolders, allItems: allItems, vaultTypeById: vaultTypeById, onNavigate: onNavigate, onDelete: onDelete, onSelectFolder: onSelectFolder, onAddItem: () => {
                            onSelectFolder(subfolder.id);
                            onAddItem();
                        }, expandedFolderIds: expandedFolderIds, onToggleExpanded: onToggleExpanded, onMoveItem: onMoveItem, onQuickTotp: onQuickTotp, totpCopiedFor: totpCopiedFor }, subfolder.id))), directItems.map(item => (_jsx(ItemRow, { item: item, folders: allFolders.filter(f => f.vaultId === item.vaultId), onNavigate: onNavigate, onMoveItem: onMoveItem, onQuickTotp: onQuickTotp, totpCopied: totpCopiedFor === item.id }, item.id))), subfolders.length === 0 && directItems.length === 0 && (_jsx("div", { className: "text-sm text-muted-foreground text-center py-4", children: "Empty folder" }))] }))] }));
}
function ItemRow({ item, folders, onNavigate, onMoveItem, onQuickTotp, totpCopied, }) {
    const { Button, Select } = useUi();
    const getItemIcon = () => {
        switch (item.type) {
            case 'api_key':
                return _jsx(Key, { size: 14 });
            case 'secure_note':
                return _jsx(FileText, { size: 14 });
            default:
                return _jsx(Lock, { size: 14 });
        }
    };
    const folderOptions = [
        { value: '', label: 'No folder' },
        ...folders
            .slice()
            .sort((a, b) => (a.path || a.name).localeCompare(b.path || b.name))
            .map(f => ({
            value: f.id,
            label: `${'  '.repeat((f.path?.split('/').filter(Boolean).length || 1) - 1)}${f.name}`,
        })),
    ];
    return (_jsxs("div", { className: "px-3 py-2 flex items-center justify-between gap-3 hover:bg-secondary/50 rounded cursor-pointer border border-transparent hover:border-border transition-colors", onClick: (e) => {
            const target = e.target;
            if (!target.closest('button') && !target.closest('select')) {
                onNavigate(`/vault/items/${item.id}`);
            }
        }, children: [_jsxs("div", { className: "flex items-center gap-2 flex-1 min-w-0", children: [getItemIcon(), _jsxs("div", { className: "flex items-center gap-2 flex-1 min-w-0", children: [_jsx("span", { className: "text-sm font-medium truncate", children: item.title }), item.username && (_jsxs("span", { className: "text-xs text-muted-foreground truncate", children: ["\u2022 ", item.username] }))] })] }), _jsxs("div", { className: "flex items-center gap-2", onClick: (e) => e.stopPropagation(), children: [_jsx(Button, { variant: "ghost", size: "sm", disabled: !item.hasTotp, title: item.hasTotp ? 'Copy current 2FA code' : '2FA off', onClick: () => onQuickTotp(item), children: totpCopied ? _jsx(Check, { size: 16, className: "text-green-600" }) : _jsx(ShieldCheck, { size: 16 }) }), _jsx("div", { className: "min-w-[160px]", title: "Move item to folder", children: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx(ArrowRightLeft, { size: 14, className: "text-muted-foreground" }), _jsx(Select, { value: item.folderId || '', onChange: (value) => onMoveItem(item.id, value ? value : null), options: folderOptions })] }) })] })] }));
}
export default VaultLanding;
