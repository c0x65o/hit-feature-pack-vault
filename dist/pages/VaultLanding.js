'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useUi } from '@hit/ui-kit';
import { User, Users, Upload } from 'lucide-react';
export function VaultLanding({ onNavigate }) {
    const { Page, Card, Button } = useUi();
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    return (_jsx(Page, { title: "Vault", description: "Manage your passwords and 2FA secrets securely", children: _jsxs("div", { className: "grid gap-4 md:grid-cols-3", children: [_jsx("button", { onClick: () => navigate('/vault/personal'), className: "text-left", children: _jsx(Card, { children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(User, { className: "h-5 w-5" }), _jsx("h3", { className: "font-semibold", children: "Personal Vault" })] }), _jsx("p", { className: "text-sm text-muted-foreground mb-2", children: "Your private password vault" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Store and manage your personal passwords and secrets" })] }) }) }), _jsx("button", { onClick: () => navigate('/vault/shared'), className: "text-left", children: _jsx(Card, { children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Users, { className: "h-5 w-5" }), _jsx("h3", { className: "font-semibold", children: "Shared Vaults" })] }), _jsx("p", { className: "text-sm text-muted-foreground mb-2", children: "Team and organization vaults" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Collaborate on shared credentials with your team" })] }) }) }), _jsx("button", { onClick: () => navigate('/vault/import'), className: "text-left", children: _jsx(Card, { children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Upload, { className: "h-5 w-5" }), _jsx("h3", { className: "font-semibold", children: "Import" })] }), _jsx("p", { className: "text-sm text-muted-foreground mb-2", children: "Import passwords from CSV" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Bulk import passwords from CSV files" })] }) }) })] }) }));
}
export default VaultLanding;
