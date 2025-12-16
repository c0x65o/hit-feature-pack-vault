'use client';

import React, { useState, useEffect } from 'react';
import { useUi, type BreadcrumbItem } from '@hit/ui-kit';
import { Lock as LockIcon, Folder, Users } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultFolder, VaultItem } from '../schema/vault';
import { FolderAclModal } from '../components/FolderAclModal';

interface Props {
  folderId: string;
  onNavigate?: (path: string) => void;
}

export function FolderView({ folderId, onNavigate }: Props) {
  const { Page, Card, Alert, Button } = useUi();
  const [folder, setFolder] = useState<VaultFolder | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [aclModalOpen, setAclModalOpen] = useState(false);

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

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Vault', href: '/vault/personal', icon: <LockIcon size={14} /> },
    ...(folder ? [{ label: folder.name, icon: <Folder size={14} /> }] : []),
  ];

  return (
    <>
      <Page
        title={folder?.name || 'Folder not found'}
        description={folder ? `${folder.path} • ${items.length} items` : ''}
        breadcrumbs={breadcrumbs}
        onNavigate={navigate}
        actions={folder ? (
          <Button
            onClick={() => setAclModalOpen(true)}
            variant="secondary"
            size="sm"
          >
            <Users size={16} className="mr-2" />
            Manage Access
          </Button>
        ) : undefined}
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
          <div className="border rounded-lg overflow-hidden">
            {items.map((item, index) => {
              const isEven = index % 2 === 0;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/vault/items/${item.id}`)}
                  className={[
                    'text-left w-full px-3 py-2.5 flex items-center justify-between gap-3 transition-colors border-b border-border/50 last:border-b-0',
                    isEven ? 'bg-background' : 'bg-muted/30',
                    'hover:bg-muted/60',
                  ].join(' ')}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.username && `Username: ${item.username}`}
                      {item.url && ` • ${item.url}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Page>

      {folder && (
        <FolderAclModal
          folderId={folder.id}
          isOpen={aclModalOpen}
          onClose={() => setAclModalOpen(false)}
          onUpdate={() => {
            // Reload folder data if needed
            loadFolder();
          }}
        />
      )}
    </>
  );
}

export default FolderView;
