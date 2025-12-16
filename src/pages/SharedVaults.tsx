'use client';

import React, { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Users, Plus } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultVault } from '../schema/vault';

interface Props {
  onNavigate?: (path: string) => void;
}

export function SharedVaults({ onNavigate }: Props) {
  const { Page, Card, Alert, Button, Modal, Input } = useUi();
  const [vaults, setVaults] = useState<VaultVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  useEffect(() => {
    loadVaults();
  }, []);

  async function loadVaults() {
    try {
      setLoading(true);
      const allVaults = await vaultApi.getVaults();
      const sharedVaults = allVaults.filter(v => v.type === 'shared');
      setVaults(sharedVaults);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load vaults'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateVault() {
    if (!vaultName.trim()) {
      setCreateError('Vault name is required');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);
      await vaultApi.createVault({
        name: vaultName.trim(),
        type: 'shared',
      });
      setShowCreateModal(false);
      setVaultName('');
      await loadVaults();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create vault');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <Page title="Shared Vaults" description="Loading...">
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </Page>
    );
  }

  return (
    <>
      <Page
        title="Shared Vaults"
        description="Team and organization password vaults"
        actions={
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} className="mr-2" />
            Create Vault
          </Button>
        }
      >
        {error && (
          <Alert variant="error" title="Error loading vaults">
            {error.message}
          </Alert>
        )}

        {vaults.length === 0 && (
          <Card>
            <div className="p-6 text-center text-muted-foreground">
              No shared vaults available. Create one to get started.
            </div>
          </Card>
        )}

        {vaults.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vaults.map(vault => (
              <button key={vault.id} onClick={() => navigate(`/vault/shared/${vault.id}`)} className="text-left">
                <Card>
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-5 w-5" />
                      <h3 className="font-semibold">{vault.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Shared vault</p>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </Page>

      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setVaultName('');
          setCreateError(null);
        }}
        title="Create Shared Vault"
        description="Create a new shared vault for your team"
        size="md"
      >
        <div>
          <Input
            label="Vault Name"
            placeholder="Enter vault name"
            value={vaultName}
            onChange={setVaultName}
            error={createError || undefined}
            required
            disabled={creating}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false);
                setVaultName('');
                setCreateError(null);
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateVault}
              disabled={creating || !vaultName.trim()}
            >
              {creating ? 'Creating...' : 'Create Vault'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default SharedVaults;
