'use client';

import React, { useState } from 'react';
import type { BreadcrumbItem } from '@hit/ui-kit';
import { useUi } from '@hit/ui-kit';
import { Upload, Lock as LockIcon } from 'lucide-react';
import { vaultApi } from '../services/vault-api';

interface Props {
  onNavigate?: (path: string) => void;
}

export function ImportCSV({ onNavigate }: Props) {
  const { Page, Card, Button, Alert } = useUi();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  }

  async function handleImport() {
    if (!file) return;
    try {
      setImporting(true);
      // TODO: Implement CSV import
      // await vaultApi.commitCsvImport({ ... });
      navigate('/vault/personal');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to import'));
    } finally {
      setImporting(false);
    }
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Vault', href: '/vault/personal', icon: <LockIcon size={14} /> },
    { label: 'Import CSV', icon: <Upload size={14} /> },
  ];

  return (
    <Page
      title="Import CSV"
      description="Import passwords from a CSV file"
      breadcrumbs={breadcrumbs}
      onNavigate={navigate}
    >
      {error && (
        <Alert variant="error" title="Error importing">
          {error.message}
        </Alert>
      )}

      <Card>
        <div className="p-6 space-y-4">
          <div>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>

          {file && (
            <div className="space-y-2">
              <p className="text-sm">Selected: {file.name}</p>
              <Button variant="primary" onClick={handleImport} disabled={importing}>
                <Upload size={16} className="mr-2" />
                {importing ? 'Importing...' : 'Import'}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </Page>
  );
}

export default ImportCSV;
