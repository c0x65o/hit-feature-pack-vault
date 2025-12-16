'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Lock as LockIcon, Folder, Users } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { FolderAclModal } from '../components/FolderAclModal';
export function FolderView({ folderId, onNavigate }) {
    const { Page, Card, Alert, Button } = useUi();
    const [folder, setFolder] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [aclModalOpen, setAclModalOpen] = useState(false);
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
    const breadcrumbs = [
        { label: 'Vault', href: '/vault/personal', icon: _jsx(LockIcon, { size: 14 }) },
        ...(folder ? [{ label: folder.name, icon: _jsx(Folder, { size: 14 }) }] : []),
    ];
    return (_jsxs(_Fragment, { children: [_jsxs(Page, { title: folder?.name || 'Folder not found', description: folder ? `${folder.path} • ${items.length} items` : '', breadcrumbs: breadcrumbs, onNavigate: navigate, actions: folder ? (_jsxs(Button, { onClick: () => setAclModalOpen(true), variant: "secondary", size: "sm", children: [_jsx(Users, { size: 16, className: "mr-2" }), "Manage Access"] })) : undefined, children: [error && (_jsx(Alert, { variant: "error", title: "Error loading folder", children: error.message })), !folder && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "Folder not found" }) })), folder && items.length === 0 && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "This folder is empty." }) })), folder && items.length > 0 && (_jsx("div", { className: "border rounded-lg overflow-hidden", children: items.map((item, index) => {
                            const isEven = index % 2 === 0;
                            return (_jsx("button", { onClick: () => navigate(`/vault/items/${item.id}`), className: [
                                    'text-left w-full px-3 py-2.5 flex items-center justify-between gap-3 transition-colors border-b border-border/50 last:border-b-0',
                                    isEven ? 'bg-background' : 'bg-muted/30',
                                    'hover:bg-muted/60',
                                ].join(' '), children: _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h3", { className: "font-medium text-sm", children: item.title }), _jsxs("p", { className: "text-xs text-muted-foreground mt-0.5", children: [item.username && `Username: ${item.username}`, item.url && ` • ${item.url}`] })] }) }, item.id));
                        }) }))] }), folder && (_jsx(FolderAclModal, { folderId: folder.id, isOpen: aclModalOpen, onClose: () => setAclModalOpen(false), onUpdate: () => {
                    // Reload folder data if needed
                    loadFolder();
                } }))] }));
}
export default FolderView;
