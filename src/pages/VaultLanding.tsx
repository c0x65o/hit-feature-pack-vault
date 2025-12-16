'use client';

import React from 'react';
import { useUi } from '@hit/ui-kit';
import { Lock, User, Users, Upload } from 'lucide-react';

interface Props {
  onNavigate?: (path: string) => void;
}

export function VaultLanding({ onNavigate }: Props) {
  const { Page, Card, Button } = useUi();

  const navigate = (path: string) => {
    if (onNavigate) onNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  return (
    <Page
      title="Vault"
      description="Manage your passwords and 2FA secrets securely"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <button onClick={() => navigate('/vault/personal')} className="text-left">
          <Card>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5" />
                <h3 className="font-semibold">Personal Vault</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Your private password vault
              </p>
              <p className="text-sm text-muted-foreground">
                Store and manage your personal passwords and secrets
              </p>
            </div>
          </Card>
        </button>

        <button onClick={() => navigate('/vault/shared')} className="text-left">
          <Card>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-5 w-5" />
                <h3 className="font-semibold">Shared Vaults</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Team and organization vaults
              </p>
              <p className="text-sm text-muted-foreground">
                Collaborate on shared credentials with your team
              </p>
            </div>
          </Card>
        </button>

        <button onClick={() => navigate('/vault/import')} className="text-left">
          <Card>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="h-5 w-5" />
                <h3 className="font-semibold">Import</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Import passwords from CSV
              </p>
              <p className="text-sm text-muted-foreground">
                Bulk import passwords from CSV files
              </p>
            </div>
          </Card>
        </button>
      </div>
    </Page>
  );
}

export default VaultLanding;
