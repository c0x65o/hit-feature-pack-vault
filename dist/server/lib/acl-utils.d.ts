import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { User } from '../auth';
export interface AclCheckOptions {
    requiredPermissions?: string[];
    checkInheritance?: boolean;
}
/**
 * Merge permissions from multiple ACLs and return the most privileged set
 * Priority: MANAGE_ACL > DELETE > READ_WRITE > READ_ONLY
 * Note: MANAGE_ACL is independent and doesn't imply other permissions
 */
export declare function mergePermissions(permissionSets: string[][]): string[];
export declare function getUserPrincipals(db: ReturnType<typeof getDb>, user: User, request?: NextRequest): Promise<{
    userId: string;
    userEmail: string;
    groupIds: string[];
    roles: string[];
}>;
/**
 * Get all descendant folder IDs (children, grandchildren, etc.) for a set of parent folder IDs.
 * This is used to ensure that when a user has access to a folder, they also see items in all child folders.
 */
export declare function getDescendantFolderIds(db: ReturnType<typeof getDb>, parentFolderIds: Set<string>): Promise<Set<string>>;
/**
 * Check if user has access to a vault (ownership or ACL)
 */
export declare function checkVaultAccess(db: ReturnType<typeof getDb>, vaultId: string, user: User, requiredPermissions?: string[], request?: NextRequest): Promise<{
    hasAccess: boolean;
    reason?: string;
}>;
/**
 * Get effective ACL permissions for a folder (direct ACLs only, no inheritance)
 * Only root folders (folders without parentId) can have ACLs
 */
export declare function getEffectiveFolderAcls(db: ReturnType<typeof getDb>, folderId: string, principals: {
    userId: string;
    userEmail: string;
    groupIds: string[];
    roles: string[];
}): Promise<Array<{
    permissions: string[];
    inherit: boolean;
}>>;
/**
 * Check if user has access to a folder (ownership or ACL with inheritance)
 */
export declare function checkFolderAccess(db: ReturnType<typeof getDb>, folderId: string, user: User, options?: AclCheckOptions, request?: NextRequest): Promise<{
    hasAccess: boolean;
    reason?: string;
}>;
/**
 * Check if user has access to an item (ownership or ACL with inheritance)
 */
export declare function checkItemAccess(db: ReturnType<typeof getDb>, itemId: string, user: User, options?: AclCheckOptions, request?: NextRequest): Promise<{
    hasAccess: boolean;
    reason?: string;
}>;
//# sourceMappingURL=acl-utils.d.ts.map