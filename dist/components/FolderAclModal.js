'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { vaultApi } from '../services/vault-api';
import { VAULT_PERMISSIONS } from '../schema/vault';
export function FolderAclModal({ folderId, isOpen, onClose, onUpdate }) {
    const { Modal, Button, Alert, Spinner, Input, Select, Checkbox, Badge } = useUi();
    const [acls, setAcls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    // New ACL form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newPrincipalType, setNewPrincipalType] = useState('user');
    const [newPrincipalId, setNewPrincipalId] = useState('');
    const [newPermissions, setNewPermissions] = useState([]);
    const [newInherit, setNewInherit] = useState(true);
    // Principal options state
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(false);
    useEffect(() => {
        if (isOpen && folderId) {
            loadAcls();
        }
    }, [isOpen, folderId]);
    // Load principal options when principal type changes
    useEffect(() => {
        if (showAddForm) {
            loadPrincipalOptions();
        }
    }, [newPrincipalType, showAddForm]);
    async function loadPrincipalOptions() {
        setLoadingOptions(true);
        try {
            if (newPrincipalType === 'user') {
                // Fetch users from user directory API
                const response = await fetch('/api/user-directory?limit=10000', {
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.enabled) {
                        if (data.users && Array.isArray(data.users) && data.users.length > 0) {
                            const userOptions = data.users.map((user) => ({
                                value: user.email,
                                label: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                            }));
                            setUsers(userOptions);
                        }
                        else if (data.error) {
                            console.error('[FolderAclModal] User directory error:', data.error);
                            setError(new Error(`Failed to load users: ${data.error}`));
                            setUsers([]);
                        }
                        else {
                            console.warn('[FolderAclModal] User directory returned no users');
                            setUsers([]);
                        }
                    }
                    else {
                        console.error('[FolderAclModal] User directory not enabled:', data.error);
                        setError(new Error(data.error || 'User directory not available'));
                        setUsers([]);
                    }
                }
                else {
                    const errorText = await response.text();
                    console.error('[FolderAclModal] Failed to fetch users:', response.status, errorText);
                    setError(new Error(`Failed to load users: ${response.status} ${response.statusText}`));
                    setUsers([]);
                }
            }
            else if (newPrincipalType === 'group') {
                // Fetch groups from both auth module (dynamic) and vault API (static)
                try {
                    const allGroupOptions = [];
                    // Fetch dynamic groups from auth module
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
                        const authResponse = await fetch(`${authUrl}/admin/groups`, { headers });
                        if (authResponse.ok) {
                            const authGroups = await authResponse.json();
                            const dynamicGroupOptions = (Array.isArray(authGroups) ? authGroups : []).map((group) => ({
                                value: group.id,
                                label: group.description ? `${group.name} - ${group.description}` : group.name,
                            }));
                            allGroupOptions.push(...dynamicGroupOptions);
                        }
                    }
                    catch (err) {
                        console.warn('Failed to load dynamic groups from auth module:', err);
                    }
                    // Fetch static groups from vault API
                    try {
                        const vaultGroupsData = await vaultApi.getGroups();
                        const staticGroupOptions = vaultGroupsData.map((group) => ({
                            value: group.id,
                            label: group.description ? `${group.name} (Static) - ${group.description}` : `${group.name} (Static)`,
                        }));
                        allGroupOptions.push(...staticGroupOptions);
                    }
                    catch (err) {
                        console.warn('Failed to load static groups from vault:', err);
                    }
                    setGroups(allGroupOptions);
                }
                catch (err) {
                    console.error('Failed to load groups:', err);
                    setGroups([]);
                }
            }
            else if (newPrincipalType === 'role') {
                // Fetch roles from auth module features endpoint
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
                        const roleOptions = availableRoles.map((role) => ({
                            value: role,
                            label: role.charAt(0).toUpperCase() + role.slice(1),
                        }));
                        setRoles(roleOptions);
                    }
                    else {
                        // Fallback: try to extract roles from users
                        const userResponse = await fetch('/api/user-directory?limit=1000', {
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        });
                        if (userResponse.ok) {
                            const userData = await userResponse.json();
                            if (userData.enabled && userData.users) {
                                const roleSet = new Set();
                                userData.users.forEach((user) => {
                                    const role = user.role || 'user';
                                    roleSet.add(role);
                                });
                                const roleOptions = Array.from(roleSet).sort().map((role) => ({
                                    value: role,
                                    label: role.charAt(0).toUpperCase() + role.slice(1),
                                }));
                                setRoles(roleOptions);
                            }
                            else {
                                setRoles([{ value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }]);
                            }
                        }
                        else {
                            setRoles([{ value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }]);
                        }
                    }
                }
                catch (err) {
                    console.error('Failed to load roles:', err);
                    setRoles([{ value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }]);
                }
            }
        }
        catch (err) {
            console.error('Failed to load principal options:', err);
        }
        finally {
            setLoadingOptions(false);
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
            const newAcl = {
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
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to create ACL'));
        }
        finally {
            setSaving(false);
        }
    }
    async function handleDeleteAcl(aclId) {
        if (!confirm('Are you sure you want to remove this access?')) {
            return;
        }
        try {
            setSaving(true);
            setError(null);
            await vaultApi.deleteAcl(aclId);
            await loadAcls();
            onUpdate?.();
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to delete ACL'));
        }
        finally {
            setSaving(false);
        }
    }
    function togglePermission(permission) {
        setNewPermissions(prev => {
            if (prev.includes(permission)) {
                return prev.filter(p => p !== permission);
            }
            else {
                return [...prev, permission];
            }
        });
    }
    const permissionLabels = {
        READ_ONLY: 'Read Only (view passwords)',
        READ_WRITE: 'Read & Write (add/edit items)',
        DELETE: 'Delete (remove items)',
    };
    return (_jsx(Modal, { open: isOpen, onClose: onClose, title: "Folder Access Control", size: "lg", children: _jsxs("div", { className: "space-y-4", children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), loading ? (_jsx("div", { className: "flex justify-center py-8", children: _jsx(Spinner, {}) })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Access Permissions" }), _jsx(Button, { onClick: () => setShowAddForm(!showAddForm), variant: "secondary", size: "sm", children: showAddForm ? 'Cancel' : 'Add Access' })] }), showAddForm && (_jsxs("div", { className: "border rounded-lg p-4 space-y-4 bg-muted/30", children: [_jsx("h4", { className: "font-medium", children: "Add New Access" }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium mb-1 block", children: "Principal Type" }), _jsx(Select, { value: newPrincipalType, onChange: (value) => {
                                                        setNewPrincipalType(value);
                                                        setNewPrincipalId(''); // Reset when type changes
                                                    }, options: [
                                                        { value: 'user', label: 'User' },
                                                        { value: 'group', label: 'Group' },
                                                        { value: 'role', label: 'Role' },
                                                    ] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium mb-1 block", children: newPrincipalType === 'user' ? 'User' :
                                                        newPrincipalType === 'group' ? 'Group' : 'Role' }), loadingOptions ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Spinner, { size: "sm" }), _jsx("span", { className: "text-sm text-muted-foreground", children: "Loading options..." })] })) : ((() => {
                                                    const options = newPrincipalType === 'user' ? users :
                                                        newPrincipalType === 'group' ? groups :
                                                            roles;
                                                    if (options.length > 0) {
                                                        return (_jsx(Select, { value: newPrincipalId, onChange: (value) => setNewPrincipalId(value), options: options, placeholder: `Select ${newPrincipalType}` }));
                                                    }
                                                    else {
                                                        // Fallback to input if no options available
                                                        return (_jsx(Input, { value: newPrincipalId, onChange: (value) => setNewPrincipalId(value), placeholder: newPrincipalType === 'user' ? 'user@example.com' :
                                                                newPrincipalType === 'group' ? 'group-id' : 'role-name' }));
                                                    }
                                                })())] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium mb-2 block", children: "Permissions" }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: Object.entries(VAULT_PERMISSIONS).map(([key, value]) => (_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Checkbox, { checked: newPermissions.includes(value), onChange: () => togglePermission(value) }), _jsx("label", { className: "text-sm", children: permissionLabels[value] || value })] }, key))) })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Checkbox, { checked: newInherit, onChange: (checked) => setNewInherit(checked) }), _jsx("label", { className: "text-sm", children: "Inherit to child folders and items" })] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { onClick: () => {
                                                setShowAddForm(false);
                                                setNewPrincipalId('');
                                                setNewPermissions([]);
                                                setError(null);
                                                setUsers([]);
                                                setGroups([]);
                                                setRoles([]);
                                            }, variant: "secondary", size: "sm", children: "Cancel" }), _jsx(Button, { onClick: handleCreateAcl, disabled: saving || !newPrincipalId.trim() || newPermissions.length === 0, size: "sm", children: saving ? 'Adding...' : 'Add Access' })] })] })), acls.length === 0 ? (_jsx("div", { className: "text-center py-8 text-muted-foreground", children: "No access permissions set. Click \"Add Access\" to grant permissions." })) : (_jsx("div", { className: "space-y-2", children: acls.map(acl => (_jsxs("div", { className: "border rounded-lg p-4 flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Badge, { variant: "default", children: acl.principalType }), _jsx("span", { className: "font-medium", children: acl.principalId }), acl.inherit && (_jsx(Badge, { variant: "info", className: "text-xs", children: "Inherits" }))] }), _jsx("div", { className: "flex flex-wrap gap-1", children: Array.isArray(acl.permissions) && acl.permissions.map(perm => (_jsx(Badge, { variant: "info", className: "text-xs", children: permissionLabels[perm] || perm }, perm))) })] }), _jsx(Button, { onClick: () => handleDeleteAcl(acl.id), variant: "ghost", size: "sm", disabled: saving, children: "Remove" })] }, acl.id))) }))] })), _jsx("div", { className: "flex justify-end pt-4 border-t", children: _jsx(Button, { onClick: onClose, variant: "secondary", children: "Close" }) })] }) }));
}
