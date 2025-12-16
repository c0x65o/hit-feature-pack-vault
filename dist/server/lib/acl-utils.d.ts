import { getDb } from '@/lib/db';
import type { User } from '../auth';
export interface AclCheckOptions {
    requiredPermissions?: string[];
    checkInheritance?: boolean;
}
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