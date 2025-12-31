'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUi } from '@hit/ui-kit';
import { AclPicker, type AclPickerConfig, type AclEntry, type Principal } from '@hit/ui-kit';
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

  // Custom principal fetcher that combines auth-core principals with static groups
  const customFetchPrincipals = async (type: 'user' | 'group' | 'role', search?: string): Promise<Principal[]> => {
    const principals: Principal[] = [];

    if (type === 'user') {
      // Use auth-core hook via direct API call (since we can't call hooks conditionally)
      try {
        const authUrl = typeof window !== 'undefined' 
          ? (window as any).NEXT_PUBLIC_HIT_AUTH_URL || '/api/proxy/auth'
          : '/api/proxy/auth';
        const token = typeof window !== 'undefined' ? localStorage.getItem('hit_token') : null;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${authUrl}/directory/users`, {
          credentials: 'include',
          headers,
        });

        if (response.ok) {
          const authUsers = await response.json();
          if (Array.isArray(authUsers)) {
            authUsers.forEach((user: { 
              email: string; 
              profile_fields?: { first_name?: string | null; last_name?: string | null } | null;
            }) => {
              const firstName = user.profile_fields?.first_name || null;
              const lastName = user.profile_fields?.last_name || null;
              const displayName = [firstName, lastName].filter(Boolean).join(' ') || user.email;
              
              if (!search || displayName.toLowerCase().includes(search.toLowerCase()) || user.email.toLowerCase().includes(search.toLowerCase())) {
                principals.push({
                  type: 'user',
                  id: user.email,
                  displayName,
                  metadata: { email: user.email, profile_fields: user.profile_fields },
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('Failed to load users:', err);
      }
    } else if (type === 'group') {
      const authUrl = typeof window !== 'undefined'
        ? (window as any).NEXT_PUBLIC_HIT_AUTH_URL || '/api/proxy/auth'
        : '/api/proxy/auth';
      const token = typeof window !== 'undefined' ? localStorage.getItem('hit_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (isAdminUser) {
        // Admin: can pick any auth group (including dynamic groups)
        try {
          const authResponse = await fetch(`${authUrl}/admin/groups`, { headers, credentials: 'include' });
          if (authResponse.ok) {
            const authGroups = await authResponse.json();
            if (Array.isArray(authGroups)) {
              authGroups.forEach((group: { id: string; name: string; description?: string | null }) => {
                const displayName = group.description ? `${group.name} - ${group.description}` : group.name;
                if (!search || displayName.toLowerCase().includes(search.toLowerCase()) || group.name.toLowerCase().includes(search.toLowerCase())) {
                  principals.push({
                    type: 'group',
                    id: group.id,
                    displayName,
                    metadata: { name: group.name, description: group.description },
                  });
                }
              });
            }
          }
        } catch (err) {
          console.warn('Failed to load groups (admin):', err);
        }

        // Admin: also include vault static groups
        staticGroups.forEach((group) => {
          const displayName = group.description ? `${group.name} (Static) - ${group.description}` : `${group.name} (Static)`;
          if (!search || displayName.toLowerCase().includes(search.toLowerCase()) || group.name.toLowerCase().includes(search.toLowerCase())) {
            principals.push({
              type: 'group',
              id: group.id,
              displayName,
              metadata: { name: group.name, description: group.description, static: true },
            });
          }
        });
      } else {
        // Non-admin (Option B): can pick only groups they are in.
        try {
          const res = await fetch(`${authUrl}/me/groups`, { headers, credentials: 'include' });
          if (res.ok) {
            const myGroups = await res.json();
            if (Array.isArray(myGroups)) {
              myGroups.forEach((g: { group_id?: string; groupId?: string; group_name?: string; groupName?: string }) => {
                const id = String(g.group_id ?? g.groupId ?? '').trim();
                const name = String(g.group_name ?? g.groupName ?? id).trim();
                if (!id) return;
                if (!search || name.toLowerCase().includes(search.toLowerCase()) || id.toLowerCase().includes(search.toLowerCase())) {
                  principals.push({
                    type: 'group',
                    id,
                    displayName: name,
                    metadata: { name, source: 'me/groups' },
                  });
                }
              });
            }
          }
        } catch (err) {
          console.warn('Failed to load my groups:', err);
        }
      }
    } else if (type === 'role') {
      // Non-admins cannot share to roles.
      if (!isAdminUser) return principals;
      // Roles from auth module
      try {
        const authUrl = typeof window !== 'undefined' 
          ? (window as any).NEXT_PUBLIC_HIT_AUTH_URL || '/api/proxy/auth'
          : '/api/proxy/auth';
        const token = typeof window !== 'undefined' ? localStorage.getItem('hit_token') : null;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${authUrl}/features`, { headers });
        if (response.ok) {
          const data = await response.json();
          const availableRoles = data.features?.available_roles || ['admin', 'user'];
          availableRoles.forEach((role: string) => {
            const displayName = role.charAt(0).toUpperCase() + role.slice(1);
            if (!search || displayName.toLowerCase().includes(search.toLowerCase()) || role.toLowerCase().includes(search.toLowerCase())) {
              principals.push({
                type: 'role',
                id: role,
                displayName,
              });
            }
          });
        }
      } catch (err) {
        console.warn('Failed to load roles:', err);
        // Fallback
        ['admin', 'user'].forEach(role => {
          principals.push({
            type: 'role',
            id: role,
            displayName: role.charAt(0).toUpperCase() + role.slice(1),
          });
        });
      }
    }

    return principals;
  };

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
          fetchPrincipals={customFetchPrincipals}
          disabled={isRootFolder === false || !canManageAcls}
        />
      </div>
    </Modal>
  );
}
