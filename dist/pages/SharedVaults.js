'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Users } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
export function SharedVaults({ onNavigate }) {
    const { Page, Card, Alert } = useUi();
    const [vaults, setVaults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
    if (loading) {
        return (_jsx(Page, { title: "Shared Vaults", description: "Loading...", children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    return (_jsxs(Page, { title: "Shared Vaults", description: "Team and organization password vaults", children: [error && (_jsx(Alert, { variant: "error", title: "Error loading vaults", children: error.message })), vaults.length === 0 && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "No shared vaults available. Create one to get started." }) })), vaults.length > 0 && (_jsx("div", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: vaults.map(vault => (_jsx("button", { onClick: () => navigate(`/vault/shared/${vault.id}`), className: "text-left", children: _jsx(Card, { children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Users, { className: "h-5 w-5" }), _jsx("h3", { className: "font-semibold", children: vault.name })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Shared vault" })] }) }) }, vault.id))) }))] }));
}
export default SharedVaults;
