'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Plus } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
export function GroupManagement({ onNavigate }) {
    const { Page, Card, Button, Alert } = useUi();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        loadGroups();
    }, []);
    async function loadGroups() {
        try {
            setLoading(true);
            const groupsData = await vaultApi.getGroups();
            setGroups(groupsData);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load groups'));
        }
        finally {
            setLoading(false);
        }
    }
    if (loading) {
        return (_jsx(Page, { title: "Group Management", description: "Loading...", children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    return (_jsxs(Page, { title: "Group Management", description: "Manage static groups for vault sharing", actions: _jsxs(Button, { variant: "primary", children: [_jsx(Plus, { size: 16, className: "mr-2" }), "Create Group"] }), children: [error && (_jsx(Alert, { variant: "error", title: "Error loading groups", children: error.message })), groups.length === 0 && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "No groups found. Create your first group to get started." }) })), groups.length > 0 && (_jsx("div", { className: "grid gap-4", children: groups.map(group => (_jsx(Card, { children: _jsxs("div", { className: "p-4", children: [_jsx("h3", { className: "font-medium", children: group.name }), group.description && (_jsx("p", { className: "text-sm text-muted-foreground", children: group.description }))] }) }, group.id))) }))] }));
}
export default GroupManagement;
