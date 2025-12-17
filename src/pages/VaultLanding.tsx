'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUi, useAlertDialog, type BreadcrumbItem } from '@hit/ui-kit';
import { Plus, Folder, FolderPlus, Trash2, ChevronRight, ChevronDown, Key, FileText, Lock, ShieldCheck, ArrowRightLeft, Check, GripVertical, Move, Users, Mail, Loader2, RefreshCw } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultVault, VaultFolder, VaultItem } from '../schema/vault';
import { AddItemModal } from '../components/AddItemModal';
import { FolderModal } from '../components/FolderModal';
import { FolderAclModal } from '../components/FolderAclModal';
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

type VaultItemRow = VaultItem & { hasTotp?: boolean };

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
  const [showMoveFolderModal, setShowMoveFolderModal] = useState<string | null>(null);
  const [showMoveItemModal, setShowMoveItemModal] = useState<string | null>(null);
  const [showAclModalFolderId, setShowAclModalFolderId] = useState<string | null>(null);
  const [globalEmailAddress, setGlobalEmailAddress] = useState<string | null>(null);
  const [emailOtpPollingFor, setEmailOtpPollingFor] = useState<string | null>(null);
  const [emailOtpCopiedFor, setEmailOtpCopiedFor] = useState<string | null>(null);
  
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
      setItems(itemsResults.flat() as any);
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
        // Use folderId from itemData if provided, otherwise use selectedFolderId
        const folderId = itemData.folderId !== undefined ? itemData.folderId : selectedFolderId;
        const createdItem = await vaultApi.createItem({
          ...itemData,
          vaultId: fallbackVault.id,
          folderId: folderId || null,
        });
        
        if (itemData.totpSecret && createdItem.id) {
          await vaultApi.importTotp(createdItem.id, itemData.totpSecret);
        }
        
        await loadData();
        setShowAddItemModal(false);
        return;
      }

      // Backend will set createdBy from authenticated user
      // Use folderId from itemData if provided, otherwise use selectedFolderId
      const folderId = itemData.folderId !== undefined ? itemData.folderId : selectedFolderId;
      const createdItem = await vaultApi.createItem({
        ...itemData,
        vaultId: personalVault.id,
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
    if (emailOtpPollingFor === item.id) return;
    
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
          } catch (err) {
            console.error('Failed to reveal email message:', err);
          }
        }
        return false;
      } catch (err) {
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
    if (typeof active.id === 'string' && active.id.startsWith('folder:')) {
      setActiveFolderId(active.id.replace('folder:', ''));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveFolderId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = typeof active.id === 'string' ? active.id.replace('folder:', '') : null;
    const overId = typeof over.id === 'string' ? over.id.replace('folder:', '') : null;

    if (!activeId) return;

    // Prevent moving folder into itself or its descendants
    const isDescendant = (folderId: string, potentialParentId: string): boolean => {
      const folder = folders.find(f => f.id === folderId);
      if (!folder || !folder.parentId) return false;
      if (folder.parentId === potentialParentId) return true;
      return isDescendant(folder.parentId, potentialParentId);
    };

    if (overId && isDescendant(overId, activeId)) {
      setError(new Error('Cannot move folder into its own subfolder'));
      return;
    }

    // If dropping on root (no overId), move to root
    // If dropping on another folder, move into that folder
    const newParentId = overId || null;
    
    await handleMoveFolder(activeId, newParentId);
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
              onChange={(value) => setVaultFilter(value as VaultFilter)}
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
                  />
                ))}
              </div>
            </div>
          )}

          {/* Root Drop Zone */}
          <RootDropZone />

          {/* Folders */}
          {rootFolders.map(folder => (
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
            />
          ))}

          {rootFolders.length === 0 && rootItems.length === 0 && (
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
    </Page>
  );
}

function RootDropZone() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root',
    data: { type: 'folder-drop-zone' },
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
  level = 0,
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
  level?: number;
}) {
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
          {/* Drag Handle */}
          <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} className="text-muted-foreground" />
          </div>
          
          {/* Move Icon */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              onShowMoveModal(folder.id);
            }}
            title="Move folder"
            className="p-1 h-auto"
          >
            <Move size={14} />
          </Button>
          
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
            <span className="text-sm text-muted-foreground flex-shrink-0">
              ({totalItems} item{totalItems !== 1 ? 's' : ''})
            </span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              onShowAclModal(folder.id);
            }}
            title="Manage Access"
          >
            <Users size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAddItem(folder.id)}>
            <Plus size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(folder)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      
      {/* Move Folder Modal */}
      {showMoveModal === folder.id && (
        <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Move to:</span>
          <div className="flex-1 min-w-[200px]">
            <Select
              value={folder.parentId || ''}
              onChange={(value) => {
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
              level={level + 1}
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
}) {
  const { Button, Select } = useUi();
  
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
  
  return (
    <div
      className={[
        'px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors border-b border-border/50 last:border-b-0',
        isEven ? 'bg-background' : 'bg-muted/30',
        'hover:bg-muted/60',
      ].join(' ')}
      style={{ paddingLeft: `${12 + indentLevel * 24}px` }}
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

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {canUseEmailOtp && (
          <Button
            variant="ghost"
            size="sm"
            disabled={emailOtpPolling}
            title={emailOtpPolling ? 'Waiting for email OTP...' : 'Get email OTP code'}
            onClick={() => onQuickEmailOtp(item)}
          >
            {emailOtpCopied ? (
              <Check size={16} className="text-green-600" />
            ) : emailOtpPolling ? (
              <Loader2 size={16} className="animate-spin text-blue-500" />
            ) : (
              <Mail size={16} className="text-blue-500" />
            )}
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

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onShowMoveItemModal(item.id);
          }}
          title="Move item to folder"
        >
          <Move size={14} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteItem(item);
          }}
          title="Delete item"
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {/* Move Item Modal */}
      {showMoveItemModal === item.id && (
        <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Move to:</span>
          <div className="flex-1 min-w-[200px]">
            <Select
              value={item.folderId || ''}
              onChange={(value) => {
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
