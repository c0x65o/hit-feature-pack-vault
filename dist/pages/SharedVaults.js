'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Users, Plus } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
export function SharedVaults({ onNavigate }) {
    const { Page, Card, Alert, Button, Modal, Input } = useUi();
    const [vaults, setVaults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [vaultName, setVaultName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(null);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
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
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load vaults'));
        }
        finally {
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
        }
        catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create vault');
        }
        finally {
            setCreating(false);
        }
    }
    if (loading) {
        return (_jsx(Page, { title: "Shared Vaults", description: "Loading...", children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    return (_jsxs(_Fragment, { children: [_jsxs(Page, { title: "Shared Vaults", description: "Team and organization password vaults", actions: _jsxs(Button, { variant: "primary", onClick: () => setShowCreateModal(true), children: [_jsx(Plus, { size: 16, className: "mr-2" }), "Create Vault"] }), children: [error && (_jsx(Alert, { variant: "error", title: "Error loading vaults", children: error.message })), vaults.length === 0 && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "No shared vaults available. Create one to get started." }) })), vaults.length > 0 && (_jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: vaults.map(vault => (_jsx("button", { onClick: () => navigate(`/vault/shared/${vault.id}`), className: "text-left", children: _jsx(Card, { children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Users, { className: "h-5 w-5" }), _jsx("h3", { className: "font-semibold", children: vault.name })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Shared vault" })] }) }) }, vault.id))) }))] }), _jsx(Modal, { open: showCreateModal, onClose: () => {
                    setShowCreateModal(false);
                    setVaultName('');
                    setCreateError(null);
                }, title: "Create Shared Vault", description: "Create a new shared vault for your team", size: "md", children: _jsxs("div", { children: [_jsx(Input, { label: "Vault Name", placeholder: "Enter vault name", value: vaultName, onChange: setVaultName, error: createError || undefined, required: true, disabled: creating }), _jsxs("div", { style: { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }, children: [_jsx(Button, { variant: "secondary", onClick: () => {
                                        setShowCreateModal(false);
                                        setVaultName('');
                                        setCreateError(null);
                                    }, disabled: creating, children: "Cancel" }), _jsx(Button, { variant: "primary", onClick: handleCreateVault, disabled: creating || !vaultName.trim(), children: creating ? 'Creating...' : 'Create Vault' })] })] }) })] }));
}
export default SharedVaults;
