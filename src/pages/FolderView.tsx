'use client';

import React, { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { vaultApi } from '../services/vault-api';
import type { VaultFolder, VaultItem } from '../schema/vault';

interface Props {
  folderId: string;
  onNavigate?: (path: string) => void;
}

export function FolderView({ folderId, onNavigate }: Props) {
  const { Page, Card, Alert } = useUi();
  const [folder, setFolder] = useState<VaultFolder | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  useEffect(() => {
    if (folderId) {
      loadFolder();
    }
  }, [folderId]);

  async function loadFolder() {
    try {
      setLoading(true);
      const [folderData, itemsData] = await Promise.all([
        vaultApi.getFolder(folderId),
        vaultApi.getItems(undefined, folderId),
      ]);
      setFolder(folderData);
      setItems(itemsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load folder'));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Page title="Loading..." description="">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </Page>
    );
  }

  return (
    <Page
      title={folder?.name || 'Folder not found'}
      description={folder ? `${folder.path} • ${items.length} items` : ''}
    >
      {error && (
        <Alert variant="error" title="Error loading folder">
          {error.message}
        </Alert>
      )}

      {!folder && (
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            Folder not found
          </div>
        </Card>
      )}

      {folder && items.length === 0 && (
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            This folder is empty.
          </div>
        </Card>
      )}

      {folder && items.length > 0 && (
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
      )}
    </Page>
  );
}

export default FolderView;
