'use client';

import React, { useState, useEffect } from 'react';
import { useUi, type BreadcrumbItem } from '@hit/ui-kit';
import { Lock as LockIcon, Users, Folder } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultVault, VaultFolder, VaultItem } from '../schema/vault';

interface Props {
  vaultId: string;
  onNavigate?: (path: string) => void;
}

export function SharedVaultDetail({ vaultId, onNavigate }: Props) {
  const { Page, Card, Alert } = useUi();
  const [vault, setVault] = useState<VaultVault | null>(null);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  useEffect(() => {
    if (vaultId) {
      loadVault();
    }
  }, [vaultId]);

  async function loadVault() {
    try {
      setLoading(true);
      const [vaultData, foldersData, itemsData] = await Promise.all([
        vaultApi.getVault(vaultId),
        vaultApi.getFolders(vaultId),
        vaultApi.getItems(vaultId),
      ]);
      setVault(vaultData);
      setFolders(foldersData);
      setItems(itemsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load vault'));
    } finally {
      setLoading(false);
    }
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Vault', href: '/vault/personal', icon: <LockIcon size={14} /> },
    { label: 'Shared Vaults', href: '/vault/shared', icon: <Users size={14} /> },
    ...(vault ? [{ label: vault.name, icon: <Folder size={14} /> }] : []),
  ];

  if (loading) {
    return (
      <Page title="Loading..." description="" breadcrumbs={breadcrumbs} onNavigate={navigate}>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </Page>
    );
  }

  return (
    <Page
      title={vault?.name || 'Vault not found'}
      description={vault ? `Shared vault • ${items.length} items in ${folders.length} folders` : ''}
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
    >
      {error && (
        <Alert variant="error" title="Error loading vault">
          {error.message}
        </Alert>
      )}

      {!vault && (
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            Vault not found
          </div>
        </Card>
      )}

      {vault && (
        <div className="space-y-4">
          {folders.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Folders</h2>
              <div className="grid gap-2">
                {folders.map(folder => (
                  <button key={folder.id} onClick={() => navigate(`/vault/shared/${vaultId}/folders/${folder.id}`)} className="text-left w-full">
                    <Card>
                      <div className="p-4">
                        <h3 className="font-medium">{folder.name}</h3>
                        <p className="text-sm text-muted-foreground">{folder.path}</p>
                      </div>
                    </Card>
                  </button>
                ))}
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Items</h2>
              <div className="grid gap-2">
                {items.map(item => (
                  <button key={item.id} onClick={() => navigate(`/vault/items/${item.id}`)} className="text-left w-full">
                    <Card>
                      <div className="p-4">
                        <h3 className="font-medium">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.username && `Username: ${item.username}`}
                          {item.url && ` • ${item.url}`}
                        </p>
                      </div>
                    </Card>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Page>
  );
}

export default SharedVaultDetail;
