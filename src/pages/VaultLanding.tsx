'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUi } from '@hit/ui-kit';
import { Plus, Folder, FolderPlus, Trash2, ChevronRight, ChevronDown, Key, FileText, Lock, ShieldCheck, ArrowRightLeft, Check } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultVault, VaultFolder, VaultItem } from '../schema/vault';
import { AddItemModal } from '../components/AddItemModal';
import { FolderModal } from '../components/FolderModal';

type VaultFilter = 'all' | 'personal' | 'shared';

interface Props {
  onNavigate?: (path: string) => void;
}

type VaultItemRow = VaultItem & { hasTotp?: boolean };

export function VaultLanding({ onNavigate }: Props) {
  const { Page, Card, Button, Select, Alert } = useUi();
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
      const vaultsList = [personalVault, sharedVault].filter(Boolean) as VaultVault[];
      setVaults(vaultsList);
      
      // Filter vaults based on selection
      let filteredVaults = vaultsList;
      if (vaultFilter === 'personal') {
        filteredVaults = [personalVault].filter(Boolean) as VaultVault[];
      } else if (vaultFilter === 'shared') {
        filteredVaults = [sharedVault].filter(Boolean) as VaultVault[];
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
  }, [vaultFilter]);

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
    const confirmMessage = `Delete folder "${folder.name}"?\n\nThis will delete:\n- ${totalItems} item(s)\n- ${subfolders.length} subfolder(s)\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
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
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to move item'));
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

  if (loading) {
    return (
      <Page title="Vault" description="Loading...">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </Page>
    );
  }

  return (
    <Page
      title="Vault"
      description="Manage your passwords and 2FA secrets"
      actions={
        <div className="flex items-center gap-2">
          <div className="[&>div]:!mb-0">
            <Select
              value={vaultFilter}
              onChange={(value) => setVaultFilter(value as VaultFilter)}
              options={[
                { value: 'all', label: 'All Vaults' },
                { value: 'personal', label: 'Personal Only' },
                { value: 'shared', label: 'Shared Only' },
              ]}
            />
          </div>
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
                  folders={folders.filter(f => f.vaultId === item.vaultId)}
                  onNavigate={navigate}
                  onMoveItem={handleMoveItem}
                  onQuickTotp={handleQuickTotp}
                  totpCopied={totpCopiedFor === item.id}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

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
            onAddItem={() => {
              setSelectedFolderId(folder.id);
              setShowAddItemModal(true);
            }}
            expandedFolderIds={expandedFolderIds}
            onToggleExpanded={toggleFolderExpanded}
            onMoveItem={handleMoveItem}
            onQuickTotp={handleQuickTotp}
            totpCopiedFor={totpCopiedFor}
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
        />
      )}
    </Page>
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
}: {
  folder: VaultFolder;
  allFolders: VaultFolder[];
  allItems: VaultItemRow[];
  vaultTypeById: Record<string, VaultVault['type']>;
  onNavigate: (path: string) => void;
  onDelete: (folder: VaultFolder) => void;
  onSelectFolder: (id: string | null) => void;
  onAddItem: () => void;
  expandedFolderIds: Set<string>;
  onToggleExpanded: (folderId: string) => void;
  onMoveItem: (itemId: string, newFolderId: string | null) => Promise<void> | void;
  onQuickTotp: (item: VaultItemRow) => Promise<void> | void;
  totpCopiedFor: string | null;
}) {
  const { Button } = useUi();
  const expanded = expandedFolderIds.has(folder.id);
  const subfolders = allFolders.filter(f => f.parentId === folder.id);
  const directItems = allItems.filter(item => item.folderId === folder.id);
  const folderScope = vaultTypeById[folder.vaultId];
  
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
    <div className="border rounded-lg">
      <div className="px-3 py-2 bg-secondary/40 flex items-center justify-between">
        <button
          onClick={() => onToggleExpanded(folder.id)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Folder className="h-4 w-4" />
          <span className="font-medium text-sm">{folder.name}</span>
          {folderScope && (
            <span
              className={[
                'text-[11px] px-2 py-0.5 rounded border',
                folderScope === 'personal'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : 'bg-violet-50 border-violet-200 text-violet-800',
              ].join(' ')}
              title={folderScope === 'personal' ? 'Personal Vault' : 'Shared Vault'}
            >
              {folderScope === 'personal' ? 'Personal' : 'Shared'}
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            ({totalItems} item{totalItems !== 1 ? 's' : ''})
          </span>
        </button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onAddItem}>
            <Plus size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(folder)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
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
              onAddItem={() => {
                onSelectFolder(subfolder.id);
                onAddItem();
              }}
              expandedFolderIds={expandedFolderIds}
              onToggleExpanded={onToggleExpanded}
              onMoveItem={onMoveItem}
              onQuickTotp={onQuickTotp}
              totpCopiedFor={totpCopiedFor}
            />
          ))}
          {subfolders.length > 0 && directItems.length > 0 && (
            <div className="h-px bg-border/50" />
          )}
          {directItems.map((item, index) => (
            <ItemRow
              key={item.id}
              item={item}
              folders={allFolders.filter(f => f.vaultId === item.vaultId)}
              onNavigate={onNavigate}
              onMoveItem={onMoveItem}
              onQuickTotp={onQuickTotp}
              totpCopied={totpCopiedFor === item.id}
              index={index}
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
}: {
  item: VaultItemRow;
  folders: VaultFolder[];
  onNavigate: (path: string) => void;
  onMoveItem: (itemId: string, newFolderId: string | null) => Promise<void> | void;
  onQuickTotp: (item: VaultItemRow) => Promise<void> | void;
  totpCopied: boolean;
  index?: number;
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

  const isEven = index % 2 === 0;
  
  return (
    <div
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

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          disabled={!item.hasTotp}
          title={item.hasTotp ? 'Copy current 2FA code' : '2FA off'}
          onClick={() => onQuickTotp(item)}
        >
          {totpCopied ? <Check size={16} className="text-green-600" /> : <ShieldCheck size={16} />}
        </Button>

        <div className="min-w-[160px]" title="Move item to folder">
          <div className="flex items-center gap-1">
            <ArrowRightLeft size={14} className="text-muted-foreground" />
            <Select
              value={item.folderId || ''}
              onChange={(value) => onMoveItem(item.id, value ? value : null)}
              options={folderOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default VaultLanding;
