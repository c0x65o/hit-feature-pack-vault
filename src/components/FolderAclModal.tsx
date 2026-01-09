'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUi } from '@hit/ui-kit';
import type { AclEntry, AclPickerConfig, Principal } from '@hit/ui-kit';
import { AclPicker } from '@hit/ui-kit/components/AclPicker';
import { createFetchPrincipals } from '@hit/feature-pack-auth-core';
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
  const { Modal, Alert } = useUi();
  const [acls, setAcls] = useState<VaultAcl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRootFolder, setIsRootFolder] = useState<boolean | null>(null);
  const [staticGroups, setStaticGroups] = useState<Array<{ id: string; name: string; description?: string | null }>>([]);
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  const [canManageAcls, setCanManageAcls] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen && folderId) {
      void init();
    }
  }, [isOpen, folderId]);

  function isProbablyAdminRole(role: unknown): boolean {
    const r = String(role || '').toLowerCase();
    return r === 'admin';
  }

  function safeDecodeJwtPayload(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = atob(b64);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  async function init() {
    setError(null);
    setCanManageAcls(true);

    const admin = await resolveIsAdmin();
    setIsAdminUser(admin);

    // Load core data (best-effort; ACL endpoint will gate access)
    await Promise.allSettled([
      checkIfRootFolder(),
      loadAcls(),
      admin ? loadStaticGroups() : Promise.resolve(),
    ]);
  }

  async function resolveIsAdmin(): Promise<boolean> {
    // Fast path: decode localStorage token if present
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('hit_token') : null;
      if (token) {
        const payload = safeDecodeJwtPayload(token);
        const roles = Array.isArray(payload?.roles) ? payload.roles : [];
        if (roles.some((r: unknown) => isProbablyAdminRole(r))) return true;
        // If token exists and doesn't include admin, return false (avoid extra network)
        return false;
      }
    } catch {
      // ignore
    }

    // Fallback: ask auth module
    try {
      const authUrl =
        typeof window !== 'undefined'
          ? (window as any).NEXT_PUBLIC_HIT_AUTH_URL || '/api/proxy/auth'
          : '/api/proxy/auth';
      const res = await fetch(`${authUrl}/me`, { credentials: 'include' });
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      const role = (data as any)?.role;
      const roles = (data as any)?.roles;
      if (isProbablyAdminRole(role)) return true;
      if (Array.isArray(roles) && roles.some((r: unknown) => isProbablyAdminRole(r))) return true;
      return false;
    } catch {
      return false;
    }
  }

  async function checkIfRootFolder() {
    try {
      const folder = await vaultApi.getFolder(folderId);
      setIsRootFolder(!folder.parentId);
    } catch (err) {
      console.error('Failed to check if folder is root:', err);
      setIsRootFolder(null);
    }
  }

  async function loadStaticGroups() {
    try {
      const groups = await vaultApi.getGroups();
      setStaticGroups(groups);
    } catch (err) {
      // Static groups are admin-only; non-admins should not hit this path.
      console.warn('Failed to load static groups:', err);
      setStaticGroups([]);
    }
  }

  async function loadAcls() {
    try {
      setLoading(true);
      setError(null);
      const aclsData = await vaultApi.getAcls('folder', folderId);
      setAcls(Array.isArray(aclsData) ? aclsData : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If the user doesn't have MANAGE_ACL, the backend returns 403. Treat this as "read-only/no access"
      // rather than a hard failure with duplicate scary banners.
      if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
        setCanManageAcls(false);
        setError(new Error('You do not have permission to view or edit access for this folder.'));
        setAcls([]);
      } else {
        setError(err instanceof Error ? err : new Error('Failed to load ACLs'));
      }
    } finally {
      setLoading(false);
    }
  }

  // Convert VaultAcl to AclEntry
  const aclEntries: AclEntry[] = useMemo(() => {
    return acls.map(acl => ({
      id: acl.id,
      principalType: acl.principalType,
      principalId: acl.principalId,
      permissions: Array.isArray(acl.permissions) ? acl.permissions : [],
    }));
  }, [acls]);

  const fetchPrincipals = useMemo(() => createFetchPrincipals({
    isAdmin: isAdminUser,
    extraPrincipals: async (type: 'user' | 'group' | 'role', search?: string) => {
      if (type !== 'group' || !isAdminUser) return [];
      
      const searchLower = search?.toLowerCase();
      return staticGroups
        .filter(group => {
          const displayName = group.description ? `${group.name} (Static) - ${group.description}` : `${group.name} (Static)`;
          return !searchLower || displayName.toLowerCase().includes(searchLower) || group.name.toLowerCase().includes(searchLower);
        })
        .map(group => ({
          type: 'group',
          id: group.id,
          displayName: group.description ? `${group.name} (Static) - ${group.description}` : `${group.name} (Static)`,
          metadata: { name: group.name, description: group.description, static: true },
        }));
    }
  }), [isAdminUser, staticGroups]);

  async function handleAdd(entry: Omit<AclEntry, 'id'>) {
    try {
      setError(null);
      const newAcl: InsertVaultAcl = {
        resourceType: 'folder',
        resourceId: folderId,
        principalType: entry.principalType,
        principalId: entry.principalId,
        permissions: entry.permissions,
        inherit: false, // No inheritance allowed - only root folders can have ACLs
        createdBy: '', // Will be set by backend
      };

      await vaultApi.createAcl(newAcl);
      await loadAcls();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create ACL'));
      throw err;
    }
  }

  async function handleRemove(entry: AclEntry) {
    if (!entry.id) {
      throw new Error('Cannot remove entry without ID');
    }
    try {
      await vaultApi.deleteAcl(entry.id);
      await loadAcls();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to remove ACL'));
      throw err;
    }
  }

  // Vault hierarchical permissions configuration
  const vaultAclConfig: AclPickerConfig = useMemo(() => ({
    principals: {
      users: true,
      groups: true,
      roles: isAdminUser,
    },
    mode: 'hierarchical',
    hierarchicalPermissions: [
      {
        key: 'full',
        label: 'Full Control',
        description: 'Read, write, delete, and manage access',
        priority: 100,
        includes: [VAULT_PERMISSIONS.READ_ONLY, VAULT_PERMISSIONS.READ_WRITE, VAULT_PERMISSIONS.DELETE, VAULT_PERMISSIONS.MANAGE_ACL],
      },
      {
        key: 'read_write_delete',
        label: 'Read, Write & Delete',
        description: 'Read, write, and delete items',
        priority: 75,
        includes: [VAULT_PERMISSIONS.READ_ONLY, VAULT_PERMISSIONS.READ_WRITE, VAULT_PERMISSIONS.DELETE],
      },
      {
        key: 'read_write',
        label: 'Read & Write',
        description: 'Read and edit items',
        priority: 50,
        includes: [VAULT_PERMISSIONS.READ_ONLY, VAULT_PERMISSIONS.READ_WRITE],
      },
      {
        key: 'read_only',
        label: 'Read Only',
        description: 'View items only',
        priority: 25,
        includes: [VAULT_PERMISSIONS.READ_ONLY],
      },
    ],
    labels: {
      title: 'Folder Access Control',
      addButton: 'Add Access',
      removeButton: 'Remove',
      emptyMessage: 'No access permissions set. Click "Add Access" to grant permissions.',
    },
  }), [isAdminUser]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Folder Access Control"
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isRootFolder === false && (
          <Alert variant="error" title="Invalid Folder">
            Access permissions can only be set on root folders (folders without a parent). This folder is a subfolder and cannot have its own permissions.
          </Alert>
        )}

        <AclPicker
          config={vaultAclConfig}
          entries={aclEntries}
          loading={loading}
          error={error?.message || null}
          onAdd={handleAdd}
          onRemove={handleRemove}
          fetchPrincipals={fetchPrincipals}
          disabled={isRootFolder === false || !canManageAcls}
        />
      </div>
    </Modal>
  );
}
