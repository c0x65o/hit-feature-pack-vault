'use client';

import React, { useState, useEffect } from 'react';
import type { BreadcrumbItem } from '@hit/ui-kit';
import { useUi } from '@hit/ui-kit';
import { Plus, Lock as LockIcon, Users } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import type { VaultStaticGroup } from '../schema/vault';

interface Props {
  onNavigate?: (path: string) => void;
}

export function GroupManagement({ onNavigate }: Props) {
  const { Page, Card, Button, Alert } = useUi();
  const [groups, setGroups] = useState<VaultStaticGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    try {
      setLoading(true);
      const groupsData = await vaultApi.getGroups();
      setGroups(groupsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load groups'));
    } finally {
      setLoading(false);
    }
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Vault', href: '/vault/personal', icon: <LockIcon size={14} /> },
    { label: 'Group Management', icon: <Users size={14} /> },
  ];

  if (loading) {
    return (
      <Page title="Group Management" description="Loading..." breadcrumbs={breadcrumbs} onNavigate={onNavigate}>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </Page>
    );
  }

  return (
    <Page
      title="Group Management"
      description="Manage static groups for vault sharing"
      breadcrumbs={breadcrumbs}
      onNavigate={onNavigate}
      actions={
        <Button variant="primary">
          <Plus size={16} className="mr-2" />
          Create Group
        </Button>
      }
    >
      {error && (
        <Alert variant="error" title="Error loading groups">
          {error.message}
        </Alert>
      )}

      {groups.length === 0 && (
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            No groups found. Create your first group to get started.
          </div>
        </Card>
      )}

      {groups.length > 0 && (
        <div className="grid gap-4">
          {groups.map(group => (
            <Card key={group.id}>
              <div className="p-4">
                <h3 className="font-medium">{group.name}</h3>
                {group.description && (
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}

export default GroupManagement;
