'use client';

import React, { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { vaultApi } from '../services/vault-api';
import type { VaultVault, VaultFolder, VaultItem } from '../schema/vault';

interface Props {
  onNavigate?: (path: string) => void;
}

export function PersonalVault({ onNavigate }: Props) {
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
    loadVault();
  }, []);

  async function loadVault() {
    try {
      setLoading(true);
      const vaults = await vaultApi.getVaults();
      const personalVault = vaults.find(v => v.type === 'personal');
      
      if (personalVault) {
        setVault(personalVault);
        const [foldersData, itemsData] = await Promise.all([
          vaultApi.getFolders(personalVault.id),
          vaultApi.getItems(personalVault.id),
        ]);
        setFolders(foldersData);
        setItems(itemsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load vault'));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Page title="Personal Vault" description="Loading...">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </Page>
    );
  }

  return (
    <Page
      title="Personal Vault"
      description={vault ? `${items.length} items in ${folders.length} folders` : 'Your private password vault'}
    >
      {error && (
        <Alert variant="error" title="Error loading vault">
          {error.message}
        </Alert>
      )}

      {!vault && (
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            Your personal vault will be created automatically
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
                  <button key={folder.id} onClick={() => navigate(`/vault/shared/${vault.id}/folders/${folder.id}`)} className="text-left w-full">
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

          {folders.length === 0 && items.length === 0 && (
            <Card>
              <div className="p-6 text-center text-muted-foreground">
                Your vault is empty. Add your first item to get started.
              </div>
            </Card>
          )}
        </div>
      )}
    </Page>
  );
}

export default PersonalVault;
