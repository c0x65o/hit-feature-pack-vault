'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { BreadcrumbItem } from '@hit/ui-kit';
import { useUi } from '@hit/ui-kit';
import { useAlertDialog } from '@hit/ui-kit/hooks/useAlertDialog';
import { Plus, Folder, FolderPlus, Trash2, ChevronRight, ChevronDown, Key, FileText, Lock, ShieldCheck, ArrowRightLeft, Check, GripVertical, Move, Users, Mail, Loader2, RefreshCw, Eye, Edit, Shield, ExternalLink, MessageSquare, Copy, User, KeyRound } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultVault, VaultFolder, VaultItem } from '../schema/vault';
import { AddItemModal } from '../components/AddItemModal';
import { FolderModal } from '../components/FolderModal';
import { FolderAclModal } from '../components/FolderAclModal';
import { OtpWaitingModal } from '../components/OtpWaitingModal';
import { isCurrentUserAdmin } from '../utils/user';
import { extractOtpWithConfidence } from '../utils/otp-extractor';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

type VaultFilter = 'all' | 'personal' | 'shared';

interface Props {
  onNavigate?: (path: string) => void;
}

type VaultItemRow = VaultItem & { hasTotp?: boolean; twoFactorType?: string | null };

export function VaultLanding({ onNavigate }: Props) {
  const { Page, Card, Button, Select, Alert, AlertDialog } = useUi();
  const alertDialog = useAlertDialog();
  const [vaultFilter, setVaultFilter] = useState<VaultFilter>('all');
  const [vaults, setVaults] = useState<VaultVault[]>([]);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [items, setItems] = useState<VaultItemRow[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<VaultFolder | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [totpCopiedFor, setTotpCopiedFor] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [showMoveFolderModal, setShowMoveFolderModal] = useState<string | null>(null);
  const [showMoveItemModal, setShowMoveItemModal] = useState<string | null>(null);
  const [showAclModalFolderId, setShowAclModalFolderId] = useState<string | null>(null);
  const [globalEmailAddress, setGlobalEmailAddress] = useState<string | null>(null);
  const [emailOtpPollingFor, setEmailOtpPollingFor] = useState<string | null>(null);
  const [emailOtpCopiedFor, setEmailOtpCopiedFor] = useState<string | null>(null);
  const [otpWaitingModalItem, setOtpWaitingModalItem] = useState<VaultItemRow | null>(null);
  const [smsOtpModalItemId, setSmsOtpModalItemId] = useState<string | null>(null);
  const [itemsWithSms, setItemsWithSms] = useState<Set<string>>(new Set());
  
  // Check if current user is admin (for UI visibility)
  const isAdmin = useMemo(() => isCurrentUserAdmin(), []);

  // Fetch global email address
  useEffect(() => {
    async function fetchGlobalEmail() {
      try {
        const result = await vaultApi.getGlobalEmailAddress();
        setGlobalEmailAddress(result.emailAddress);
      } catch (err) {
        console.error('Failed to fetch global email address:', err);
      }
    }
    fetchGlobalEmail();
  }, []);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
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
      const vaultsList = [personalVault, sharedVault].filter(Boolean) as VaultVault[];
      setVaults(vaultsList);
      
      // Filter vaults based on selection
      let filteredVaults = vaultsList;
      if (vaultFilter === 'personal') {
        filteredVaults = [personalVault].filter(Boolean) as VaultVault[];
      } else if (vaultFilter === 'shared') {
        filteredVaults = sharedVault ? [sharedVault] : [];
      }
      
      // Load folders and items for filtered vaults
      const foldersPromises = filteredVaults.map(v => vaultApi.getFolders(v.id));
      const itemsPromises = filteredVaults.map(v => vaultApi.getItems(v.id));
      
      const foldersResults = await Promise.all(foldersPromises);
      const itemsResults = await Promise.all(itemsPromises);
      
      setFolders(foldersResults.flat());
      const allItems = itemsResults.flat() as any;
      setItems(allItems);
      
      // Determine which items have SMS 2FA enabled based on twoFactorType preference
      const itemsWithSmsSet = new Set<string>();
      allItems.forEach((item: VaultItemRow) => {
        if (item.twoFactorType === 'phone') {
          itemsWithSmsSet.add(item.id);
        }
      });
      setItemsWithSms(itemsWithSmsSet);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load vault data'));
    } finally {
      setLoading(false);
    }
  }, [vaultFilter, isAdmin]);

  async function handleCreateFolder(name: string, parentId: string | null, vaultId: string) {
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
        } else {
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
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create folder'));
    }
  }

  async function handleDeleteFolder(folder: VaultFolder) {
    // Count items in folder and subfolders
    const folderItems = items.filter(item => item.folderId === folder.id);
    const subfolders = folders.filter(f => f.parentId === folder.id || (f.path.startsWith(folder.path + '/') && f.id !== folder.id));
    
    // Count items in subfolders recursively
    let totalSubfolderItems = 0;
    const countSubfolderItems = (parentFolderId: string): number => {
      const directItems = items.filter(item => item.folderId === parentFolderId).length;
      const childFolders = folders.filter(f => f.parentId === parentFolderId);
      const childItems = childFolders.reduce((sum: number, child) => sum + countSubfolderItems(child.id), 0);
      return directItems + childItems;
    };
    totalSubfolderItems = countSubfolderItems(folder.id);
    
    const totalItems = folderItems.length + totalSubfolderItems;
    const message = (
      <>
        This will delete:
        <ul style={{ marginTop: '8px', marginBottom: '8px', paddingLeft: '20px' }}>
          <li>{totalItems} item(s)</li>
          <li>{subfolders.length} subfolder(s)</li>
        </ul>
        This action cannot be undone.
      </>
    );
    
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
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete folder'));
    }
  }

  async function handleCreateItem(itemData: any) {
    try {
      // Determine which vault to use:
      // - If folderId is provided, look up the folder to get its vaultId
      // - Otherwise, use personal vault as default
      const folderId = itemData.folderId !== undefined ? itemData.folderId : selectedFolderId;
      let targetVaultId: string;
      
      if (folderId) {
        // Get the folder to determine which vault it belongs to
        const folder = folders.find(f => f.id === folderId);
        if (folder) {
          targetVaultId = folder.vaultId;
        } else {
          // Folder not found in local state, fetch it
          const folderData = await vaultApi.getFolder(folderId);
          targetVaultId = folderData.vaultId;
        }
      } else {
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
        } else {
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
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create item'));
    }
  }

  // Group items by folder
  const rootFolders = folders.filter(f => !f.parentId);
  const rootItems = items.filter(item => !item.folderId);
  const itemsByFolder = folders.reduce((acc, folder) => {
    acc[folder.id] = items.filter(item => item.folderId === folder.id);
    return acc;
  }, {} as Record<string, VaultItemRow[]>);

  const vaultTypeById = useMemo(() => {
    const map: Record<string, VaultVault['type']> = {};
    for (const v of vaults) map[v.id] = v.type;
    return map;
  }, [vaults]);

  // Group root folders by vault type and sort alphabetically
  const groupedFolders = useMemo(() => {
    const personal: typeof rootFolders = [];
    const shared: typeof rootFolders = [];
    
    rootFolders.forEach(folder => {
      const vaultType = vaultTypeById[folder.vaultId];
      if (vaultType === 'personal') {
        personal.push(folder);
      } else if (vaultType === 'shared') {
        shared.push(folder);
      }
    });
    
    // Sort alphabetically by name
    personal.sort((a, b) => a.name.localeCompare(b.name));
    shared.sort((a, b) => a.name.localeCompare(b.name));
    
    return { personal, shared };
  }, [rootFolders, vaultTypeById]);

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  async function handleMoveItem(itemId: string, newFolderId: string | null) {
    try {
      await vaultApi.moveItem(itemId, newFolderId);
      await loadData();
      setShowMoveItemModal(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to move item'));
    }
  }

  async function handleDeleteItem(item: VaultItemRow) {
    const confirmed = await alertDialog.showConfirm(
      `Are you sure you want to delete "${item.title}"? This action cannot be undone.`,
      {
        title: 'Delete Item',
        variant: 'error',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      }
    );

    if (!confirmed) {
      return;
    }

    try {
      await vaultApi.deleteItem(item.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete item'));
    }
  }

  async function handleQuickTotp(item: VaultItemRow) {
    try {
      const result = await vaultApi.generateTotpCode(item.id);
      await navigator.clipboard.writeText(result.code);
      setTotpCopiedFor(item.id);
      setTimeout(() => setTotpCopiedFor(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate 2FA code'));
    }
  }

  async function handleQuickEmailOtp(item: VaultItemRow) {
    // Open the OTP waiting modal instead of silent polling
    setOtpWaitingModalItem(item);
  }

  async function handleMoveFolder(folderId: string, newParentId: string | null) {
    try {
      await vaultApi.moveFolder(folderId, newParentId);
      await loadData();
      setShowMoveFolderModal(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to move folder'));
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (typeof active.id === 'string') {
      if (active.id.startsWith('folder:')) {
        setActiveFolderId(active.id.replace('folder:', ''));
      } else if (active.id.startsWith('item:')) {
        setActiveItemId(active.id.replace('item:', ''));
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveFolderId(null);
    setActiveItemId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = typeof active.id === 'string' ? active.id : null;
    const overId = typeof over.id === 'string' ? over.id : null;

    if (!activeId) return;

    // Handle folder drag and drop
    if (activeId.startsWith('folder:')) {
      const folderId = activeId.replace('folder:', '');
      const targetFolderId = overId?.startsWith('folder:') ? overId.replace('folder:', '') : null;

      // Prevent moving folder into itself or its descendants
      const isDescendant = (folderId: string, potentialParentId: string): boolean => {
        const folder = folders.find(f => f.id === folderId);
        if (!folder || !folder.parentId) return false;
        if (folder.parentId === potentialParentId) return true;
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
      let targetFolderId: string | null = null;

      if (overId?.startsWith('folder:')) {
        // Dropping on a folder
        targetFolderId = overId.replace('folder:', '');
      } else if (overId === 'root') {
        // Dropping on root drop zone
        targetFolderId = null;
      } else {
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
    return (
      <Page title="Vault" description="Loading...">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </Page>
    );
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Vault', icon: <Lock size={14} /> },
  ];

  return (
    <Page
      title="Vault"
      description="Manage your passwords and 2FA secrets"
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
      actions={
        <div className="flex items-center gap-2">
          <div className="[&>div]:!mb-0">
            <Select
              value={vaultFilter}
              onChange={(value: string) => setVaultFilter(value as VaultFilter)}
              options={[
                { value: 'all', label: 'All Vaults' },
                { value: 'personal', label: 'Personal Only' },
                // Only show shared option if user has access to a shared vault
                ...(vaults.some(v => v.type === 'shared') ? [{ value: 'shared', label: 'Shared Only' }] : []),
              ]}
            />
          </div>
          <Button variant="secondary" onClick={() => loadData()} disabled={loading} title="Refresh">
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="secondary" onClick={() => setShowAddFolderModal(true)}>
            <FolderPlus size={16} className="mr-2" />
            Add Folder
          </Button>
          <Button variant="primary" onClick={() => setShowAddItemModal(true)}>
            <Plus size={16} className="mr-2" />
            Add Item
          </Button>
        </div>
      }
    >
      {error && (
        <Alert variant="error" title="Error">
          {error.message}
        </Alert>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {/* Root Items (no folder) */}
          {rootItems.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Items</h2>
              <div className="border rounded-lg overflow-hidden">
                {rootItems.map((item, index) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    folders={folders}
                    onNavigate={navigate}
                    onMoveItem={handleMoveItem}
                    onQuickTotp={handleQuickTotp}
                    totpCopied={totpCopiedFor === item.id}
                    index={index}
                    onDeleteItem={handleDeleteItem}
                    showMoveItemModal={showMoveItemModal}
                    onShowMoveItemModal={setShowMoveItemModal}
                    globalEmailAddress={globalEmailAddress}
                    onQuickEmailOtp={handleQuickEmailOtp}
                    emailOtpPolling={emailOtpPollingFor === item.id}
                    emailOtpCopied={emailOtpCopiedFor === item.id}
                    isAdmin={isAdmin}
                    itemsWithSms={itemsWithSms}
                    setSmsOtpModalItemId={setSmsOtpModalItemId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Root Drop Zone */}
          <RootDropZone />

          {/* Personal Folders */}
          {groupedFolders.personal.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Personal</h2>
              {groupedFolders.personal.map(folder => (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  allFolders={folders}
                  allItems={items}
                  vaultTypeById={vaultTypeById}
                  onNavigate={navigate}
                  onDelete={handleDeleteFolder}
                  onSelectFolder={setSelectedFolderId}
                  onAddItem={(folderId: string) => {
                    setSelectedFolderId(folderId);
                    setShowAddItemModal(true);
                  }}
                  expandedFolderIds={expandedFolderIds}
                  onToggleExpanded={toggleFolderExpanded}
                  onMoveItem={handleMoveItem}
                  onQuickTotp={handleQuickTotp}
                  totpCopiedFor={totpCopiedFor}
                  onMoveFolder={handleMoveFolder}
                  showMoveModal={showMoveFolderModal}
                  onShowMoveModal={setShowMoveFolderModal}
                  onDeleteItem={handleDeleteItem}
                  showMoveItemModal={showMoveItemModal}
                  onShowMoveItemModal={setShowMoveItemModal}
                  onShowAclModal={setShowAclModalFolderId}
                  globalEmailAddress={globalEmailAddress}
                  onQuickEmailOtp={handleQuickEmailOtp}
                  emailOtpPollingFor={emailOtpPollingFor}
                  emailOtpCopiedFor={emailOtpCopiedFor}
                  isAdmin={isAdmin}
                  itemsWithSms={itemsWithSms}
                  setSmsOtpModalItemId={setSmsOtpModalItemId}
                />
              ))}
            </div>
          )}

          {/* Shared Folders */}
          {groupedFolders.shared.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Shared</h2>
              {groupedFolders.shared.map(folder => (
                <FolderSection
                  key={folder.id}
                  folder={folder}
                  allFolders={folders}
                  allItems={items}
                  vaultTypeById={vaultTypeById}
                  onNavigate={navigate}
                  onDelete={handleDeleteFolder}
                  onSelectFolder={setSelectedFolderId}
                  onAddItem={(folderId: string) => {
                    setSelectedFolderId(folderId);
                    setShowAddItemModal(true);
                  }}
                  expandedFolderIds={expandedFolderIds}
                  onToggleExpanded={toggleFolderExpanded}
                  onMoveItem={handleMoveItem}
                  onQuickTotp={handleQuickTotp}
                  totpCopiedFor={totpCopiedFor}
                  onMoveFolder={handleMoveFolder}
                  showMoveModal={showMoveFolderModal}
                  onShowMoveModal={setShowMoveFolderModal}
                  onDeleteItem={handleDeleteItem}
                  showMoveItemModal={showMoveItemModal}
                  onShowMoveItemModal={setShowMoveItemModal}
                  onShowAclModal={setShowAclModalFolderId}
                  globalEmailAddress={globalEmailAddress}
                  onQuickEmailOtp={handleQuickEmailOtp}
                  emailOtpPollingFor={emailOtpPollingFor}
                  emailOtpCopiedFor={emailOtpCopiedFor}
                  isAdmin={isAdmin}
                  itemsWithSms={itemsWithSms}
                  setSmsOtpModalItemId={setSmsOtpModalItemId}
                />
              ))}
            </div>
          )}

          {groupedFolders.personal.length === 0 && groupedFolders.shared.length === 0 && rootItems.length === 0 && (
            <Card>
              <div className="p-12 text-center">
                <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Your vault is empty</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Get started by adding your first password, SSH key, or secure note
                </p>
                <div className="flex justify-center gap-2">
                  <Button variant="secondary" onClick={() => setShowAddFolderModal(true)}>
                    <FolderPlus size={16} className="mr-2" />
                    Create Folder
                  </Button>
                  <Button variant="primary" onClick={() => setShowAddItemModal(true)}>
                    <Plus size={16} className="mr-2" />
                    Add Item
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
        <DragOverlay>
          {activeFolderId ? (
            <div className="border rounded-lg px-3 py-2 bg-secondary/40 opacity-50">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                <span className="font-medium text-sm">
                  {folders.find(f => f.id === activeFolderId)?.name || ''}
                </span>
              </div>
            </div>
          ) : activeItemId ? (
            <div className="border rounded-lg px-3 py-2 bg-secondary/40 opacity-50">
              <div className="flex items-center gap-2">
                {(() => {
                  const item = items.find(i => i.id === activeItemId);
                  if (!item) return null;
                  const getItemIcon = () => {
                    switch (item.type) {
                      case 'api_key':
                        return <Key size={14} />;
                      case 'secure_note':
                        return <FileText size={14} />;
                      default:
                        return <Lock size={14} />;
                    }
                  };
                  return (
                    <>
                      {getItemIcon()}
                      <span className="font-medium text-sm">{item.title}</span>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {showAddItemModal && (
        <AddItemModal
          onClose={() => {
            setShowAddItemModal(false);
            setSelectedFolderId(null);
          }}
          onSave={handleCreateItem}
          folderId={selectedFolderId}
        />
      )}

      {showAddFolderModal && (
        <FolderModal
          onClose={() => setShowAddFolderModal(false)}
          onSave={handleCreateFolder}
          vaults={vaults}
          folders={folders}
          isAdmin={isAdmin}
        />
      )}

      {showAclModalFolderId && (
        <FolderAclModal
          folderId={showAclModalFolderId}
          isOpen={!!showAclModalFolderId}
          onClose={() => setShowAclModalFolderId(null)}
          onUpdate={() => {
            loadData();
          }}
        />
      )}

      <AlertDialog {...alertDialog.props} />
      {otpWaitingModalItem && (
        <OtpWaitingModal
          open={!!otpWaitingModalItem}
          mode="email"
          onClose={() => setOtpWaitingModalItem(null)}
          itemTitle={otpWaitingModalItem.title}
          emailAddress={globalEmailAddress}
        />
      )}
      {smsOtpModalItemId && (
        <OtpWaitingModal
          open={true}
          mode="sms"
          onClose={() => setSmsOtpModalItemId(null)}
          itemTitle={items.find(i => i.id === smsOtpModalItemId)?.title}
        />
      )}
    </Page>
  );
}

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root',
    data: { type: 'drop-zone' },
  });

  return (
    <div
      ref={setNodeRef}
      className={isOver ? 'min-h-[20px] border-2 border-dashed border-primary rounded mb-2' : 'min-h-[4px] mb-2'}
    />
  );
}

function FolderSection({
  folder,
  allFolders,
  allItems,
  vaultTypeById,
  onNavigate,
  onDelete,
  onSelectFolder,
  onAddItem,
  expandedFolderIds,
  onToggleExpanded,
  onMoveItem,
  onQuickTotp,
  totpCopiedFor,
  onMoveFolder,
  showMoveModal,
  onShowMoveModal,
  onDeleteItem,
  showMoveItemModal,
  onShowMoveItemModal,
  onShowAclModal,
  globalEmailAddress,
  onQuickEmailOtp,
  emailOtpPollingFor,
  emailOtpCopiedFor,
  isAdmin = false,
  level = 0,
  itemsWithSms,
  setSmsOtpModalItemId,
}: {
  folder: VaultFolder;
  allFolders: VaultFolder[];
  allItems: VaultItemRow[];
  vaultTypeById: Record<string, VaultVault['type']>;
  onNavigate: (path: string) => void;
  onDelete: (folder: VaultFolder) => void;
  onSelectFolder: (id: string | null) => void;
  onAddItem: (folderId: string) => void;
  expandedFolderIds: Set<string>;
  onToggleExpanded: (folderId: string) => void;
  onMoveItem: (itemId: string, newFolderId: string | null) => Promise<void> | void;
  onQuickTotp: (item: VaultItemRow) => Promise<void> | void;
  totpCopiedFor: string | null;
  onMoveFolder: (folderId: string, newParentId: string | null) => Promise<void> | void;
  showMoveModal: string | null;
  onShowMoveModal: (folderId: string | null) => void;
  onDeleteItem: (item: VaultItemRow) => Promise<void> | void;
  showMoveItemModal: string | null;
  onShowMoveItemModal: (itemId: string | null) => void;
  onShowAclModal: (folderId: string | null) => void;
  globalEmailAddress: string | null;
  onQuickEmailOtp: (item: VaultItemRow) => Promise<void> | void;
  emailOtpPollingFor: string | null;
  emailOtpCopiedFor: string | null;
  isAdmin?: boolean;
  level?: number;
  itemsWithSms: Set<string>;
  setSmsOtpModalItemId: (itemId: string | null) => void;
}) {
  const { Button, Select } = useUi();
  const expanded = expandedFolderIds.has(folder.id);
  const subfolders = allFolders.filter(f => f.parentId === folder.id);
  const directItems = allItems.filter(item => item.folderId === folder.id);
  const folderScope = vaultTypeById[folder.vaultId];
  
  // Calculate indentation based on level
  const indentLevel = level;

  // Check if folder can be moved (same permission check as move icon)
  const canMove = (folder as any).permissionLevel === 'full' || (folder as any).permissionLevel === 'read_write_delete';

  // Drag and drop setup
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `folder:${folder.id}`,
    data: { type: 'folder', folderId: folder.id },
    disabled: !canMove,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `folder:${folder.id}`,
    data: { type: 'folder', folderId: folder.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  // Get available folders for move dropdown (exclude current folder and its descendants)
  const availableFolders = useMemo(() => {
    // Check if potentialParent is a descendant of folder (to prevent moving folder into its own subfolder)
    const isDescendant = (potentialParentId: string, ancestorId: string): boolean => {
      const potentialParent = allFolders.find(f => f.id === potentialParentId);
      if (!potentialParent || !potentialParent.parentId) return false;
      if (potentialParent.parentId === ancestorId) return true;
      return isDescendant(potentialParent.parentId, ancestorId);
    };

    return allFolders.filter(f => 
      f.id !== folder.id && 
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
    const visited = new Set<string>();
    
    const countRecursive = (folderId: string): number => {
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
      } finally {
        visited.delete(folderId);
      }
    };
    
    return countRecursive(folder.id);
  }, [folder.id, allItems, allFolders]);

  return (
    <div 
      ref={setDroppableRef}
      className={`border rounded-lg ${isOver ? 'border-primary border-2' : ''}`}
      style={style}
    >
      <div 
        className="px-3 py-2 bg-secondary/40 flex items-center justify-between"
        style={{ paddingLeft: `${12 + indentLevel * 24}px` }}
      >
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <button
            onClick={() => onToggleExpanded(folder.id)}
            className="flex items-center gap-2 flex-1 text-left min-w-0"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Folder className="h-4 w-4" />
            <span className="font-medium text-sm truncate">{folder.name}</span>
            {folderScope && (
              <span
                className={[
                  'text-[11px] px-2 py-0.5 rounded border flex-shrink-0',
                  folderScope === 'personal'
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-violet-50 border-violet-200 text-violet-800',
                ].join(' ')}
                title={folderScope === 'personal' ? 'Personal Vault' : 'Shared Vault'}
              >
                {folderScope === 'personal' ? 'Personal' : 'Shared'}
              </span>
            )}
            {(folder as any).permissionLevel && (folder as any).permissionLevel !== 'none' && (
              (() => {
                const permissionLevel = (folder as any).permissionLevel as 'full' | 'read_write_delete' | 'read_write' | 'read_only';
                const permissionConfig = {
                  full: {
                    icon: <Shield className="h-3.5 w-3.5" />,
                    label: 'Full Control',
                    className: 'bg-green-50 border-green-200 text-green-800',
                    title: 'Full Control (Read, Write, Delete, Manage ACL)',
                  },
                  read_write_delete: {
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                    label: 'Read/Write/Delete',
                    className: 'bg-purple-50 border-purple-200 text-purple-800',
                    title: 'Read, Write & Delete Access',
                  },
                  read_write: {
                    icon: <Edit className="h-3.5 w-3.5" />,
                    label: 'Read/Write',
                    className: 'bg-blue-50 border-blue-200 text-blue-800',
                    title: 'Read & Write Access',
                  },
                  read_only: {
                    icon: <Eye className="h-3.5 w-3.5" />,
                    label: 'Read Only',
                    className: 'bg-gray-50 border-gray-200 text-gray-800',
                    title: 'Read Only Access',
                  },
                };
                const config = permissionConfig[permissionLevel];
                return (
                  <span
                    className={[
                      'text-[11px] px-2 py-0.5 rounded border flex-shrink-0 flex items-center gap-1',
                      config.className,
                    ].join(' ')}
                    title={config.title}
                  >
                    {config.icon}
                    {config.label}
                  </span>
                );
              })()
            )}
            <span className="text-sm text-muted-foreground flex-shrink-0">
              ({totalItems} item{totalItems !== 1 ? 's' : ''})
            </span>
          </button>
        </div>
        <div 
          ref={setNodeRef}
          className="flex items-center gap-1 ml-auto"
        >
          {/* ACL button - only show if full access AND not a personal folder AND is a root folder */}
          {(folder as any).permissionLevel === 'full' && folderScope !== 'personal' && !folder.parentId && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onShowAclModal(folder.id);
              }}
              title="Manage Access"
            >
              <Users size={14} />
            </Button>
          )}
          {/* Drag Handle - show only if can move */}
          {canMove && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical size={14} className="text-muted-foreground" />
            </div>
          )}
          
          {/* Move Icon - show if full or read_write_delete access */}
          {canMove && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onShowMoveModal(folder.id);
              }}
              title="Move folder"
              className="p-1 h-auto"
            >
              <Move size={14} />
            </Button>
          )}
          
          {/* Add button - show if read_write, read_write_delete, or full (not read_only) */}
          {((folder as any).permissionLevel === 'read_write' || 
            (folder as any).permissionLevel === 'read_write_delete' || 
            (folder as any).permissionLevel === 'full') && (
            <Button variant="ghost" size="sm" onClick={() => onAddItem(folder.id)}>
              <Plus size={14} />
            </Button>
          )}
          {/* Delete button - only show if admin (regardless of permission level) */}
          {isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(folder)}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>
      
      {/* Move Folder Modal */}
      {showMoveModal === folder.id && (
        <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Move to:</span>
          <div className="flex-1 min-w-[200px]">
            <Select
              value={folder.parentId || ''}
              onChange={(value: string) => {
                // Explicitly handle empty string as root (null parentId)
                const newParentId = value === '' ? null : value;
                // Only move if the value actually changed
                const currentParentId = folder.parentId || null;
                if (newParentId !== currentParentId) {
                  onMoveFolder(folder.id, newParentId);
                }
              }}
              options={folderOptions}
            />
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onShowMoveModal(null)}
          >
            Cancel
          </Button>
        </div>
      )}
      {expanded && (
        <div className="border-t bg-background">
          {subfolders.map(subfolder => (
            <FolderSection
              key={subfolder.id}
              folder={subfolder}
              allFolders={allFolders}
              allItems={allItems}
              vaultTypeById={vaultTypeById}
              onNavigate={onNavigate}
              onDelete={onDelete}
              onSelectFolder={onSelectFolder}
              onAddItem={(folderId: string) => {
                onAddItem(folderId);
              }}
              expandedFolderIds={expandedFolderIds}
              onToggleExpanded={onToggleExpanded}
              onMoveItem={onMoveItem}
              onQuickTotp={onQuickTotp}
              totpCopiedFor={totpCopiedFor}
              onMoveFolder={onMoveFolder}
              showMoveModal={showMoveModal}
              onShowMoveModal={onShowMoveModal}
              onDeleteItem={onDeleteItem}
              showMoveItemModal={showMoveItemModal}
              onShowMoveItemModal={onShowMoveItemModal}
              onShowAclModal={onShowAclModal}
              globalEmailAddress={globalEmailAddress}
              onQuickEmailOtp={onQuickEmailOtp}
              emailOtpPollingFor={emailOtpPollingFor}
              emailOtpCopiedFor={emailOtpCopiedFor}
              isAdmin={isAdmin}
              level={level + 1}
              itemsWithSms={itemsWithSms}
              setSmsOtpModalItemId={setSmsOtpModalItemId}
            />
          ))}
          {subfolders.length > 0 && directItems.length > 0 && (
            <div className="h-px bg-border/50" />
          )}
          {directItems.map((item, index) => (
            <ItemRow
              key={item.id}
              item={item}
              folders={allFolders}
              onNavigate={onNavigate}
              onMoveItem={onMoveItem}
              onQuickTotp={onQuickTotp}
              totpCopied={totpCopiedFor === item.id}
              index={index}
              indentLevel={indentLevel + 1}
              onDeleteItem={onDeleteItem}
              showMoveItemModal={showMoveItemModal}
              onShowMoveItemModal={onShowMoveItemModal}
              globalEmailAddress={globalEmailAddress}
              onQuickEmailOtp={onQuickEmailOtp}
              emailOtpPolling={emailOtpPollingFor === item.id}
              emailOtpCopied={emailOtpCopiedFor === item.id}
              isAdmin={isAdmin}
              itemsWithSms={itemsWithSms}
              setSmsOtpModalItemId={setSmsOtpModalItemId}
            />
          ))}
          {subfolders.length === 0 && directItems.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6 bg-muted/20">
              Empty folder
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyDropdown({ item }: { item: VaultItemRow }) {
  const { Button } = useUi();
  const [expanded, setExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    }
    if (expanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [expanded]);

  async function handleCopy(field: 'username' | 'password') {
    try {
      setLoading(true);
      let value: string | undefined;

      if (field === 'username') {
        value = item.username || undefined;
      } else if (field === 'password') {
        // Need to reveal the item to get the password
        const revealed = await vaultApi.revealItem(item.id);
        value = revealed.password || revealed.secret;
      }

      if (value) {
        await navigator.clipboard.writeText(value);
        setCopiedField(field);
        setTimeout(() => {
          setCopiedField(null);
          setExpanded(false);
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    } finally {
      setLoading(false);
    }
  }

  // Don't show copy dropdown for secure notes (no username/password)
  if (item.type === 'secure_note') {
    return null;
  }

  return (
    <div ref={dropdownRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        title="Copy credentials"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        <Copy size={16} className="text-muted-foreground" />
      </Button>

      {expanded && (
        <div 
          className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          {item.username && (
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-2 transition-colors"
              onClick={() => handleCopy('username')}
              disabled={loading}
            >
              {copiedField === 'username' ? (
                <Check size={14} className="text-green-600" />
              ) : (
                <User size={14} className="text-muted-foreground" />
              )}
              <span>{copiedField === 'username' ? 'Copied!' : 'Username'}</span>
            </button>
          )}
          {item.type === 'credential' && (
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-2 transition-colors"
              onClick={() => handleCopy('password')}
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              ) : copiedField === 'password' ? (
                <Check size={14} className="text-green-600" />
              ) : (
                <KeyRound size={14} className="text-muted-foreground" />
              )}
              <span>{copiedField === 'password' ? 'Copied!' : 'Password'}</span>
            </button>
          )}
          {item.type === 'api_key' && (
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-2 transition-colors"
              onClick={() => handleCopy('password')}
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              ) : copiedField === 'password' ? (
                <Check size={14} className="text-green-600" />
              ) : (
                <Key size={14} className="text-muted-foreground" />
              )}
              <span>{copiedField === 'password' ? 'Copied!' : 'Secret/Key'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  folders,
  onNavigate,
  onMoveItem,
  onQuickTotp,
  totpCopied,
  index = 0,
  indentLevel = 0,
  onDeleteItem,
  showMoveItemModal,
  onShowMoveItemModal,
  globalEmailAddress,
  onQuickEmailOtp,
  emailOtpPolling,
  emailOtpCopied,
  isAdmin = false,
  itemsWithSms,
  setSmsOtpModalItemId,
}: {
  item: VaultItemRow;
  folders: VaultFolder[];
  onNavigate: (path: string) => void;
  onMoveItem: (itemId: string, newFolderId: string | null) => Promise<void> | void;
  onQuickTotp: (item: VaultItemRow) => Promise<void> | void;
  totpCopied: boolean;
  index?: number;
  indentLevel?: number;
  onDeleteItem: (item: VaultItemRow) => Promise<void> | void;
  showMoveItemModal: string | null;
  onShowMoveItemModal: (itemId: string | null) => void;
  globalEmailAddress: string | null;
  onQuickEmailOtp: (item: VaultItemRow) => Promise<void> | void;
  emailOtpPolling: boolean;
  emailOtpCopied: boolean;
  isAdmin?: boolean;
  itemsWithSms: Set<string>;
  setSmsOtpModalItemId: (itemId: string | null) => void;
}) {
  const { Button, Select } = useUi();
  
  // Drag and drop setup for items
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `item:${item.id}`,
    data: { type: 'item', itemId: item.id },
    disabled: !(item as any).canMove, // Only full access users/admins can move items
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };
  
  const getItemIcon = () => {
    switch (item.type) {
      case 'api_key':
        return <Key size={14} />;
      case 'secure_note':
        return <FileText size={14} />;
      default:
        return <Lock size={14} />;
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
  
  // Only full access users/admins can move items (checked via canMove flag from backend)
  const canMove = (item as any).canMove === true;
  
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, paddingLeft: `${12 + indentLevel * 24}px` }}
      className={[
        'px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors border-b border-border/50 last:border-b-0',
        isEven ? 'bg-background' : 'bg-muted/30',
        'hover:bg-muted/60',
      ].join(' ')}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('button') && !target.closest('select')) {
          onNavigate(`/vault/items/${item.id}`);
        }
      }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {getItemIcon()}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{item.title}</span>
          {item.username && (
            <span className="text-xs text-muted-foreground truncate">
              • {item.username}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto" onClick={(e) => e.stopPropagation()}>
        {/* Copy dropdown for username/password */}
        <CopyDropdown item={item} />

        {/* URL launch button - show if item has a URL */}
        {item.url && (
          <Button
            variant="ghost"
            size="sm"
            title={`Open ${item.url} in new tab`}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              // Ensure URL has protocol, default to https if missing
              let urlToOpen = item.url || '';
              if (urlToOpen && !urlToOpen.match(/^https?:\/\//i)) {
                urlToOpen = `https://${urlToOpen}`;
              }
              if (urlToOpen) {
                window.open(urlToOpen, '_blank', 'noopener,noreferrer');
              }
            }}
          >
            <ExternalLink size={16} className="text-blue-500" />
          </Button>
        )}
        {canUseEmailOtp && (
          <Button
            variant="ghost"
            size="sm"
            title="Get email OTP code"
            onClick={() => onQuickEmailOtp(item)}
          >
            {emailOtpCopied ? (
              <Check size={16} className="text-green-600" />
            ) : (
              <Mail size={16} className="text-blue-500" />
            )}
          </Button>
        )}
        {itemsWithSms.has(item.id) && (
          <Button
            variant="ghost"
            size="sm"
            title="Get SMS OTP code"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setSmsOtpModalItemId(item.id);
            }}
          >
            <MessageSquare size={16} className="text-blue-500" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={!item.hasTotp}
          title={item.hasTotp ? 'Copy current 2FA code' : '2FA off'}
          onClick={() => onQuickTotp(item)}
        >
          {totpCopied ? <Check size={16} className="text-green-600" /> : <ShieldCheck size={16} />}
        </Button>

        {/* Drag Handle - show only if can move */}
        {canMove && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} className="text-muted-foreground" />
          </div>
        )}

        {/* Move button - show if user has canMove or canEdit permission */}
        {canMove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onShowMoveItemModal(item.id);
            }}
            title="Move item to folder"
          >
            <Move size={14} />
          </Button>
        )}

        {/* Delete button - only show if admin (regardless of permission level) */}
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onDeleteItem(item);
            }}
            title="Delete item"
          >
            <Trash2 size={14} />
          </Button>
        )}
      </div>

      {/* Move Item Modal */}
      {showMoveItemModal === item.id && (
        <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Move to:</span>
          <div className="flex-1 min-w-[200px]">
            <Select
              value={item.folderId || ''}
              onChange={(value: string) => {
                // Explicitly handle empty string as root (null folderId)
                const newFolderId = value === '' ? null : value;
                // Only move if the value actually changed
                const currentFolderId = item.folderId || null;
                if (newFolderId !== currentFolderId) {
                  onMoveItem(item.id, newFolderId);
                }
              }}
              options={folderOptions}
            />
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onShowMoveItemModal(null)}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

export default VaultLanding;
