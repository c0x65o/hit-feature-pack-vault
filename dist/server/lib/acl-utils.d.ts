import { getDb } from '@/lib/db';
import type { User } from '../auth';
export interface AclCheckOptions {
    requiredPermissions?: string[];
    checkInheritance?: boolean;
}
/**
 * Get all descendant folder IDs (children, grandchildren, etc.) for a set of parent folder IDs.
 * This is used to ensure that when a user has access to a folder, they also see items in all child folders.
 */
export declare function getDescendantFolderIds(db: ReturnType<typeof getDb>, parentFolderIds: Set<string>): Promise<Set<string>>;
/**
 * Check if user has access to a vault (ownership or ACL)
 */
export declare function checkVaultAccess(db: ReturnType<typeof getDb>, vaultId: string, user: User, requiredPermissions?: string[]): Promise<{
    hasAccess: boolean;
    reason?: string;
}>;
/**
 * Check if user has access to a folder (ownership or ACL with inheritance)
 */
export declare function checkFolderAccess(db: ReturnType<typeof getDb>, folderId: string, user: User, options?: AclCheckOptions): Promise<{
    hasAccess: boolean;
    reason?: string;
}>;
/**
 * Check if user has access to an item (ownership or ACL with inheritance)
 */
export declare function checkItemAccess(db: ReturnType<typeof getDb>, itemId: string, user: User, options?: AclCheckOptions): Promise<{
    hasAccess: boolean;
    reason?: string;
}>;
//# sourceMappingURL=acl-utils.d.ts.map