import { checkActionPermission, requireActionPermission, } from '@hit/feature-pack-auth-core/server/lib/action-check';
export async function checkVaultAction(request, actionKey) {
    return checkActionPermission(request, actionKey, { logPrefix: 'Vault' });
}
export async function requireVaultAction(request, actionKey) {
    return requireActionPermission(request, actionKey, { logPrefix: 'Vault' });
}
