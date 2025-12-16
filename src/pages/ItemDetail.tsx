'use client';

import React, { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Eye, Copy, Edit } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultItem } from '../schema/vault';

interface Props {
  itemId: string;
  onNavigate?: (path: string) => void;
}

export function ItemDetail({ itemId, onNavigate }: Props) {
  const { Page, Card, Button, Alert } = useUi();
  const [item, setItem] = useState<VaultItem | null>(null);
  const [revealed, setRevealed] = useState<{ password?: string; notes?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  useEffect(() => {
    if (itemId) {
      loadItem();
    }
  }, [itemId]);

  async function loadItem() {
    try {
      setLoading(true);
      const itemData = await vaultApi.getItem(itemId);
      setItem(itemData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load item'));
    } finally {
      setLoading(false);
    }
  }

  async function handleReveal() {
    if (!item) return;
    try {
      const revealedData = await vaultApi.revealItem(item.id);
      setRevealed(revealedData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to reveal item'));
    }
  }

  async function handleCopy(field: 'password' | 'username' | 'totp') {
    if (!item) return;
    try {
      await vaultApi.copyItem(item.id, field);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to copy'));
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
      title={item?.title || 'Item not found'}
      description={item?.url || ''}
      actions={
        item ? (
          <Button variant="primary" onClick={() => navigate(`/vault/items/${item.id}/edit`)}>
            <Edit size={16} className="mr-2" />
            Edit
          </Button>
        ) : undefined
      }
    >
      {error && (
        <Alert variant="error" title="Error">
          {error.message}
        </Alert>
      )}

      {!item && (
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            Item not found
          </div>
        </Card>
      )}

      {item && (
        <Card>
          <div className="p-6 space-y-4">
            {item.username && (
              <div>
                <label className="text-sm font-medium">Username</label>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm">{item.username}</p>
                  <Button variant="ghost" size="sm" onClick={() => handleCopy('username')}>
                    <Copy size={16} />
                  </Button>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Password</label>
              <div className="flex items-center gap-2 mt-1">
                {revealed?.password ? (
                  <>
                    <p className="text-sm font-mono">{revealed.password}</p>
                    <Button variant="ghost" size="sm" onClick={() => handleCopy('password')}>
                      <Copy size={16} />
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" onClick={handleReveal}>
                    <Eye size={16} className="mr-2" />
                    Reveal Password
                  </Button>
                )}
              </div>
            </div>

            {revealed?.notes && (
              <div>
                <label className="text-sm font-medium">Notes</label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{revealed.notes}</p>
              </div>
            )}

            {item.tags && item.tags.length > 0 && (
              <div>
                <label className="text-sm font-medium">Tags</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {item.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-secondary rounded-md text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </Page>
  );
}

export default ItemDetail;
