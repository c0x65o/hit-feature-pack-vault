// src/server/api/folders.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultFolders, vaultVaults, vaultAcls } from '@/lib/feature-pack-schemas';
import { eq, desc, asc, like, sql, and, or, inArray } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { resolveVaultScopeMode } from '../lib/scope-mode';
import { requireVaultAction } from '../lib/require-action';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/vault/folders
 * List folders for vaults the current user owns
 */
export async function GET(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        // Check read permission and resolve scope mode
        const mode = await resolveVaultScopeMode(request, { entity: 'folders', verb: 'read' });
        if (mode === 'none') {
            // Explicit deny: return empty results
            return NextResponse.json({
                items: [],
                pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
            });
        }
        // Pagination
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
        const offset = (page - 1) * pageSize;
        // Sorting
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        // Search and filters
        const search = searchParams.get('search') || '';
        const vaultId = searchParams.get('vaultId') || null;
        const parentId = searchParams.get('parentId') || null;
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Get PERSONAL vaults the user owns (personal vaults only - owner has full access)
        const userPersonalVaults = await db
            .select({ id: vaultVaults.id })
            .from(vaultVaults)
            .where(and(eq(vaultVaults.ownerUserId, user.sub), eq(vaultVaults.type, 'personal')));
        const userPersonalVaultIds = userPersonalVaults.map((v) => v.id);
        // Build principal IDs for ACL matching (user ID, email, roles, and GROUP IDs)
        // Import ACL utilities once for use throughout the function
        const aclUtils = await import('../lib/acl-utils');
        const principals = await aclUtils.getUserPrincipals(db, user, request);
        const userPrincipalIds = [
            principals.userId,
            principals.userEmail,
            ...principals.roles,
            ...principals.groupIds, // Include group IDs for group-based ACLs
        ].filter(Boolean);
        // Build accessible vault IDs and folder IDs based on scope mode (explicit branching on none/own/ldd/any)
        const accessibleVaultIds = new Set();
        const accessibleFolderIds = new Set();
        if (mode === 'own' || mode === 'ldd') {
            // Only show folders in personal vaults owned by user
            for (const vaultId of userPersonalVaultIds) {
                accessibleVaultIds.add(vaultId);
            }
        }
        else if (mode === 'any') {
            // Show folders in personal vaults owned by user + shared vaults with ACL access
            for (const vaultId of userPersonalVaultIds) {
                accessibleVaultIds.add(vaultId);
            }
            if (userPrincipalIds.length > 0) {
                // Non-admins: Check ACLs for shared vault access
                // Check vault-level ACLs FIRST - users with vault ACL see all folders in that vault
                const vaultAclConditions = userPrincipalIds.map(id => eq(vaultAcls.principalId, id));
                const vaultAclsList = await db
                    .select({ resourceId: vaultAcls.resourceId })
                    .from(vaultAcls)
                    .where(and(eq(vaultAcls.resourceType, 'vault'), or(...vaultAclConditions)));
                for (const acl of vaultAclsList) {
                    accessibleVaultIds.add(acl.resourceId);
                }
                // Check folder-level ACLs - users with folder ACL see that folder AND all descendant folders
                // IMPORTANT: Folder-level ACL does NOT grant vault-level access
                const folderAclConditions = userPrincipalIds.map(id => eq(vaultAcls.principalId, id));
                const folderAcls = await db
                    .select({ resourceId: vaultAcls.resourceId })
                    .from(vaultAcls)
                    .where(and(eq(vaultAcls.resourceType, 'folder'), or(...folderAclConditions)));
                // Get the folder IDs the user has direct access to
                const directAccessFolderIds = new Set();
                for (const acl of folderAcls) {
                    directAccessFolderIds.add(acl.resourceId);
                }
                // Get all descendant folders (children, grandchildren, etc.) of folders the user has access to
                const allAccessibleFolderIds = await aclUtils.getDescendantFolderIds(db, directAccessFolderIds);
                // Add all accessible folders (direct + descendants) to the set
                for (const folderId of allAccessibleFolderIds) {
                    accessibleFolderIds.add(folderId);
                }
            }
        }
        // If no accessible vaults and no accessible folders, return empty
        if (accessibleVaultIds.size === 0 && accessibleFolderIds.size === 0) {
            return NextResponse.json({
                items: [],
                pagination: { page, pageSize, total: 0, totalPages: 0 },
            });
        }
        // Build where conditions:
        // CRITICAL: If user has folder-level ACL but NO vault-level ACL for a vault,
        // they should ONLY see folders they have explicit ACL on, NOT all folders in that vault
        // If vaultId is provided and user ONLY has folder-level ACL (no vault-level ACL for this vault),
        // filter accessibleFolderIds to only folders in this vault BEFORE building conditions
        let filteredAccessibleFolderIds = accessibleFolderIds;
        if (vaultId && !accessibleVaultIds.has(vaultId) && accessibleFolderIds.size > 0) {
            // User ONLY has folder-level ACL - filter to folders in this vault
            const foldersInThisVault = await db
                .select({ id: vaultFolders.id })
                .from(vaultFolders)
                .where(and(eq(vaultFolders.vaultId, vaultId), inArray(vaultFolders.id, Array.from(accessibleFolderIds))));
            filteredAccessibleFolderIds = new Set(foldersInThisVault.map((f) => f.id));
        }
        const conditions = [];
        // Separate vault-level access from folder-level access
        // Users with vault-level ACL see all folders in those vaults
        // Users with ONLY folder-level ACL see ONLY those specific folders
        if (accessibleVaultIds.size > 0 && filteredAccessibleFolderIds.size > 0) {
            // User has both - show folders from vault-level access OR folder-level access
            conditions.push(or(inArray(vaultFolders.vaultId, Array.from(accessibleVaultIds)), inArray(vaultFolders.id, Array.from(filteredAccessibleFolderIds))));
        }
        else if (accessibleVaultIds.size > 0) {
            // User ONLY has vault-level access - show all folders in those vaults
            conditions.push(inArray(vaultFolders.vaultId, Array.from(accessibleVaultIds)));
        }
        else if (filteredAccessibleFolderIds.size > 0) {
            // User ONLY has folder-level access - show ONLY those specific folders
            // This is critical - do NOT show all folders in the vault, only the ones with ACL
            conditions.push(inArray(vaultFolders.id, Array.from(filteredAccessibleFolderIds)));
        }
        if (vaultId) {
            // Add vaultId filter
            conditions.push(eq(vaultFolders.vaultId, vaultId));
        }
        if (parentId) {
            conditions.push(eq(vaultFolders.parentId, parentId));
        }
        else if (searchParams.get('parentId') === 'null') {
            // Explicitly query for root folders
            conditions.push(sql `${vaultFolders.parentId} IS NULL`);
        }
        if (search) {
            conditions.push(like(vaultFolders.name, `%${search}%`));
        }
        // Apply sorting
        const sortColumns = {
            id: vaultFolders.id,
            name: vaultFolders.name,
            path: vaultFolders.path,
            createdAt: vaultFolders.createdAt,
        };
        const orderCol = sortColumns[sortBy] ?? vaultFolders.createdAt;
        const orderDirection = sortOrder === 'asc' ? asc(orderCol) : desc(orderCol);
        const whereClause = and(...conditions);
        // Get total count
        const countQuery = db.select({ count: sql `count(*)` }).from(vaultFolders);
        const countResult = await countQuery.where(whereClause);
        const total = Number(countResult[0]?.count || 0);
        // Execute query
        const items = await db
            .select()
            .from(vaultFolders)
            .where(whereClause)
            .orderBy(orderDirection)
            .limit(pageSize)
            .offset(offset);
        // Add permission flags to each folder for UI conditional rendering
        const itemsWithPermissions = await Promise.all(items.map(async (folder) => {
            // Get vault to check ownership
            const [vault] = await db
                .select()
                .from(vaultVaults)
                .where(eq(vaultVaults.id, folder.vaultId))
                .limit(1);
            const isAdmin = user.roles?.includes('admin') || false;
            const isOwner = vault?.ownerUserId === user.sub;
            // Check ACL permissions to determine actual permission level
            // Admins ALWAYS have full control on shared vaults, regardless of ACLs
            let permissionLevel = 'none';
            // Admins always have full access to shared vaults
            if (isAdmin && vault?.type === 'shared') {
                permissionLevel = 'full';
            }
            else if (isOwner && vault?.type === 'personal') {
                // Personal vault owner has full access (no ACL needed - it's their vault)
                permissionLevel = 'full';
            }
            else {
                // For non-admin users or personal vaults, check ACL permissions
                const folderPrincipals = await aclUtils.getUserPrincipals(db, user, request);
                const effectiveAcls = await aclUtils.getEffectiveFolderAcls(db, folder.id, folderPrincipals);
                if (effectiveAcls.length > 0) {
                    // Merge permissions from all ACLs
                    const allPermissionSets = effectiveAcls.map(acl => acl.permissions);
                    const mergedPermissions = aclUtils.mergePermissions(allPermissionSets);
                    // Determine permission level based on merged permissions
                    // Full control requires MANAGE_ACL permission
                    if (mergedPermissions.includes('MANAGE_ACL')) {
                        permissionLevel = 'full';
                    }
                    else if (mergedPermissions.includes('DELETE')) {
                        permissionLevel = 'read_write_delete';
                    }
                    else if (mergedPermissions.includes('READ_WRITE')) {
                        permissionLevel = 'read_write';
                    }
                    else if (mergedPermissions.includes('READ_ONLY')) {
                        permissionLevel = 'read_only';
                    }
                }
            }
            // Use checkFolderAccess for the boolean flags (for backward compatibility)
            const deleteCheck = await aclUtils.checkFolderAccess(db, folder.id, user, { requiredPermissions: ['DELETE'] });
            const writeCheck = await aclUtils.checkFolderAccess(db, folder.id, user, { requiredPermissions: ['READ_WRITE'] });
            return {
                ...folder,
                canDelete: deleteCheck.hasAccess,
                canShare: writeCheck.hasAccess, // Sharing requires READ_WRITE permission
                canEdit: writeCheck.hasAccess,
                permissionLevel, // User's permission level for this folder (based on ACLs first, then owner/admin)
            };
        }));
        return NextResponse.json({
            items: itemsWithPermissions,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    }
    catch (error) {
        console.error('[vault] List folders error:', error);
        return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
    }
}
/**
 * POST /api/vault/folders
 * Create a new folder in a vault
 */
export async function POST(request) {
    try {
        const db = getDb();
        const body = await request.json();
        if (!body.name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        if (!body.vaultId) {
            return NextResponse.json({ error: 'Vault ID is required' }, { status: 400 });
        }
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Check create permission
        const createCheck = await requireVaultAction(request, 'vault.folders.create');
        if (createCheck) {
            return createCheck;
        }
        // Check write permission and resolve scope mode
        const mode = await resolveVaultScopeMode(request, { entity: 'folders', verb: 'write' });
        if (mode === 'none') {
            return NextResponse.json({ error: 'Forbidden: Write access denied' }, { status: 403 });
        }
        // Verify user has access to vault
        const [vault] = await db
            .select()
            .from(vaultVaults)
            .where(eq(vaultVaults.id, body.vaultId))
            .limit(1);
        if (!vault) {
            return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
        }
        // Apply scope mode filtering (explicit branching on none/own/ldd/any)
        const isPersonalVaultOwner = vault.ownerUserId === user.sub && vault.type === 'personal';
        if (mode === 'own' || mode === 'ldd') {
            // Only allow creating folders in personal vaults owned by user
            if (!isPersonalVaultOwner) {
                return NextResponse.json({ error: 'Forbidden: Cannot create folders in this vault with current permissions' }, { status: 403 });
            }
        }
        else if (mode === 'any') {
            // For shared vaults, check ACL access (not implemented for folders yet, but structure is ready)
            // For now, only allow personal vault owners
            if (!isPersonalVaultOwner) {
                return NextResponse.json({ error: 'Forbidden: Cannot create folders in shared vaults' }, { status: 403 });
            }
        }
        // Handle root folder creation (parentId is null) or nested folder creation
        let path;
        if (!body.parentId) {
            // Root folder: path is just /{name}/
            path = `/${body.name}/`;
        }
        else {
            // Nested folder: verify parent folder exists and belongs to the same vault
            const [parent] = await db
                .select()
                .from(vaultFolders)
                .where(and(eq(vaultFolders.id, body.parentId), eq(vaultFolders.vaultId, body.vaultId)))
                .limit(1);
            if (!parent) {
                return NextResponse.json({ error: 'Parent folder not found or does not belong to this vault' }, { status: 404 });
            }
            // Build materialized path from parent
            path = `${parent.path}${body.name}/`;
        }
        const result = await db.insert(vaultFolders).values({
            vaultId: body.vaultId,
            parentId: body.parentId,
            name: body.name,
            path,
            createdBy: user.sub,
        }).returning();
        return NextResponse.json(result[0], { status: 201 });
    }
    catch (error) {
        console.error('[vault] Create folder error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to create folder';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
