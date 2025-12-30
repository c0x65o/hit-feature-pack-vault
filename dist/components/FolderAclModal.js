'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from 'react';
import { useUi } from '@hit/ui-kit';
import { AclPicker } from '@hit/ui-kit';
import { vaultApi } from '../services/vault-api';
import { VAULT_PERMISSIONS } from '../schema/vault';
export function FolderAclModal({ folderId, isOpen, onClose, onUpdate }) {
    const { Modal, Alert } = useUi();
    const [acls, setAcls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isRootFolder, setIsRootFolder] = useState(null);
    const [staticGroups, setStaticGroups] = useState([]);
    useEffect(() => {
        if (isOpen && folderId) {
            checkIfRootFolder();
            loadAcls();
            loadStaticGroups();
        }
    }, [isOpen, folderId]);
    async function checkIfRootFolder() {
        try {
            const folder = await vaultApi.getFolder(folderId);
            setIsRootFolder(!folder.parentId);
        }
        catch (err) {
            console.error('Failed to check if folder is root:', err);
            setIsRootFolder(null);
        }
    }
    async function loadStaticGroups() {
        try {
            const groups = await vaultApi.getGroups();
            setStaticGroups(groups);
        }
        catch (err) {
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
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load ACLs'));
        }
        finally {
            setLoading(false);
        }
    }
    // Convert VaultAcl to AclEntry
    const aclEntries = useMemo(() => {
        return acls.map(acl => ({
            id: acl.id,
            principalType: acl.principalType,
            principalId: acl.principalId,
            permissions: Array.isArray(acl.permissions) ? acl.permissions : [],
        }));
    }, [acls]);
    // Custom principal fetcher that combines auth-core principals with static groups
    const customFetchPrincipals = async (type, search) => {
        const principals = [];
        if (type === 'user') {
            // Use auth-core hook via direct API call (since we can't call hooks conditionally)
            try {
                const authUrl = typeof window !== 'undefined'
                    ? window.NEXT_PUBLIC_HIT_AUTH_URL || '/api/proxy/auth'
                    : '/api/proxy/auth';
                const token = typeof window !== 'undefined' ? localStorage.getItem('hit_token') : null;
                const headers = {
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
                        authUsers.forEach((user) => {
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
            }
            catch (err) {
                console.warn('Failed to load users:', err);
            }
        }
        else if (type === 'group') {
            // Combine dynamic groups from auth-core with static groups from vault
            try {
                // Dynamic groups from auth module
                const authUrl = typeof window !== 'undefined'
                    ? window.NEXT_PUBLIC_HIT_AUTH_URL || '/api/proxy/auth'
                    : '/api/proxy/auth';
                const token = typeof window !== 'undefined' ? localStorage.getItem('hit_token') : null;
                const headers = {
                    'Content-Type': 'application/json',
                };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                const authResponse = await fetch(`${authUrl}/admin/groups`, { headers });
                if (authResponse.ok) {
                    const authGroups = await authResponse.json();
                    if (Array.isArray(authGroups)) {
                        authGroups.forEach((group) => {
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
            }
            catch (err) {
                console.warn('Failed to load dynamic groups:', err);
            }
            // Static groups from vault
            staticGroups.forEach(group => {
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
        }
        else if (type === 'role') {
            // Roles from auth module
            try {
                const authUrl = typeof window !== 'undefined'
                    ? window.NEXT_PUBLIC_HIT_AUTH_URL || '/api/proxy/auth'
                    : '/api/proxy/auth';
                const token = typeof window !== 'undefined' ? localStorage.getItem('hit_token') : null;
                const headers = {
                    'Content-Type': 'application/json',
                };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                const response = await fetch(`${authUrl}/features`, { headers });
                if (response.ok) {
                    const data = await response.json();
                    const availableRoles = data.features?.available_roles || ['admin', 'user'];
                    availableRoles.forEach((role) => {
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
            }
            catch (err) {
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
    async function handleAdd(entry) {
        try {
            setError(null);
            const newAcl = {
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
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to create ACL'));
            throw err;
        }
    }
    async function handleRemove(entry) {
        if (!entry.id) {
            throw new Error('Cannot remove entry without ID');
        }
        try {
            await vaultApi.deleteAcl(entry.id);
            await loadAcls();
            onUpdate?.();
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to remove ACL'));
            throw err;
        }
    }
    // Vault hierarchical permissions configuration
    const vaultAclConfig = useMemo(() => ({
        principals: {
            users: true,
            groups: true,
            roles: true,
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
    }), []);
    return (_jsx(Modal, { open: isOpen, onClose: onClose, title: "Folder Access Control", size: "lg", children: _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '1rem' }, children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), isRootFolder === false && (_jsx(Alert, { variant: "error", title: "Invalid Folder", children: "Access permissions can only be set on root folders (folders without a parent). This folder is a subfolder and cannot have its own permissions." })), _jsx(AclPicker, { config: vaultAclConfig, entries: aclEntries, loading: loading, error: error?.message || null, onAdd: handleAdd, onRemove: handleRemove, fetchPrincipals: customFetchPrincipals, disabled: isRootFolder === false })] }) }));
}
