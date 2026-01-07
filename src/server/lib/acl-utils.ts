import type { NextRequest } from 'next/server';
// src/server/lib/acl-utils.ts
import { getDb } from '@/lib/db';
import { vaultAcls, vaultFolders, vaultVaults, vaultItems, vaultGroupMembers } from '@/lib/feature-pack-schemas';
import { eq, and, or, inArray } from 'drizzle-orm';
import type { User } from '../auth';
import { resolveUserPrincipals } from '@/lib/acl-utils';

export interface AclCheckOptions {
  requiredPermissions?: string[];
  checkInheritance?: boolean;
}

/**
 * Map legacy permission names to actual permissions
 * Legacy: EDIT, SHARE, VIEW_METADATA -> Actual: READ_ONLY, READ_WRITE, DELETE
 */
function mapLegacyPermission(perm: string): string {
  const mapping: Record<string, string> = {
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
function normalizePermissions(permissions: string[]): string[] {
  const validPermissions = ['READ_ONLY', 'READ_WRITE', 'DELETE', 'MANAGE_ACL'];
  const normalized = permissions.map(mapLegacyPermission);
  return normalized.filter(p => validPermissions.includes(p));
}

/**
 * Merge permissions from multiple ACLs and return the most privileged set
 * Priority: MANAGE_ACL > DELETE > READ_WRITE > READ_ONLY
 * Note: MANAGE_ACL is independent and doesn't imply other permissions
 */
export function mergePermissions(permissionSets: string[][]): string[] {
  const merged = new Set<string>();
  
  for (const perms of permissionSets) {
    for (const perm of normalizePermissions(perms)) {
      merged.add(perm);
    }
  }
  
  // Build result with implicit permissions
  // If user has DELETE, they implicitly have READ_WRITE and READ_ONLY
  // If user has READ_WRITE, they implicitly have READ_ONLY
  // MANAGE_ACL is independent and doesn't imply other permissions
  const result: string[] = [];
  if (merged.has('DELETE')) {
    result.push('READ_ONLY', 'READ_WRITE', 'DELETE');
  } else if (merged.has('READ_WRITE')) {
    result.push('READ_ONLY', 'READ_WRITE');
  } else if (merged.has('READ_ONLY')) {
    result.push('READ_ONLY');
  }
  
  // MANAGE_ACL is independent - add it if present
  if (merged.has('MANAGE_ACL')) {
    result.push('MANAGE_ACL');
  }
  
  return result;
}

/**
 * Get user's groups and roles for ACL checking
 */
export async function getUserPrincipals(db: ReturnType<typeof getDb>, user: User, request?: NextRequest): Promise<{
  userId: string;
  userEmail: string;
  groupIds: string[];
  roles: string[];
}> {
  // Centralized principal resolution (JWT + dynamic groups via auth module) with a vault-specific
  // extra source for static vault group memberships.
  return await resolveUserPrincipals({
    request,
    user,
    extraGroupIds: async () => {
      const userId = user.sub;
      const userEmail = user.email || '';
      const userIdentifiers = [userId, userEmail].filter(Boolean);
      if (userIdentifiers.length === 0) return [];

      try {
        const membershipConditions = userIdentifiers.map((id) => eq(vaultGroupMembers.userId, id));
        const memberships = await db
          .select({ groupId: vaultGroupMembers.groupId })
          .from(vaultGroupMembers)
          .where(or(...membershipConditions));
        return memberships.map((m: { groupId: string }) => m.groupId);
      } catch (error) {
        // Best-effort only: vault still works with JWT + auth-module groups.
        console.warn('[vault] Failed to fetch vault group memberships:', error);
        return [];
      }
    },
  });
}

/**
 * Get all descendant folder IDs (children, grandchildren, etc.) for a set of parent folder IDs.
 * This is used to ensure that when a user has access to a folder, they also see items in all child folders.
 */
export async function getDescendantFolderIds(
  db: ReturnType<typeof getDb>,
  parentFolderIds: Set<string>
): Promise<Set<string>> {
  if (parentFolderIds.size === 0) {
    return new Set<string>();
  }

  const allFolderIds = new Set<string>(parentFolderIds);
  let currentLevelIds = Array.from(parentFolderIds);

  // Recursively find all descendants
  while (currentLevelIds.length > 0) {
    const children = await db
      .select({ id: vaultFolders.id })
      .from(vaultFolders)
      .where(inArray(vaultFolders.parentId, currentLevelIds));

    const newChildIds = children
      .map((c: { id: string }) => c.id)
      .filter((id: string) => !allFolderIds.has(id));

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
export async function checkVaultAccess(
  db: ReturnType<typeof getDb>,
  vaultId: string,
  user: User,
  requiredPermissions?: string[],
  request?: NextRequest
): Promise<{ hasAccess: boolean; reason?: string }> {
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
  const principals = await getUserPrincipals(db, user, request);
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
    .where(
      and(
        eq(vaultAcls.resourceType, 'vault'),
        eq(vaultAcls.resourceId, vaultId),
        or(...aclConditions)
      )
    );

  if (acls.length === 0) {
    return { hasAccess: false, reason: 'No ACL permissions found' };
  }

  // Merge all permissions from all ACLs (user may have multiple ACLs via user + group)
  const allPermissionSets = acls.map((acl: typeof acls[0]) => 
    Array.isArray(acl.permissions) ? acl.permissions : []
  );
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
 * Get effective ACL permissions for a folder (direct ACLs only, no inheritance)
 * Only root folders (folders without parentId) can have ACLs
 */
export async function getEffectiveFolderAcls(
  db: ReturnType<typeof getDb>,
  folderId: string,
  principals: { userId: string; userEmail: string; groupIds: string[]; roles: string[] }
): Promise<Array<{ permissions: string[]; inherit: boolean }>> {
  // Get folder
  const [folder] = await db
    .select()
    .from(vaultFolders)
    .where(eq(vaultFolders.id, folderId))
    .limit(1);

  if (!folder) {
    return [];
  }

  // Only root folders can have ACLs - return empty if folder has a parent
  if (folder.parentId) {
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

  // Get direct ACLs on this folder only (no inheritance)
  const directAclConditions = principalIds.map(id => eq(vaultAcls.principalId, id));
  const directAcls = await db
    .select()
    .from(vaultAcls)
    .where(
      and(
        eq(vaultAcls.resourceType, 'folder'),
        eq(vaultAcls.resourceId, folderId),
        or(...directAclConditions)
      )
    );

  const effectiveAcls: Array<{ permissions: string[]; inherit: boolean }> = [];

  // Add direct ACLs only
  for (const acl of directAcls) {
    effectiveAcls.push({
      permissions: Array.isArray(acl.permissions) ? acl.permissions : [],
      inherit: false, // No inheritance allowed
    });
  }

  return effectiveAcls;
}

/**
 * Check if user has access to a folder (ownership or ACL with inheritance)
 */
export async function checkFolderAccess(
  db: ReturnType<typeof getDb>,
  folderId: string,
  user: User,
  options: AclCheckOptions = {},
  request?: NextRequest
): Promise<{ hasAccess: boolean; reason?: string }> {
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
  const principals = await getUserPrincipals(db, user, request);
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
export async function checkItemAccess(
  db: ReturnType<typeof getDb>,
  itemId: string,
  user: User,
  options: AclCheckOptions = {},
  request?: NextRequest
): Promise<{ hasAccess: boolean; reason?: string }> {
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
  const principals = await getUserPrincipals(db, user, request);
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
    .where(
      and(
        eq(vaultAcls.resourceType, 'item'),
        eq(vaultAcls.resourceId, itemId),
        or(...itemAclConditions)
      )
    );

  // Check folder ACLs if item is in a folder
  let folderAcls: typeof itemAcls = [];
  if (item.folderId) {
    const folderAccess = await checkFolderAccess(db, item.folderId, user, { checkInheritance: true }, request);
    if (folderAccess.hasAccess) {
      // Get effective folder ACLs
      const effectiveFolderAcls = await getEffectiveFolderAcls(db, item.folderId, principals);
      folderAcls = effectiveFolderAcls.map(acl => ({
        id: '',
        resourceType: 'folder' as const,
        resourceId: item.folderId!,
        principalType: 'user' as const,
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
  const allPermissionSets = allAcls.map(acl => 
    Array.isArray(acl.permissions) ? acl.permissions : []
  );
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

