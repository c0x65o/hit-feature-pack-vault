'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Lock as LockIcon, User } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
export function PersonalVault({ onNavigate }) {
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
        loadVault();
    }, []);
    async function loadVault() {
        try {
            setLoading(true);
            const vaults = await vaultApi.getVaults();
            const personalVault = vaults.find(v => v.type === 'personal');
            if (personalVault) {
                setVault(personalVault);
                const [foldersData, itemsData] = await Promise.all([
                    vaultApi.getFolders(personalVault.id),
                    vaultApi.getItems(personalVault.id),
                ]);
                setFolders(foldersData);
                setItems(itemsData);
            }
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
        { label: 'Personal Vault', icon: _jsx(User, { size: 14 }) },
    ];
    if (loading) {
        return (_jsx(Page, { title: "Personal Vault", description: "Loading...", breadcrumbs: breadcrumbs, onNavigate: navigate, children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    return (_jsxs(Page, { title: "Personal Vault", description: vault ? `${items.length} items in ${folders.length} folders` : 'Your private password vault', breadcrumbs: breadcrumbs, onNavigate: navigate, children: [error && (_jsx(Alert, { variant: "error", title: "Error loading vault", children: error.message })), !vault && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "Your personal vault will be created automatically" }) })), vault && (_jsxs("div", { className: "space-y-4", children: [folders.length > 0 && (_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Folders" }), _jsx("div", { className: "grid gap-2", children: folders.map(folder => (_jsx("button", { onClick: () => navigate(`/vault/shared/${vault.id}/folders/${folder.id}`), className: "text-left w-full", children: _jsx(Card, { children: _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "font-medium", children: folder.name }), _jsx("p", { className: "text-sm text-muted-foreground", children: folder.path })] }) }) }, folder.id))) })] })), items.length > 0 && (_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "Items" }), _jsx("div", { className: "grid gap-2", children: items.map(item => (_jsx("button", { onClick: () => navigate(`/vault/items/${item.id}`), className: "text-left w-full", children: _jsx(Card, { children: _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "font-medium", children: item.title }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [item.username && `Username: ${item.username}`, item.url && ` • ${item.url}`] })] }) }) }, item.id))) })] })), folders.length === 0 && items.length === 0 && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "Your vault is empty. Add your first item to get started." }) }))] }))] }));
}
export default PersonalVault;
