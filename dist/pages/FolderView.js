'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { vaultApi } from '../services/vault-api';
export function FolderView({ folderId, onNavigate }) {
    const { Page, Card, Alert } = useUi();
    const [folder, setFolder] = useState(null);
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
        if (folderId) {
            loadFolder();
        }
    }, [folderId]);
    async function loadFolder() {
        try {
            setLoading(true);
            const [folderData, itemsData] = await Promise.all([
                vaultApi.getFolder(folderId),
                vaultApi.getItems(undefined, folderId),
            ]);
            setFolder(folderData);
            setItems(itemsData);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load folder'));
        }
        finally {
            setLoading(false);
        }
    }
    if (loading) {
        return (_jsx(Page, { title: "Loading...", description: "", children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    return (_jsxs(Page, { title: folder?.name || 'Folder not found', description: folder ? `${folder.path} • ${items.length} items` : '', children: [error && (_jsx(Alert, { variant: "error", title: "Error loading folder", children: error.message })), !folder && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "Folder not found" }) })), folder && items.length === 0 && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "This folder is empty." }) })), folder && items.length > 0 && (_jsx("div", { className: "grid gap-2", children: items.map(item => (_jsx("button", { onClick: () => navigate(`/vault/items/${item.id}`), className: "text-left w-full", children: _jsx(Card, { children: _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "font-medium", children: item.title }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [item.username && `Username: ${item.username}`, item.url && ` • ${item.url}`] })] }) }) }, item.id))) }))] }));
}
export default FolderView;
