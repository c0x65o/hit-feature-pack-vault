'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useUi } from '@hit/ui-kit';
import { Upload, Lock as LockIcon } from 'lucide-react';
export function ImportCSV({ onNavigate }) {
    const { Page, Card, Button, Alert } = useUi();
    const [file, setFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState(null);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    async function handleFileSelect(event) {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    }
    async function handleImport() {
        if (!file)
            return;
        try {
            setImporting(true);
            // TODO: Implement CSV import
            // await vaultApi.commitCsvImport({ ... });
            navigate('/vault/personal');
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to import'));
        }
        finally {
            setImporting(false);
        }
    }
    const breadcrumbs = [
        { label: 'Vault', href: '/vault/personal', icon: _jsx(LockIcon, { size: 14 }) },
        { label: 'Import CSV', icon: _jsx(Upload, { size: 14 }) },
    ];
    return (_jsxs(Page, { title: "Import CSV", description: "Import passwords from a CSV file", breadcrumbs: breadcrumbs, onNavigate: navigate, children: [error && (_jsx(Alert, { variant: "error", title: "Error importing", children: error.message })), _jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsx("div", { children: _jsx("input", { type: "file", accept: ".csv", onChange: handleFileSelect, className: "block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" }) }), file && (_jsxs("div", { className: "space-y-2", children: [_jsxs("p", { className: "text-sm", children: ["Selected: ", file.name] }), _jsxs(Button, { variant: "primary", onClick: handleImport, disabled: importing, children: [_jsx(Upload, { size: 16, className: "mr-2" }), importing ? 'Importing...' : 'Import'] })] }))] }) })] }));
}
export default ImportCSV;
