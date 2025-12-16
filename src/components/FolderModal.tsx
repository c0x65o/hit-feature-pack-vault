'use client';

import React, { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save } from 'lucide-react';
import type { VaultVault, VaultFolder } from '../schema/vault';

interface Props {
  onClose: () => void;
  onSave: (name: string, parentId: string | null, vaultId: string) => Promise<void>;
  vaults: VaultVault[];
  folders: VaultFolder[];
}

export function FolderModal({ onClose, onSave, vaults, folders }: Props) {
  const { Modal, Button, Input, Select, Alert } = useUi();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'personal' | 'shared'>('personal');
  const [vaultId, setVaultId] = useState<string>('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Get single vaults by type (there should only be one of each)
  const personalVault = vaults.find(v => v.type === 'personal');
  const sharedVault = vaults.find(v => v.type === 'shared');
  
  useEffect(() => {
    // When scope changes, update vaultId to the appropriate single vault
    if (scope === 'personal') {
      setVaultId(personalVault?.id || ''); // Will be created if needed
    } else {
      setVaultId(sharedVault?.id || ''); // Will be created if needed
    }
    // Reset parent folder when scope changes
    setParentId(null);
  }, [scope, personalVault, sharedVault]);

  // Get folders for the selected vault
  const selectedVaultId = vaultId || (scope === 'personal' ? personalVault?.id : sharedVault?.id);
  const rootFolders = folders.filter(f => !f.parentId && f.vaultId === selectedVaultId);

  async function handleSave() {
    if (!name.trim()) {
      setError(new Error('Folder name is required'));
      return;
    }

    // Determine target vault ID based on scope (single vault per type)
    const targetVaultId = scope === 'personal' 
      ? (vaultId || personalVault?.id || '')
      : (vaultId || sharedVault?.id || '');

    if (!targetVaultId) {
      // Vaults should be auto-created by parent component, but handle error case
      setError(new Error(`${scope === 'personal' ? 'Personal' : 'Shared'} vault not available. Please try again.`));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(name.trim(), parentId, targetVaultId);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create folder'));
    } finally {
      setSaving(false);
    }
  }

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Create Folder"
      onClose={handleClose}
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="error" title="Error">
            {error.message}
          </Alert>
        )}

        <div>
          <label className="text-sm font-medium">Scope *</label>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            Choose whether this folder is personal (only you can access) or shared (controlled by folder sharing)
          </p>
          <Select
            value={scope}
            onChange={(value) => setScope(value as 'personal' | 'shared')}
            options={[
              { value: 'personal', label: 'Personal (only you can access)' },
              { value: 'shared', label: 'Shared (controlled by folder sharing)' },
            ]}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Folder Name *</label>
          <Input
            value={name}
            onChange={(value: string) => setName(value)}
            placeholder="e.g., Work, Personal"
          />
        </div>

        {rootFolders.length > 0 && (
          <div>
            <label className="text-sm font-medium">Parent Folder (Optional)</label>
            <Select
              value={parentId || ''}
              onChange={(value) => setParentId(value || null)}
              options={[
                { value: '', label: 'Root (no parent)' },
                ...rootFolders.map(f => ({
                  value: f.id,
                  label: f.name,
                })),
              ]}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !name.trim()}>
            <Save size={16} className="mr-2" />
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

