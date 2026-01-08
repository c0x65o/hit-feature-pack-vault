'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Lock as LockIcon, Users, Folder } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
export function SharedVaultDetail({ vaultId, onNavigate }) {
    const { Page, Card, Alert } = useUi();
    const [vault, setVault] = useState(null);
    const [folders, setFolders] = useState([]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    useEffect(() => {
        if (vaultId) {
            loadVault();
        }
    }, [vaultId]);
    async function loadVault() {
        try {
            setLoading(true);
            const [vaultData, foldersData, itemsData] = await Promise.all([
                vaultApi.getVault(vaultId),
                vaultApi.getFolders(vaultId),
                vaultApi.getItems(vaultId),
            ]);
            setVault(vaultData);
            setFolders(foldersData);
            setItems(itemsData);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load vault'));
        }
        finally {
            setLoading(false);
        }
    }
    const breadcrumbs = [
        { label: 'Vault', href: '/vault', icon: _jsx(LockIcon, { size: 14 }) },
        { label: 'Shared Vaults', href: '/vault', icon: _jsx(Users, { size: 14 }) },
        ...(vault ? [{ label: vault.name, icon: _jsx(Folder, { size: 14 }) }] : []),
    ];
    if (loading) {
        return (_jsx(Page, { title: "Loading...", description: "", breadcrumbs: breadcrumbs, onNavigate: navigate, children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    return (_jsxs(Page, { title: vault?.name || 'Vault not found', description: vault ? `Shared vault • ${items.length} items in ${folders.length} folders` : '', breadcrumbs: breadcrumbs, onNavigate: navigate, children: [error && (_jsx(Alert, { variant: "error", title: "Error loading vault", children: error.message })), !vault && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "Vault not found" }) })), vault && (_jsxs("div", { className: "space-y-4", children: [folders.length > 0 && (_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Folders" }), _jsx("div", { className: "grid gap-2", children: folders.map(folder => (_jsx("button", { onClick: () => navigate(`/vault/shared/${vaultId}/folders/${folder.id}`), className: "text-left w-full", children: _jsx(Card, { children: _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "font-medium", children: folder.name }), _jsx("p", { className: "text-sm text-muted-foreground", children: folder.path })] }) }) }, folder.id))) })] })), items.length > 0 && (_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Items" }), _jsx("div", { className: "grid gap-2", children: items.map(item => (_jsx("button", { onClick: () => navigate(`/vault/items/${item.id}`), className: "text-left w-full", children: _jsx(Card, { children: _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "font-medium", children: item.title }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [item.username && `Username: ${item.username}`, item.url && ` • ${item.url}`] })] }) }) }, item.id))) })] }))] }))] }));
}
export default SharedVaultDetail;
