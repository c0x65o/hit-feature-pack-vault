'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useUi } from '@hit/ui-kit';
/**
 * Legacy page kept as a stub to avoid build failures if older pack-loader output
 * still references `@hit/feature-pack-vault/pages/VaultSetup`.
 *
 * NOTE: The inbound SMS/email webhook OTP inbox was removed. Vault supports TOTP (QR) only.
 */
export function VaultSetup() {
    const { Page, Card } = useUi();
    return (_jsx(Page, { title: "Vault Setup", children: _jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-2", children: [_jsx("div", { className: "text-lg font-semibold", children: "Setup has moved" }), _jsx("div", { className: "text-sm text-muted-foreground", children: "The inbound SMS/email webhook OTP inbox is no longer supported. Vault now supports TOTP (QR) only." })] }) }) }));
}
export default VaultSetup;
