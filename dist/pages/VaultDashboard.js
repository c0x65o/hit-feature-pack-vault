'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { Dashboards } from '@hit/feature-pack-dashboard-shell';
/**
 * Vault Dashboard page - renders the shared Dashboards component
 * with pack="vault" preset.
 *
 * This provides a clean URL at /vault/dashboard instead of /dashboards?pack=vault
 */
export function VaultDashboard() {
    return _jsx(Dashboards, { pack: "vault" });
}
export default VaultDashboard;
