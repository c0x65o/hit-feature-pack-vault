import { checkVaultAction } from './require-action';
/**
 * Resolve effective scope mode using a tree:
 * - entity override: vault.{entity}.{verb}.scope.{mode}
 * - vault default: vault.{verb}.scope.{mode}
 * - fallback: own
 *
 * Precedence if multiple are granted: most restrictive wins.
 */
export async function resolveVaultScopeMode(request, args) {
    const { entity, verb } = args;
    const entityPrefix = entity ? `vault.${entity}.${verb}.scope` : `vault.${verb}.scope`;
    const globalPrefix = `vault.${verb}.scope`;
    // Most restrictive wins (first match returned).
    const modes = ['none', 'own', 'ldd', 'any'];
    for (const m of modes) {
        const res = await checkVaultAction(request, `${entityPrefix}.${m}`);
        if (res.ok)
            return m;
    }
    for (const m of modes) {
        const res = await checkVaultAction(request, `${globalPrefix}.${m}`);
        if (res.ok)
            return m;
    }
    return 'own';
}
