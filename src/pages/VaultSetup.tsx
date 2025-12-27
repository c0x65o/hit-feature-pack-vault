'use client';

import React from 'react';
import { useUi } from '@hit/ui-kit';

/**
 * Legacy page kept as a stub to avoid build failures if older pack-loader output
 * still references `@hit/feature-pack-vault/pages/VaultSetup`.
 *
 * NOTE: The inbound SMS/email webhook OTP inbox was removed. Vault supports TOTP (QR) only.
 */
export function VaultSetup() {
  const { Page, Card } = useUi();
  return (
    <Page title="Vault Setup">
      <Card>
        <div className="p-6 space-y-2">
          <div className="text-lg font-semibold">Setup has moved</div>
          <div className="text-sm text-muted-foreground">
            The inbound SMS/email webhook OTP inbox is no longer supported. Vault now supports TOTP (QR) only.
          </div>
        </div>
      </Card>
    </Page>
  );
}

export default VaultSetup;

