'use client';

import React, { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { vaultApi } from '../services/vault-api';
import type { VaultAcl, InsertVaultAcl } from '../schema/vault';
import { VAULT_PERMISSIONS } from '../schema/vault';

interface FolderAclModalProps {
  folderId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function FolderAclModal({ folderId, isOpen, onClose, onUpdate }: FolderAclModalProps) {
  const { Modal, Button, Alert, Spinner, Input, Select, Checkbox, Badge } = useUi();
  const [acls, setAcls] = useState<VaultAcl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  
  // New ACL form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrincipalType, setNewPrincipalType] = useState<'user' | 'group' | 'role'>('user');
  const [newPrincipalId, setNewPrincipalId] = useState('');
  const [newPermissions, setNewPermissions] = useState<string[]>([]);
  const [newInherit, setNewInherit] = useState(true);

  useEffect(() => {
    if (isOpen && folderId) {
      loadAcls();
    }
  }, [isOpen, folderId]);

  async function loadAcls() {
    try {
      setLoading(true);
      setError(null);
      const aclsData = await vaultApi.getAcls('folder', folderId);
      setAcls(aclsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load ACLs'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAcl() {
    if (!newPrincipalId.trim()) {
      setError(new Error('Principal ID is required'));
      return;
    }

    if (newPermissions.length === 0) {
      setError(new Error('At least one permission is required'));
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const newAcl: InsertVaultAcl = {
        resourceType: 'folder',
        resourceId: folderId,
        principalType: newPrincipalType,
        principalId: newPrincipalId.trim(),
        permissions: newPermissions,
        inherit: newInherit,
        createdBy: '', // Will be set by backend
      };

      await vaultApi.createAcl(newAcl);
      
      // Reset form
      setNewPrincipalType('user');
      setNewPrincipalId('');
      setNewPermissions([]);
      setNewInherit(true);
      setShowAddForm(false);
      
      // Reload ACLs
      await loadAcls();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create ACL'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAcl(aclId: string) {
    if (!confirm('Are you sure you want to remove this access?')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await vaultApi.deleteAcl(aclId);
      await loadAcls();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete ACL'));
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(permission: string) {
    setNewPermissions(prev => {
      if (prev.includes(permission)) {
        return prev.filter(p => p !== permission);
      } else {
        return [...prev, permission];
      }
    });
  }

  const permissionLabels: Record<string, string> = {
    VIEW_METADATA: 'View Metadata',
    REVEAL_PASSWORD: 'Reveal Password',
    COPY_PASSWORD: 'Copy Password',
    EDIT: 'Edit',
    DELETE: 'Delete',
    SHARE: 'Share',
    GENERATE_TOTP: 'Generate TOTP',
    REVEAL_TOTP_SECRET: 'Reveal TOTP Secret',
    READ_SMS: 'Read SMS',
    MANAGE_SMS: 'Manage SMS',
    IMPORT: 'Import',
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Folder Access Control"
      size="lg"
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="error" title="Error">
            {error.message}
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Access Permissions</h3>
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                variant="secondary"
                size="sm"
              >
                {showAddForm ? 'Cancel' : 'Add Access'}
              </Button>
            </div>

            {showAddForm && (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <h4 className="font-medium">Add New Access</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Principal Type</label>
                    <Select
                      value={newPrincipalType}
                      onChange={(value: string) => setNewPrincipalType(value as 'user' | 'group' | 'role')}
                      options={[
                        { value: 'user', label: 'User' },
                        { value: 'group', label: 'Group' },
                        { value: 'role', label: 'Role' },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      {newPrincipalType === 'user' ? 'User Email' : 
                       newPrincipalType === 'group' ? 'Group ID' : 'Role Name'}
                    </label>
                    <Input
                      value={newPrincipalId}
                      onChange={(value: string) => setNewPrincipalId(value)}
                      placeholder={newPrincipalType === 'user' ? 'user@example.com' : 
                                   newPrincipalType === 'group' ? 'group-id' : 'role-name'}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Permissions</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(VAULT_PERMISSIONS).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          checked={newPermissions.includes(value)}
                          onChange={() => togglePermission(value)}
                        />
                        <label className="text-sm">{permissionLabels[value] || value}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={newInherit}
                    onChange={(checked: boolean) => setNewInherit(checked)}
                  />
                  <label className="text-sm">Inherit to child folders and items</label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewPrincipalId('');
                      setNewPermissions([]);
                      setError(null);
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAcl}
                    disabled={saving || !newPrincipalId.trim() || newPermissions.length === 0}
                    size="sm"
                  >
                    {saving ? 'Adding...' : 'Add Access'}
                  </Button>
                </div>
              </div>
            )}

            {acls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No access permissions set. Click "Add Access" to grant permissions.
              </div>
            ) : (
              <div className="space-y-2">
                {acls.map(acl => (
                  <div
                    key={acl.id}
                    className="border rounded-lg p-4 flex items-start justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="default">{acl.principalType}</Badge>
                        <span className="font-medium">{acl.principalId}</span>
                        {acl.inherit && (
                          <Badge variant="info" className="text-xs">Inherits</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(acl.permissions) && acl.permissions.map(perm => (
                          <Badge key={perm} variant="info" className="text-xs">
                            {permissionLabels[perm] || perm}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleDeleteAcl(acl.id)}
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="secondary">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

