'use client';
import { jsxs as _jsxs, Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import React, { useState, useEffect, useMemo } from 'react';
import { useUi, useAlertDialog } from '@hit/ui-kit';
import { Plus, Folder, FolderPlus, Trash2, ChevronRight, ChevronDown, Key, FileText, Lock, ShieldCheck, Check, GripVertical, Move, Users, Mail, Loader2, RefreshCw, Eye, Edit, Shield } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { AddItemModal } from '../components/AddItemModal';
import { FolderModal } from '../components/FolderModal';
import { FolderAclModal } from '../components/FolderAclModal';
import { isCurrentUserAdmin } from '../utils/user';
import { extractOtpWithConfidence } from '../utils/otp-extractor';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
export function VaultLanding({ onNavigate }) {
    const { Page, Card, Button, Select, Alert, AlertDialog } = useUi();
    const alertDialog = useAlertDialog();
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
    const [activeFolderId, setActiveFolderId] = useState(null);
    const [activeItemId, setActiveItemId] = useState(null);
    const [showMoveFolderModal, setShowMoveFolderModal] = useState(null);
    const [showMoveItemModal, setShowMoveItemModal] = useState(null);
    const [showAclModalFolderId, setShowAclModalFolderId] = useState(null);
    const [globalEmailAddress, setGlobalEmailAddress] = useState(null);
    const [emailOtpPollingFor, setEmailOtpPollingFor] = useState(null);
    const [emailOtpCopiedFor, setEmailOtpCopiedFor] = useState(null);
    // Check if current user is admin (for UI visibility)
    const isAdmin = useMemo(() => isCurrentUserAdmin(), []);
    // Fetch global email address
    useEffect(() => {
        async function fetchGlobalEmail() {
            try {
                const result = await vaultApi.getGlobalEmailAddress();
                setGlobalEmailAddress(result.emailAddress);
            }
            catch (err) {
                console.error('Failed to fetch global email address:', err);
            }
        }
        fetchGlobalEmail();
    }, []);
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
            // Get or create single personal vault (all users can have a personal vault)
            let personalVault = allVaults.find(v => v.type === 'personal');
            if (!personalVault) {
                personalVault = await vaultApi.createVault({
                    type: 'personal',
                    name: 'Personal Vault',
                });
            }
            // Only admins can create shared vaults; non-admins can only see shared vaults
            // they have ACL access to (which would already be in allVaults)
            let sharedVault = allVaults.find(v => v.type === 'shared');
            if (!sharedVault && isAdmin) {
                // Only admins can create the shared vault if it doesn't exist
                sharedVault = await vaultApi.createVault({
                    type: 'shared',
                    name: 'Shared Vault',
                });
            }
            // Store vaults the user has access to
            const vaultsList = [personalVault, sharedVault].filter(Boolean);
            setVaults(vaultsList);
            // Filter vaults based on selection
            let filteredVaults = vaultsList;
            if (vaultFilter === 'personal') {
                filteredVaults = [personalVault].filter(Boolean);
            }
            else if (vaultFilter === 'shared') {
                filteredVaults = sharedVault ? [sharedVault] : [];
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
    }, [vaultFilter, isAdmin]);
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
        const message = (_jsxs(_Fragment, { children: ["This will delete:", _jsxs("ul", { style: { marginTop: '8px', marginBottom: '8px', paddingLeft: '20px' }, children: [_jsxs("li", { children: [totalItems, " item(s)"] }), _jsxs("li", { children: [subfolders.length, " subfolder(s)"] })] }), "This action cannot be undone."] }));
        const confirmed = await alertDialog.showConfirm(message, {
            title: `Delete folder "${folder.name}"?`,
            variant: 'error',
            confirmText: 'OK',
            cancelText: 'Cancel',
        });
        if (!confirmed) {
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
            // Determine which vault to use:
            // - If folderId is provided, look up the folder to get its vaultId
            // - Otherwise, use personal vault as default
            const folderId = itemData.folderId !== undefined ? itemData.folderId : selectedFolderId;
            let targetVaultId;
            if (folderId) {
                // Get the folder to determine which vault it belongs to
                const folder = folders.find(f => f.id === folderId);
                if (folder) {
                    targetVaultId = folder.vaultId;
                }
                else {
                    // Folder not found in local state, fetch it
                    const folderData = await vaultApi.getFolder(folderId);
                    targetVaultId = folderData.vaultId;
                }
            }
            else {
                // No folder specified - use personal vault
                const personalVault = vaults.find(v => v.type === 'personal');
                if (!personalVault) {
                    // Reload to ensure vaults exist
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
            const createdItem = await vaultApi.createItem({
                ...itemData,
                vaultId: targetVaultId,
                folderId: folderId || null,
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
            setShowMoveItemModal(null);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to move item'));
        }
    }
    async function handleDeleteItem(item) {
        const confirmed = await alertDialog.showConfirm(`Are you sure you want to delete "${item.title}"? This action cannot be undone.`, {
            title: 'Delete Item',
            variant: 'error',
            confirmText: 'Delete',
            cancelText: 'Cancel',
        });
        if (!confirmed) {
            return;
        }
        try {
            await vaultApi.deleteItem(item.id);
            await loadData();
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to delete item'));
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
    async function handleQuickEmailOtp(item) {
        if (emailOtpPollingFor === item.id)
            return;
        setEmailOtpPollingFor(item.id);
        const startTime = new Date();
        const pollForOtp = async () => {
            try {
                const since = startTime.toISOString();
                const result = await vaultApi.getLatestEmailMessages({ since });
                for (const msg of result.messages) {
                    try {
                        const revealResult = await vaultApi.revealSmsMessage(msg.id);
                        const otpResult = extractOtpWithConfidence(revealResult.body);
                        if (otpResult.code) {
                            await navigator.clipboard.writeText(otpResult.code);
                            setEmailOtpPollingFor(null);
                            setEmailOtpCopiedFor(item.id);
                            setTimeout(() => setEmailOtpCopiedFor(null), 2000);
                            return true;
                        }
                    }
                    catch (err) {
                        console.error('Failed to reveal email message:', err);
                    }
                }
                return false;
            }
            catch (err) {
                console.error('Failed to poll email messages:', err);
                return false;
            }
        };
        // Poll every 2 seconds for up to 5 minutes
        const interval = setInterval(async () => {
            const found = await pollForOtp();
            if (found) {
                clearInterval(interval);
            }
        }, 2000);
        // Stop after 5 minutes
        setTimeout(() => {
            clearInterval(interval);
            setEmailOtpPollingFor(null);
        }, 5 * 60 * 1000);
    }
    async function handleMoveFolder(folderId, newParentId) {
        try {
            await vaultApi.moveFolder(folderId, newParentId);
            await loadData();
            setShowMoveFolderModal(null);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to move folder'));
        }
    }
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
    const handleDragStart = (event) => {
        const { active } = event;
        if (typeof active.id === 'string') {
            if (active.id.startsWith('folder:')) {
                setActiveFolderId(active.id.replace('folder:', ''));
            }
            else if (active.id.startsWith('item:')) {
                setActiveItemId(active.id.replace('item:', ''));
            }
        }
    };
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        setActiveFolderId(null);
        setActiveItemId(null);
        if (!over || active.id === over.id) {
            return;
        }
        const activeId = typeof active.id === 'string' ? active.id : null;
        const overId = typeof over.id === 'string' ? over.id : null;
        if (!activeId)
            return;
        // Handle folder drag and drop
        if (activeId.startsWith('folder:')) {
            const folderId = activeId.replace('folder:', '');
            const targetFolderId = overId?.startsWith('folder:') ? overId.replace('folder:', '') : null;
            // Prevent moving folder into itself or its descendants
            const isDescendant = (folderId, potentialParentId) => {
                const folder = folders.find(f => f.id === folderId);
                if (!folder || !folder.parentId)
                    return false;
                if (folder.parentId === potentialParentId)
                    return true;
                return isDescendant(folder.parentId, potentialParentId);
            };
            if (targetFolderId && isDescendant(targetFolderId, folderId)) {
                setError(new Error('Cannot move folder into its own subfolder'));
                return;
            }
            // If dropping on root (no overId or root drop zone), move to root
            // If dropping on another folder, move into that folder
            const newParentId = targetFolderId || null;
            await handleMoveFolder(folderId, newParentId);
        }
        // Handle item drag and drop
        else if (activeId.startsWith('item:')) {
            const itemId = activeId.replace('item:', '');
            let targetFolderId = null;
            if (overId?.startsWith('folder:')) {
                // Dropping on a folder
                targetFolderId = overId.replace('folder:', '');
            }
            else if (overId === 'root') {
                // Dropping on root drop zone
                targetFolderId = null;
            }
            else {
                // Dropping elsewhere, don't move
                return;
            }
            // Only move if the folder actually changed
            const item = items.find(i => i.id === itemId);
            if (item && item.folderId !== targetFolderId) {
                await handleMoveItem(itemId, targetFolderId);
            }
        }
    };
    if (loading) {
        return (_jsx(Page, { title: "Vault", description: "Loading...", children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    const breadcrumbs = [
        { label: 'Vault', icon: _jsx(Lock, { size: 14 }) },
    ];
    return (_jsxs(Page, { title: "Vault", description: "Manage your passwords and 2FA secrets", breadcrumbs: breadcrumbs, onNavigate: navigate, actions: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "[&>div]:!mb-0", children: _jsx(Select, { value: vaultFilter, onChange: (value) => setVaultFilter(value), options: [
                            { value: 'all', label: 'All Vaults' },
                            { value: 'personal', label: 'Personal Only' },
                            // Only show shared option if user has access to a shared vault
                            ...(vaults.some(v => v.type === 'shared') ? [{ value: 'shared', label: 'Shared Only' }] : []),
                        ] }) }), _jsxs(Button, { variant: "secondary", onClick: () => loadData(), disabled: loading, title: "Refresh", children: [_jsx(RefreshCw, { size: 16, className: `mr-2 ${loading ? 'animate-spin' : ''}` }), "Refresh"] }), _jsxs(Button, { variant: "secondary", onClick: () => setShowAddFolderModal(true), children: [_jsx(FolderPlus, { size: 16, className: "mr-2" }), "Add Folder"] }), _jsxs(Button, { variant: "primary", onClick: () => setShowAddItemModal(true), children: [_jsx(Plus, { size: 16, className: "mr-2" }), "Add Item"] })] }), children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), _jsxs(DndContext, { sensors: sensors, onDragStart: handleDragStart, onDragEnd: handleDragEnd, children: [_jsxs("div", { className: "space-y-6", children: [rootItems.length > 0 && (_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold mb-3", children: "Items" }), _jsx("div", { className: "border rounded-lg overflow-hidden", children: rootItems.map((item, index) => (_jsx(ItemRow, { item: item, folders: folders, onNavigate: navigate, onMoveItem: handleMoveItem, onQuickTotp: handleQuickTotp, totpCopied: totpCopiedFor === item.id, index: index, onDeleteItem: handleDeleteItem, showMoveItemModal: showMoveItemModal, onShowMoveItemModal: setShowMoveItemModal, globalEmailAddress: globalEmailAddress, onQuickEmailOtp: handleQuickEmailOtp, emailOtpPolling: emailOtpPollingFor === item.id, emailOtpCopied: emailOtpCopiedFor === item.id, isAdmin: isAdmin }, item.id))) })] })), _jsx(RootDropZone, {}), rootFolders.map(folder => (_jsx(FolderSection, { folder: folder, allFolders: folders, allItems: items, vaultTypeById: vaultTypeById, onNavigate: navigate, onDelete: handleDeleteFolder, onSelectFolder: setSelectedFolderId, onAddItem: (folderId) => {
                                    setSelectedFolderId(folderId);
                                    setShowAddItemModal(true);
                                }, expandedFolderIds: expandedFolderIds, onToggleExpanded: toggleFolderExpanded, onMoveItem: handleMoveItem, onQuickTotp: handleQuickTotp, totpCopiedFor: totpCopiedFor, onMoveFolder: handleMoveFolder, showMoveModal: showMoveFolderModal, onShowMoveModal: setShowMoveFolderModal, onDeleteItem: handleDeleteItem, showMoveItemModal: showMoveItemModal, onShowMoveItemModal: setShowMoveItemModal, onShowAclModal: setShowAclModalFolderId, globalEmailAddress: globalEmailAddress, onQuickEmailOtp: handleQuickEmailOtp, emailOtpPollingFor: emailOtpPollingFor, emailOtpCopiedFor: emailOtpCopiedFor, isAdmin: isAdmin }, folder.id))), rootFolders.length === 0 && rootItems.length === 0 && (_jsx(Card, { children: _jsxs("div", { className: "p-12 text-center", children: [_jsx(Lock, { className: "h-12 w-12 mx-auto mb-4 text-muted-foreground" }), _jsx("h3", { className: "text-lg font-semibold mb-2", children: "Your vault is empty" }), _jsx("p", { className: "text-sm text-muted-foreground mb-4", children: "Get started by adding your first password, SSH key, or secure note" }), _jsxs("div", { className: "flex justify-center gap-2", children: [_jsxs(Button, { variant: "secondary", onClick: () => setShowAddFolderModal(true), children: [_jsx(FolderPlus, { size: 16, className: "mr-2" }), "Create Folder"] }), _jsxs(Button, { variant: "primary", onClick: () => setShowAddItemModal(true), children: [_jsx(Plus, { size: 16, className: "mr-2" }), "Add Item"] })] })] }) }))] }), _jsx(DragOverlay, { children: activeFolderId ? (_jsx("div", { className: "border rounded-lg px-3 py-2 bg-secondary/40 opacity-50", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Folder, { className: "h-4 w-4" }), _jsx("span", { className: "font-medium text-sm", children: folders.find(f => f.id === activeFolderId)?.name || '' })] }) })) : activeItemId ? (_jsx("div", { className: "border rounded-lg px-3 py-2 bg-secondary/40 opacity-50", children: _jsx("div", { className: "flex items-center gap-2", children: (() => {
                                    const item = items.find(i => i.id === activeItemId);
                                    if (!item)
                                        return null;
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
                                    return (_jsxs(_Fragment, { children: [getItemIcon(), _jsx("span", { className: "font-medium text-sm", children: item.title })] }));
                                })() }) })) : null })] }), showAddItemModal && (_jsx(AddItemModal, { onClose: () => {
                    setShowAddItemModal(false);
                    setSelectedFolderId(null);
                }, onSave: handleCreateItem, folderId: selectedFolderId })), showAddFolderModal && (_jsx(FolderModal, { onClose: () => setShowAddFolderModal(false), onSave: handleCreateFolder, vaults: vaults, folders: folders, isAdmin: isAdmin })), showAclModalFolderId && (_jsx(FolderAclModal, { folderId: showAclModalFolderId, isOpen: !!showAclModalFolderId, onClose: () => setShowAclModalFolderId(null), onUpdate: () => {
                    loadData();
                } })), _jsx(AlertDialog, { ...alertDialog.props })] }));
}
function RootDropZone() {
    const { setNodeRef, isOver } = useDroppable({
        id: 'root',
        data: { type: 'drop-zone' },
    });
    return (_jsx("div", { ref: setNodeRef, className: isOver ? 'min-h-[20px] border-2 border-dashed border-primary rounded mb-2' : 'min-h-[4px] mb-2' }));
}
function FolderSection({ folder, allFolders, allItems, vaultTypeById, onNavigate, onDelete, onSelectFolder, onAddItem, expandedFolderIds, onToggleExpanded, onMoveItem, onQuickTotp, totpCopiedFor, onMoveFolder, showMoveModal, onShowMoveModal, onDeleteItem, showMoveItemModal, onShowMoveItemModal, onShowAclModal, globalEmailAddress, onQuickEmailOtp, emailOtpPollingFor, emailOtpCopiedFor, isAdmin = false, level = 0, }) {
    const { Button, Select } = useUi();
    const expanded = expandedFolderIds.has(folder.id);
    const subfolders = allFolders.filter(f => f.parentId === folder.id);
    const directItems = allItems.filter(item => item.folderId === folder.id);
    const folderScope = vaultTypeById[folder.vaultId];
    // Calculate indentation based on level
    const indentLevel = level;
    // Drag and drop setup
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `folder:${folder.id}`,
        data: { type: 'folder', folderId: folder.id },
    });
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
        id: `folder:${folder.id}`,
        data: { type: 'folder', folderId: folder.id },
    });
    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };
    // Get available folders for move dropdown (exclude current folder and its descendants)
    const availableFolders = useMemo(() => {
        // Check if potentialParent is a descendant of folder (to prevent moving folder into its own subfolder)
        const isDescendant = (potentialParentId, ancestorId) => {
            const potentialParent = allFolders.find(f => f.id === potentialParentId);
            if (!potentialParent || !potentialParent.parentId)
                return false;
            if (potentialParent.parentId === ancestorId)
                return true;
            return isDescendant(potentialParent.parentId, ancestorId);
        };
        return allFolders.filter(f => f.id !== folder.id &&
            f.vaultId === folder.vaultId &&
            !isDescendant(f.id, folder.id) // Don't allow moving into own descendants
        );
    }, [allFolders, folder.id, folder.vaultId]);
    // Always include current parent in options so Select can show correct current value
    // even if it's not in availableFolders (shouldn't happen, but safety check)
    const currentParent = folder.parentId ? allFolders.find(f => f.id === folder.parentId) : null;
    const foldersForOptions = currentParent && !availableFolders.find(f => f.id === currentParent.id)
        ? [currentParent, ...availableFolders]
        : availableFolders;
    const folderOptions = [
        { value: '', label: 'Root (no folder)' },
        ...foldersForOptions
            .slice()
            .sort((a, b) => (a.path || a.name).localeCompare(b.path || b.name))
            .map(f => ({
            value: f.id,
            label: `${'  '.repeat((f.path?.split('/').filter(Boolean).length || 1) - 1)}${f.name}`,
            disabled: f.id === folder.parentId, // Disable current parent so user can't "move" to same location
        })),
    ];
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
    return (_jsxs("div", { ref: setDroppableRef, className: `border rounded-lg ${isOver ? 'border-primary border-2' : ''}`, style: style, children: [_jsxs("div", { className: "px-3 py-2 bg-secondary/40 flex items-center justify-between", style: { paddingLeft: `${12 + indentLevel * 24}px` }, children: [_jsxs("div", { className: "flex items-center gap-1 flex-1 min-w-0", children: [_jsx("div", { ref: setNodeRef, ...attributes, ...listeners, className: "cursor-grab active:cursor-grabbing p-1 -ml-1", onClick: (e) => e.stopPropagation(), children: _jsx(GripVertical, { size: 14, className: "text-muted-foreground" }) }), (folder.permissionLevel === 'full' || folder.permissionLevel === 'read_write_delete') && (_jsx(Button, { variant: "ghost", size: "sm", onClick: (e) => {
                                    e.stopPropagation();
                                    onShowMoveModal(folder.id);
                                }, title: "Move folder", className: "p-1 h-auto", children: _jsx(Move, { size: 14 }) })), _jsxs("button", { onClick: () => onToggleExpanded(folder.id), className: "flex items-center gap-2 flex-1 text-left min-w-0", children: [expanded ? _jsx(ChevronDown, { className: "h-4 w-4" }) : _jsx(ChevronRight, { className: "h-4 w-4" }), _jsx(Folder, { className: "h-4 w-4" }), _jsx("span", { className: "font-medium text-sm truncate", children: folder.name }), folderScope && (_jsx("span", { className: [
                                            'text-[11px] px-2 py-0.5 rounded border flex-shrink-0',
                                            folderScope === 'personal'
                                                ? 'bg-blue-50 border-blue-200 text-blue-800'
                                                : 'bg-violet-50 border-violet-200 text-violet-800',
                                        ].join(' '), title: folderScope === 'personal' ? 'Personal Vault' : 'Shared Vault', children: folderScope === 'personal' ? 'Personal' : 'Shared' })), folder.permissionLevel && folder.permissionLevel !== 'none' && ((() => {
                                        const permissionLevel = folder.permissionLevel;
                                        const permissionConfig = {
                                            full: {
                                                icon: _jsx(Shield, { className: "h-3.5 w-3.5" }),
                                                label: 'Full Control',
                                                className: 'bg-green-50 border-green-200 text-green-800',
                                                title: 'Full Control (Read, Write, Delete, Manage ACL)',
                                            },
                                            read_write_delete: {
                                                icon: _jsx(Trash2, { className: "h-3.5 w-3.5" }),
                                                label: 'Read/Write/Delete',
                                                className: 'bg-purple-50 border-purple-200 text-purple-800',
                                                title: 'Read, Write & Delete Access',
                                            },
                                            read_write: {
                                                icon: _jsx(Edit, { className: "h-3.5 w-3.5" }),
                                                label: 'Read/Write',
                                                className: 'bg-blue-50 border-blue-200 text-blue-800',
                                                title: 'Read & Write Access',
                                            },
                                            read_only: {
                                                icon: _jsx(Eye, { className: "h-3.5 w-3.5" }),
                                                label: 'Read Only',
                                                className: 'bg-gray-50 border-gray-200 text-gray-800',
                                                title: 'Read Only Access',
                                            },
                                        };
                                        const config = permissionConfig[permissionLevel];
                                        return (_jsxs("span", { className: [
                                                'text-[11px] px-2 py-0.5 rounded border flex-shrink-0 flex items-center gap-1',
                                                config.className,
                                            ].join(' '), title: config.title, children: [config.icon, config.label] }));
                                    })()), _jsxs("span", { className: "text-sm text-muted-foreground flex-shrink-0", children: ["(", totalItems, " item", totalItems !== 1 ? 's' : '', ")"] })] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [folder.permissionLevel === 'full' && (_jsx(Button, { variant: "ghost", size: "sm", onClick: (e) => {
                                    e.stopPropagation();
                                    onShowAclModal(folder.id);
                                }, title: "Manage Access", children: _jsx(Users, { size: 14 }) })), (folder.permissionLevel === 'read_write' ||
                                folder.permissionLevel === 'read_write_delete' ||
                                folder.permissionLevel === 'full') && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => onAddItem(folder.id), children: _jsx(Plus, { size: 14 }) })), isAdmin && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => onDelete(folder), children: _jsx(Trash2, { size: 14 }) }))] })] }), showMoveModal === folder.id && (_jsxs("div", { className: "px-3 py-2 border-t bg-muted/30 flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Move to:" }), _jsx("div", { className: "flex-1 min-w-[200px]", children: _jsx(Select, { value: folder.parentId || '', onChange: (value) => {
                                // Explicitly handle empty string as root (null parentId)
                                const newParentId = value === '' ? null : value;
                                // Only move if the value actually changed
                                const currentParentId = folder.parentId || null;
                                if (newParentId !== currentParentId) {
                                    onMoveFolder(folder.id, newParentId);
                                }
                            }, options: folderOptions }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => onShowMoveModal(null), children: "Cancel" })] })), expanded && (_jsxs("div", { className: "border-t bg-background", children: [subfolders.map(subfolder => (_jsx(FolderSection, { folder: subfolder, allFolders: allFolders, allItems: allItems, vaultTypeById: vaultTypeById, onNavigate: onNavigate, onDelete: onDelete, onSelectFolder: onSelectFolder, onAddItem: (folderId) => {
                            onAddItem(folderId);
                        }, expandedFolderIds: expandedFolderIds, onToggleExpanded: onToggleExpanded, onMoveItem: onMoveItem, onQuickTotp: onQuickTotp, totpCopiedFor: totpCopiedFor, onMoveFolder: onMoveFolder, showMoveModal: showMoveModal, onShowMoveModal: onShowMoveModal, onDeleteItem: onDeleteItem, showMoveItemModal: showMoveItemModal, onShowMoveItemModal: onShowMoveItemModal, onShowAclModal: onShowAclModal, globalEmailAddress: globalEmailAddress, onQuickEmailOtp: onQuickEmailOtp, emailOtpPollingFor: emailOtpPollingFor, emailOtpCopiedFor: emailOtpCopiedFor, isAdmin: isAdmin, level: level + 1 }, subfolder.id))), subfolders.length > 0 && directItems.length > 0 && (_jsx("div", { className: "h-px bg-border/50" })), directItems.map((item, index) => (_jsx(ItemRow, { item: item, folders: allFolders, onNavigate: onNavigate, onMoveItem: onMoveItem, onQuickTotp: onQuickTotp, totpCopied: totpCopiedFor === item.id, index: index, indentLevel: indentLevel + 1, onDeleteItem: onDeleteItem, showMoveItemModal: showMoveItemModal, onShowMoveItemModal: onShowMoveItemModal, globalEmailAddress: globalEmailAddress, onQuickEmailOtp: onQuickEmailOtp, emailOtpPolling: emailOtpPollingFor === item.id, emailOtpCopied: emailOtpCopiedFor === item.id, isAdmin: isAdmin }, item.id))), subfolders.length === 0 && directItems.length === 0 && (_jsx("div", { className: "text-sm text-muted-foreground text-center py-6 bg-muted/20", children: "Empty folder" }))] }))] }));
}
function ItemRow({ item, folders, onNavigate, onMoveItem, onQuickTotp, totpCopied, index = 0, indentLevel = 0, onDeleteItem, showMoveItemModal, onShowMoveItemModal, globalEmailAddress, onQuickEmailOtp, emailOtpPolling, emailOtpCopied, isAdmin = false, }) {
    const { Button, Select } = useUi();
    // Drag and drop setup for items
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `item:${item.id}`,
        data: { type: 'item', itemId: item.id },
        disabled: !(item.canMove === true || item.canEdit === true),
    });
    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };
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
    // Get available folders for move dropdown (all accessible folders, including shared folders via ACL)
    const availableFolders = useMemo(() => {
        // Folders prop already contains only folders user has access to (filtered by ACL on server)
        // So we can show all folders, not just same vault
        return folders;
    }, [folders]);
    const folderOptions = [
        { value: '', label: 'No folder' },
        ...availableFolders
            .slice()
            .sort((a, b) => (a.path || a.name).localeCompare(b.path || b.name))
            .map(f => ({
            value: f.id,
            label: `${'  '.repeat((f.path?.split('/').filter(Boolean).length || 1) - 1)}${f.name}`,
            disabled: f.id === item.folderId, // Disable current folder so user can't "move" to same location
        })),
    ];
    const isEven = index % 2 === 0;
    // Check if item's username matches the global 2FA email address
    const canUseEmailOtp = globalEmailAddress && item.username &&
        item.username.toLowerCase() === globalEmailAddress.toLowerCase();
    const canMove = item.canMove === true || item.canEdit === true;
    return (_jsxs("div", { ref: setNodeRef, style: { ...style, paddingLeft: `${12 + indentLevel * 24}px` }, className: [
            'px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors border-b border-border/50 last:border-b-0',
            isEven ? 'bg-background' : 'bg-muted/30',
            'hover:bg-muted/60',
        ].join(' '), onClick: (e) => {
            const target = e.target;
            if (!target.closest('button') && !target.closest('select')) {
                onNavigate(`/vault/items/${item.id}`);
            }
        }, children: [_jsxs("div", { className: "flex items-center gap-2 flex-1 min-w-0", children: [canMove && (_jsx("div", { ...attributes, ...listeners, className: "cursor-grab active:cursor-grabbing p-1 -ml-1", onClick: (e) => e.stopPropagation(), children: _jsx(GripVertical, { size: 14, className: "text-muted-foreground" }) })), getItemIcon(), _jsxs("div", { className: "flex items-center gap-2 flex-1 min-w-0", children: [_jsx("span", { className: "text-sm font-medium truncate", children: item.title }), item.username && (_jsxs("span", { className: "text-xs text-muted-foreground truncate", children: ["\u2022 ", item.username] }))] })] }), _jsxs("div", { className: "flex items-center gap-2", onClick: (e) => e.stopPropagation(), children: [canUseEmailOtp && (_jsx(Button, { variant: "ghost", size: "sm", disabled: emailOtpPolling, title: emailOtpPolling ? 'Waiting for email OTP...' : 'Get email OTP code', onClick: () => onQuickEmailOtp(item), children: emailOtpCopied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : emailOtpPolling ? (_jsx(Loader2, { size: 16, className: "animate-spin text-blue-500" })) : (_jsx(Mail, { size: 16, className: "text-blue-500" })) })), _jsx(Button, { variant: "ghost", size: "sm", disabled: !item.hasTotp, title: item.hasTotp ? 'Copy current 2FA code' : '2FA off', onClick: () => onQuickTotp(item), children: totpCopied ? _jsx(Check, { size: 16, className: "text-green-600" }) : _jsx(ShieldCheck, { size: 16 }) }), canMove && (_jsx(Button, { variant: "ghost", size: "sm", onClick: (e) => {
                            e.stopPropagation();
                            onShowMoveItemModal(item.id);
                        }, title: "Move item to folder", children: _jsx(Move, { size: 14 }) })), isAdmin && (_jsx(Button, { variant: "ghost", size: "sm", onClick: (e) => {
                            e.stopPropagation();
                            onDeleteItem(item);
                        }, title: "Delete item", children: _jsx(Trash2, { size: 14 }) }))] }), showMoveItemModal === item.id && (_jsxs("div", { className: "px-3 py-2 border-t bg-muted/30 flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Move to:" }), _jsx("div", { className: "flex-1 min-w-[200px]", children: _jsx(Select, { value: item.folderId || '', onChange: (value) => {
                                // Explicitly handle empty string as root (null folderId)
                                const newFolderId = value === '' ? null : value;
                                // Only move if the value actually changed
                                const currentFolderId = item.folderId || null;
                                if (newFolderId !== currentFolderId) {
                                    onMoveItem(item.id, newFolderId);
                                }
                            }, options: folderOptions }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => onShowMoveItemModal(null), children: "Cancel" })] }))] }));
}
export default VaultLanding;
