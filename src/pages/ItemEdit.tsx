'use client';

import React, { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { InsertVaultItem } from '../schema/vault';

interface Props {
  itemId?: string;
  onNavigate?: (path: string) => void;
}

export function ItemEdit({ itemId, onNavigate }: Props) {
  const { Page, Card, Button, Input, Alert } = useUi();
  const [loading, setLoading] = useState(!!itemId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [formData, setFormData] = useState<Partial<InsertVaultItem>>({
    title: '',
    username: '',
    url: '',
    tags: [],
  });

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
      const item = await vaultApi.getItem(itemId!);
      setFormData({
        title: item.title,
        username: item.username || '',
        url: item.url || '',
        tags: item.tags || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load item'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      if (itemId) {
        await vaultApi.updateItem(itemId, formData);
      }
      navigate('/vault/personal');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save item'));
    } finally {
      setSaving(false);
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
      title={itemId ? 'Edit Item' : 'New Item'}
      description="Enter the credential information"
    >
      {error && (
        <Alert variant="error" title="Error">
          {error.message}
        </Alert>
      )}

      <Card>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={formData.title || ''}
              onChange={(value: string) => setFormData({ ...formData, title: value })}
              placeholder="e.g., GitHub Account"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Username</label>
            <Input
              value={formData.username || ''}
              onChange={(value: string) => setFormData({ ...formData, username: value })}
              placeholder="username or email"
            />
          </div>

          <div>
            <label className="text-sm font-medium">URL</label>
            <Input
              value={formData.url || ''}
              onChange={(value: string) => setFormData({ ...formData, url: value })}
              placeholder="https://example.com"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigate('/vault/personal')}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !formData.title}>
              <Save size={16} className="mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Card>
    </Page>
  );
}

export default ItemEdit;
