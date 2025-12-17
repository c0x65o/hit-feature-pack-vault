// src/server/api/vaults.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultVaults, vaultAcls, vaultFolders } from '@/lib/feature-pack-schemas';
import { eq, desc, asc, like, sql, and, or, inArray } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
// Required for Next.js App Router
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/vault/vaults
 * List all vaults for the current user (personal + shared they have access to)
 */
export async function GET(request) {
    try {
        const db = getDb();
        const { searchParams } = new URL(request.url);
        // Pagination
        const page = parseInt(searchParams.get('page') || '1', 10);
        const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
        const offset = (page - 1) * pageSize;
        // Sorting
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        // Search
        const search = searchParams.get('search') || '';
        // Filter by type
        const type = searchParams.get('type');
        // Per-user scope: filter by owner user ID
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Get full user info for role checking
        const user = extractUserFromRequest(request);
        const isAdmin = user?.roles?.includes('admin') || false;
        // Build principal IDs for ACL matching (user ID, email, and roles)
        const userPrincipalIds = user ? [
            user.sub,
            user.email,
            ...(user.roles || []),
        ].filter(Boolean) : [userId];
        // Get vault IDs the user has ACL access to (vault-level or folder-level)
        const aclAccessibleVaultIds = new Set();
        if (!isAdmin && userPrincipalIds.length > 0) {
            // Check vault-level ACLs first - direct vault access
            const vaultAclConditions = userPrincipalIds.map(id => eq(vaultAcls.principalId, id));
            const vaultAcls_list = await db
                .select({ resourceId: vaultAcls.resourceId })
                .from(vaultAcls)
                .where(and(eq(vaultAcls.resourceType, 'vault'), or(...vaultAclConditions)));
            for (const acl of vaultAcls_list) {
                aclAccessibleVaultIds.add(acl.resourceId);
            }
            // Check folder-level ACLs and find their vault IDs
            const folderAclConditions = userPrincipalIds.map(id => eq(vaultAcls.principalId, id));
            const folderAcls = await db
                .select({ resourceId: vaultAcls.resourceId })
                .from(vaultAcls)
                .where(and(eq(vaultAcls.resourceType, 'folder'), or(...folderAclConditions)));
            if (folderAcls.length > 0) {
                const folderIds = folderAcls.map((acl) => acl.resourceId);
                const foldersWithVaults = await db
                    .select({ vaultId: vaultFolders.vaultId })
                    .from(vaultFolders)
                    .where(inArray(vaultFolders.id, folderIds));
                for (const folder of foldersWithVaults) {
                    aclAccessibleVaultIds.add(folder.vaultId);
                }
            }
        }
        // Build access conditions:
        // - Personal vault owners see their own personal vault
        // - Admins see ALL shared vaults automatically
        // - Non-admins see shared vaults ONLY if they have ACL access (vault-level or folder-level)
        const accessConditions = [
            // Personal vault ownership - only show personal vaults the user owns
            and(eq(vaultVaults.ownerUserId, userId), eq(vaultVaults.type, 'personal'))
        ];
        if (isAdmin) {
            // Admins see all shared vaults
            accessConditions.push(eq(vaultVaults.type, 'shared'));
        }
        else if (aclAccessibleVaultIds.size > 0) {
            // Non-admins see only vaults they have ACL access to
            accessConditions.push(inArray(vaultVaults.id, Array.from(aclAccessibleVaultIds)));
        }
        // Build where conditions
        const conditions = [
            accessConditions.length > 1 ? or(...accessConditions) : accessConditions[0]
        ];
        if (search) {
            conditions.push(like(vaultVaults.name, `%${search}%`));
        }
        if (type) {
            conditions.push(eq(vaultVaults.type, type));
        }
        // Apply sorting - map sortBy to actual column
        const sortColumns = {
            id: vaultVaults.id,
            name: vaultVaults.name,
            type: vaultVaults.type,
            createdAt: vaultVaults.createdAt,
            updatedAt: vaultVaults.updatedAt,
        };
        const orderCol = sortColumns[sortBy] ?? vaultVaults.createdAt;
        const orderDirection = sortOrder === 'asc' ? asc(orderCol) : desc(orderCol);
        // Build where clause
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        // Get total count for pagination (with filters)
        const countQuery = db.select({ count: sql `count(*)` }).from(vaultVaults);
        const countResult = whereClause
            ? await countQuery.where(whereClause)
            : await countQuery;
        const total = Number(countResult[0]?.count || 0);
        // Execute main query
        const baseQuery = db.select().from(vaultVaults);
        const items = whereClause
            ? await baseQuery.where(whereClause).orderBy(orderDirection).limit(pageSize).offset(offset)
            : await baseQuery.orderBy(orderDirection).limit(pageSize).offset(offset);
        return NextResponse.json({
            items,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    }
    catch (error) {
        console.error('[vault] List error:', error);
        return NextResponse.json({ error: 'Failed to fetch vaults' }, { status: 500 });
    }
}
/**
 * POST /api/vault/vaults
 * Create a new vault (personal or shared)
 * Only admins can create shared vaults
 */
export async function POST(request) {
    try {
        const db = getDb();
        const body = await request.json();
        // Validate required fields
        if (!body.name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        // Get user ID for per-user scope
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Get full user info for role checking
        const user = extractUserFromRequest(request);
        const isAdmin = user?.roles?.includes('admin') || false;
        // Only admins can create shared vaults
        const requestedType = body.type || 'personal';
        if (requestedType === 'shared' && !isAdmin) {
            return NextResponse.json({ error: 'Only administrators can create shared vaults' }, { status: 403 });
        }
        const result = await db.insert(vaultVaults).values({
            name: body.name,
            type: requestedType,
            ownerUserId: userId,
            ownerOrgId: body.ownerOrgId || null,
            tenantId: body.tenantId || null,
            encryptionKeyVersion: body.encryptionKeyVersion || 1,
        }).returning();
        return NextResponse.json(result[0], { status: 201 });
    }
    catch (error) {
        console.error('[vault] Create error:', error);
        return NextResponse.json({ error: 'Failed to create vault' }, { status: 500 });
    }
}
