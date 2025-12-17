import { vaultAcls, vaultFolders, vaultVaults, vaultItems, vaultGroupMembers } from '@/lib/feature-pack-schemas';
import { eq, and, or, inArray } from 'drizzle-orm';
/**
 * Map legacy permission names to actual permissions
 * Legacy: EDIT, SHARE, VIEW_METADATA -> Actual: READ_ONLY, READ_WRITE, DELETE
 */
function mapLegacyPermission(perm) {
    const mapping = {
        'EDIT': 'READ_WRITE',
        'SHARE': 'READ_WRITE',
        'VIEW_METADATA': 'READ_ONLY',
        'REVEAL_PASSWORD': 'READ_ONLY',
        'COPY_PASSWORD': 'READ_ONLY',
        'GENERATE_TOTP': 'READ_WRITE',
        'REVEAL_TOTP_SECRET': 'READ_ONLY',
        'READ_SMS': 'READ_ONLY',
        'MANAGE_SMS': 'READ_WRITE',
        'IMPORT': 'READ_WRITE',
    };
    return mapping[perm] || perm;
}
/**
 * Normalize permissions array - map legacy permissions and ensure valid ones
 */
function normalizePermissions(permissions) {
    const validPermissions = ['READ_ONLY', 'READ_WRITE', 'DELETE'];
    const normalized = permissions.map(mapLegacyPermission);
    return normalized.filter(p => validPermissions.includes(p));
}
/**
 * Merge permissions from multiple ACLs and return the most privileged set
 * Priority: DELETE > READ_WRITE > READ_ONLY
 */
export function mergePermissions(permissionSets) {
    const merged = new Set();
    for (const perms of permissionSets) {
        for (const perm of normalizePermissions(perms)) {
            merged.add(perm);
        }
    }
    // If user has DELETE, they implicitly have READ_WRITE and READ_ONLY
    // If user has READ_WRITE, they implicitly have READ_ONLY
    const result = [];
    if (merged.has('DELETE')) {
        result.push('READ_ONLY', 'READ_WRITE', 'DELETE');
    }
    else if (merged.has('READ_WRITE')) {
        result.push('READ_ONLY', 'READ_WRITE');
    }
    else if (merged.has('READ_ONLY')) {
        result.push('READ_ONLY');
    }
    return result;
}
/**
 * Get user's groups and roles for ACL checking
 */
export async function getUserPrincipals(db, user) {
    const userId = user.sub;
    const userEmail = user.email || '';
    const roles = user.roles || [];
    // Get groups the user belongs to from the vault_group_members table (static groups)
    // The userId in vault_group_members can be either the user's sub (ID) or email
    const groupIds = [];
    try {
        // Query by both user ID and email to find group memberships
        const userIdentifiers = [userId, userEmail].filter(Boolean);
        if (userIdentifiers.length > 0) {
            const membershipConditions = userIdentifiers.map(id => eq(vaultGroupMembers.userId, id));
            const memberships = await db
                .select({ groupId: vaultGroupMembers.groupId })
                .from(vaultGroupMembers)
                .where(or(...membershipConditions));
            for (const membership of memberships) {
                groupIds.push(membership.groupId);
            }
        }
    }
    catch (error) {
        // If table doesn't exist or query fails, continue with empty groups
        console.warn('Failed to fetch user group memberships:', error);
    }
    // Also fetch dynamic groups from auth module (if user email is available)
    // Dynamic groups are stored in the auth module's database, not in vault_group_members
    if (userEmail) {
        try {
            const authUrl = process.env.HIT_AUTH_URL || process.env.NEXT_PUBLIC_HIT_AUTH_URL || '/api/proxy/auth';
            const serviceToken = process.env.HIT_SERVICE_TOKEN;
            const headers = {
                'Content-Type': 'application/json',
            };
            // Use service token if available, otherwise rely on proxy authentication
            if (serviceToken) {
                headers['X-HIT-Service-Token'] = serviceToken;
            }
            const response = await fetch(`${authUrl.replace(/\/$/, '')}/admin/users/${encodeURIComponent(userEmail.toLowerCase())}/groups`, {
                headers,
            });
            if (response.ok) {
                const userGroups = await response.json();
                if (Array.isArray(userGroups)) {
                    // Extract group IDs from the response (UserGroupResponse uses group_id field)
                    for (const userGroup of userGroups) {
                        if (userGroup.group_id) {
                            groupIds.push(String(userGroup.group_id));
                        }
                    }
                }
            }
            else if (response.status !== 404) {
                // 404 is expected if user has no groups, but log other errors
                console.warn(`Failed to fetch dynamic groups from auth module: ${response.status} ${response.statusText}`);
            }
        }
        catch (error) {
            // If auth module is unavailable, continue with static groups only
            // This allows the system to work even if auth module is down
            console.warn('Failed to fetch dynamic groups from auth module:', error);
        }
    }
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
    // Personal vault owner has full access
    if (vault.ownerUserId === user.sub && vault.type === 'personal') {
        return { hasAccess: true };
    }
    // Admins have full access to shared vaults (can see everything)
    const isAdmin = user.roles?.includes('admin') || false;
    if (isAdmin && vault.type === 'shared') {
        return { hasAccess: true };
    }
    // For shared vaults, even owners need explicit ACLs
    // Check ACL permissions
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
    // Merge all permissions from all ACLs (user may have multiple ACLs via user + group)
    const allPermissionSets = acls.map((acl) => Array.isArray(acl.permissions) ? acl.permissions : []);
    const mergedPermissions = mergePermissions(allPermissionSets);
    // Check if any ACL has required permissions (map legacy permissions)
    if (requiredPermissions && requiredPermissions.length > 0) {
        const normalizedRequired = requiredPermissions.map(mapLegacyPermission);
        const hasRequiredPermissions = normalizedRequired.every(perm => mergedPermissions.includes(perm));
        if (!hasRequiredPermissions) {
            return { hasAccess: false, reason: 'Missing required permissions' };
        }
    }
    return { hasAccess: true };
}
/**
 * Get effective ACL permissions for a folder, checking inheritance from parent folders
 */
export async function getEffectiveFolderAcls(db, folderId, principals) {
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
    // For shared vaults: admins have full access (can see everything)
    // But shared vault owners need explicit ACLs (they don't get automatic access)
    if (isAdmin && vault.type === 'shared') {
        return { hasAccess: true };
    }
    // Check ACL permissions
    const principals = await getUserPrincipals(db, user);
    const effectiveAcls = await getEffectiveFolderAcls(db, folderId, principals);
    if (effectiveAcls.length === 0) {
        // No ACLs found for this user
        // Admins still have access to shared vaults (just no specific permission level)
        // But shared vault owners need explicit ACLs like everyone else
        if (isAdmin && vault.type === 'shared') {
            // Admin can access but without specific permissions from ACL
            // Return true for basic access, but no specific permissions
            if (requiredPermissions.length === 0) {
                return { hasAccess: true };
            }
            // If specific permissions required, deny (admin can see but not modify without ACL)
            return { hasAccess: false, reason: 'No ACL permissions found for required permissions' };
        }
        return { hasAccess: false, reason: 'No ACL permissions found' };
    }
    // Merge all permissions from effective ACLs (user may have multiple ACLs via user + group)
    const allPermissionSets = effectiveAcls.map(acl => acl.permissions);
    const mergedPermissions = mergePermissions(allPermissionSets);
    // Check required permissions - if specified, user must have them (map legacy permissions)
    if (requiredPermissions.length > 0) {
        const normalizedRequired = requiredPermissions.map(mapLegacyPermission);
        const hasAllRequired = normalizedRequired.every(perm => mergedPermissions.includes(perm));
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
    // Personal vault owner has full access to their own vault
    if (vault.ownerUserId === user.sub && vault.type === 'personal') {
        return { hasAccess: true };
    }
    // Admins have full access to shared vaults (can see everything)
    const isAdmin = user.roles?.includes('admin') || false;
    if (isAdmin && vault.type === 'shared') {
        return { hasAccess: true };
    }
    // For shared vaults, even owners need explicit ACLs
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
    // Merge all permissions from item and folder ACLs (user may have multiple ACLs via user + group)
    const allPermissionSets = allAcls.map(acl => Array.isArray(acl.permissions) ? acl.permissions : []);
    const mergedPermissions = mergePermissions(allPermissionSets);
    // Check required permissions (map legacy permissions)
    if (requiredPermissions.length > 0) {
        const normalizedRequired = requiredPermissions.map(mapLegacyPermission);
        const hasRequiredPermissions = normalizedRequired.every(perm => mergedPermissions.includes(perm));
        if (!hasRequiredPermissions) {
            return { hasAccess: false, reason: 'Missing required permissions' };
        }
    }
    return { hasAccess: true };
}
