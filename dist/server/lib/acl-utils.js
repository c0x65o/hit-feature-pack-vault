import { vaultAcls, vaultFolders, vaultVaults, vaultItems } from '@/lib/feature-pack-schemas';
import { eq, and, or, inArray } from 'drizzle-orm';
/**
 * Get user's groups and roles for ACL checking
 */
async function getUserPrincipals(db, user) {
    const userId = user.sub;
    const userEmail = user.email || '';
    const roles = user.roles || [];
    // TODO: Get groups from auth module or static groups table
    // For now, return empty groups array - this should be implemented based on your auth setup
    const groupIds = [];
    return { userId, userEmail, groupIds, roles };
}
/**
 * Get all descendant folder IDs (children, grandchildren, etc.) for a set of parent folder IDs.
 * This is used to ensure that when a user has access to a folder, they also see items in all child folders.
 */
export async function getDescendantFolderIds(db, parentFolderIds) {
    if (parentFolderIds.size === 0) {
        return new Set();
    }
    const allFolderIds = new Set(parentFolderIds);
    let currentLevelIds = Array.from(parentFolderIds);
    // Recursively find all descendants
    while (currentLevelIds.length > 0) {
        const children = await db
            .select({ id: vaultFolders.id })
            .from(vaultFolders)
            .where(inArray(vaultFolders.parentId, currentLevelIds));
        const newChildIds = children
            .map((c) => c.id)
            .filter((id) => !allFolderIds.has(id));
        if (newChildIds.length === 0) {
            break; // No more children found
        }
        for (const id of newChildIds) {
            allFolderIds.add(id);
        }
        currentLevelIds = newChildIds;
    }
    return allFolderIds;
}
/**
 * Check if user has access to a vault (ownership or ACL)
 */
export async function checkVaultAccess(db, vaultId, user, requiredPermissions) {
    // Check vault ownership
    const [vault] = await db
        .select()
        .from(vaultVaults)
        .where(eq(vaultVaults.id, vaultId))
        .limit(1);
    if (!vault) {
        return { hasAccess: false, reason: 'Vault not found' };
    }
    // Owner has full access
    if (vault.ownerUserId === user.sub) {
        return { hasAccess: true };
    }
    // Admins have full access to shared vaults
    const isAdmin = user.roles?.includes('admin') || false;
    if (isAdmin && vault.type === 'shared') {
        return { hasAccess: true };
    }
    // For non-owners and non-admins, check ACL permissions
    const principals = await getUserPrincipals(db, user);
    const principalIds = [
        principals.userId,
        principals.userEmail,
        ...principals.groupIds,
        ...principals.roles,
    ].filter(Boolean);
    if (principalIds.length === 0) {
        return { hasAccess: false, reason: 'No principals found' };
    }
    // Query ACLs matching any principal
    const aclConditions = principalIds.map(id => eq(vaultAcls.principalId, id));
    const acls = await db
        .select()
        .from(vaultAcls)
        .where(and(eq(vaultAcls.resourceType, 'vault'), eq(vaultAcls.resourceId, vaultId), or(...aclConditions)));
    if (acls.length === 0) {
        return { hasAccess: false, reason: 'No ACL permissions found' };
    }
    // Check if any ACL has required permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
        const hasRequiredPermissions = acls.some((acl) => {
            const permissions = Array.isArray(acl.permissions) ? acl.permissions : [];
            return requiredPermissions.every(perm => permissions.includes(perm));
        });
        if (!hasRequiredPermissions) {
            return { hasAccess: false, reason: 'Missing required permissions' };
        }
    }
    return { hasAccess: true };
}
/**
 * Get effective ACL permissions for a folder, checking inheritance from parent folders
 */
async function getEffectiveFolderAcls(db, folderId, principals) {
    // Get folder and its path
    const [folder] = await db
        .select()
        .from(vaultFolders)
        .where(eq(vaultFolders.id, folderId))
        .limit(1);
    if (!folder) {
        return [];
    }
    const principalIds = [
        principals.userId,
        principals.userEmail,
        ...principals.groupIds,
        ...principals.roles,
    ].filter(Boolean);
    if (principalIds.length === 0) {
        return [];
    }
    // Get direct ACLs on this folder
    const directAclConditions = principalIds.map(id => eq(vaultAcls.principalId, id));
    const directAcls = await db
        .select()
        .from(vaultAcls)
        .where(and(eq(vaultAcls.resourceType, 'folder'), eq(vaultAcls.resourceId, folderId), or(...directAclConditions)));
    const effectiveAcls = [];
    // Add direct ACLs
    for (const acl of directAcls) {
        effectiveAcls.push({
            permissions: Array.isArray(acl.permissions) ? acl.permissions : [],
            inherit: acl.inherit,
        });
    }
    // Check parent folders for inherited ACLs
    if (folder.parentId) {
        // Walk up the parent chain
        const parentFolders = [];
        let currentParentId = folder.parentId;
        while (currentParentId) {
            const [parent] = await db
                .select({ id: vaultFolders.id, parentId: vaultFolders.parentId })
                .from(vaultFolders)
                .where(and(eq(vaultFolders.id, currentParentId), eq(vaultFolders.vaultId, folder.vaultId)))
                .limit(1);
            if (!parent)
                break;
            parentFolders.push({ id: parent.id });
            currentParentId = parent.parentId || null;
        }
        // Get inherited ACLs from parents
        if (principalIds.length > 0) {
            const parentAclConditions = principalIds.map(id => eq(vaultAcls.principalId, id));
            for (const parentFolder of parentFolders) {
                const parentAcls = await db
                    .select()
                    .from(vaultAcls)
                    .where(and(eq(vaultAcls.resourceType, 'folder'), eq(vaultAcls.resourceId, parentFolder.id), eq(vaultAcls.inherit, true), or(...parentAclConditions)));
                for (const acl of parentAcls) {
                    effectiveAcls.push({
                        permissions: Array.isArray(acl.permissions) ? acl.permissions : [],
                        inherit: true,
                    });
                }
            }
        }
    }
    // Also check vault-level ACLs
    if (principalIds.length > 0) {
        const vaultAclConditions = principalIds.map(id => eq(vaultAcls.principalId, id));
        const vaultAclsList = await db
            .select()
            .from(vaultAcls)
            .where(and(eq(vaultAcls.resourceType, 'vault'), eq(vaultAcls.resourceId, folder.vaultId), or(...vaultAclConditions)));
        for (const acl of vaultAclsList) {
            effectiveAcls.push({
                permissions: Array.isArray(acl.permissions) ? acl.permissions : [],
                inherit: true,
            });
        }
    }
    return effectiveAcls;
}
/**
 * Check if user has access to a folder (ownership or ACL with inheritance)
 */
export async function checkFolderAccess(db, folderId, user, options = {}) {
    const { requiredPermissions = [], checkInheritance = true } = options;
    // Get folder
    const [folder] = await db
        .select()
        .from(vaultFolders)
        .where(eq(vaultFolders.id, folderId))
        .limit(1);
    if (!folder) {
        return { hasAccess: false, reason: 'Folder not found' };
    }
    // Get vault to check ownership and type
    const [vault] = await db
        .select()
        .from(vaultVaults)
        .where(eq(vaultVaults.id, folder.vaultId))
        .limit(1);
    if (!vault) {
        return { hasAccess: false, reason: 'Vault not found' };
    }
    const isAdmin = user.roles?.includes('admin') || false;
    const isOwner = vault.ownerUserId === user.sub;
    // For owners of personal vaults: they have full access (all permissions)
    if (isOwner && vault.type === 'personal') {
        return { hasAccess: true };
    }
    // For shared vaults: owners and admins need explicit ACL entries for specific permissions
    // If no specific permissions required, grant access to owners/admins
    if ((isOwner || isAdmin) && vault.type === 'shared') {
        if (requiredPermissions.length === 0) {
            return { hasAccess: true };
        }
        // For specific permissions, fall through to ACL check below
    }
    // For non-owners and non-admins, check ACL permissions
    const principals = await getUserPrincipals(db, user);
    const effectiveAcls = await getEffectiveFolderAcls(db, folderId, principals);
    if (effectiveAcls.length === 0) {
        // If user is admin/owner but no ACLs found and permissions required, deny
        if ((isOwner || (isAdmin && vault.type === 'shared')) && requiredPermissions.length > 0) {
            return { hasAccess: false, reason: 'No ACL permissions found for required permissions' };
        }
        return { hasAccess: false, reason: 'No ACL permissions found' };
    }
    // Merge all permissions from effective ACLs
    const allPermissions = new Set();
    for (const acl of effectiveAcls) {
        for (const perm of acl.permissions) {
            allPermissions.add(perm);
        }
    }
    // Check required permissions - if specified, user must have them
    if (requiredPermissions.length > 0) {
        const hasAllRequired = requiredPermissions.every(perm => allPermissions.has(perm));
        if (!hasAllRequired) {
            return { hasAccess: false, reason: 'Missing required permissions' };
        }
    }
    return { hasAccess: true };
}
/**
 * Check if user has access to an item (ownership or ACL with inheritance)
 */
export async function checkItemAccess(db, itemId, user, options = {}) {
    const { requiredPermissions = [] } = options;
    // Get item
    const [item] = await db
        .select()
        .from(vaultItems)
        .where(eq(vaultItems.id, itemId))
        .limit(1);
    if (!item) {
        return { hasAccess: false, reason: 'Item not found' };
    }
    // Get vault to check ownership and type
    const [vault] = await db
        .select()
        .from(vaultVaults)
        .where(eq(vaultVaults.id, item.vaultId))
        .limit(1);
    if (!vault) {
        return { hasAccess: false, reason: 'Vault not found' };
    }
    // Vault owner has full access
    if (vault.ownerUserId === user.sub) {
        return { hasAccess: true };
    }
    // Admins have full access to shared vaults
    const isAdmin = user.roles?.includes('admin') || false;
    if (isAdmin && vault.type === 'shared') {
        return { hasAccess: true };
    }
    // Check item-level ACLs
    const principals = await getUserPrincipals(db, user);
    const principalIds = [
        principals.userId,
        principals.userEmail,
        ...principals.groupIds,
        ...principals.roles,
    ].filter(Boolean);
    if (principalIds.length === 0) {
        return { hasAccess: false, reason: 'No principals found' };
    }
    // Get direct item ACLs
    const itemAclConditions = principalIds.map(id => eq(vaultAcls.principalId, id));
    const itemAcls = await db
        .select()
        .from(vaultAcls)
        .where(and(eq(vaultAcls.resourceType, 'item'), eq(vaultAcls.resourceId, itemId), or(...itemAclConditions)));
    // Check folder ACLs if item is in a folder
    let folderAcls = [];
    if (item.folderId) {
        const folderAccess = await checkFolderAccess(db, item.folderId, user, { checkInheritance: true });
        if (folderAccess.hasAccess) {
            // Get effective folder ACLs
            const effectiveFolderAcls = await getEffectiveFolderAcls(db, item.folderId, principals);
            folderAcls = effectiveFolderAcls.map(acl => ({
                id: '',
                resourceType: 'folder',
                resourceId: item.folderId,
                principalType: 'user',
                principalId: '',
                permissions: acl.permissions,
                inherit: acl.inherit,
                createdBy: '',
                createdAt: new Date(),
            }));
        }
    }
    const allAcls = [...itemAcls, ...folderAcls];
    if (allAcls.length === 0) {
        return { hasAccess: false, reason: 'No ACL permissions found' };
    }
    // Check required permissions
    if (requiredPermissions.length > 0) {
        const hasRequiredPermissions = allAcls.some(acl => {
            const permissions = Array.isArray(acl.permissions) ? acl.permissions : [];
            return requiredPermissions.every(perm => permissions.includes(perm));
        });
        if (!hasRequiredPermissions) {
            return { hasAccess: false, reason: 'Missing required permissions' };
        }
    }
    return { hasAccess: true };
}
