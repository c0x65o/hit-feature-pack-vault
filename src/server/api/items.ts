// src/server/api/items.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults, vaultAcls } from '@/lib/feature-pack-schemas';
import { eq, desc, asc, like, sql, and, or, inArray, type AnyColumn } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { getDescendantFolderIds } from '../lib/acl-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/vault/items
 * List items for vaults the current user owns
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
    const offset = (page - 1) * pageSize;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const search = searchParams.get('search') || '';
    const vaultId = searchParams.get('vaultId') || null;
    const folderId = searchParams.get('folderId') || null;

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get full user info for role checking
    const user = extractUserFromRequest(request);
    const isAdmin = user?.roles?.includes('admin') || false;

    // Get vaults the user owns
    const userVaults = await db
      .select({ id: vaultVaults.id })
      .from(vaultVaults)
      .where(eq(vaultVaults.ownerUserId, userId));
    
    const userVaultIds = userVaults.map((v: { id: string }) => v.id);
    
    // Build principal IDs for ACL matching
    const userPrincipalIds = user ? [
      user.sub,
      user.email,
      ...(user.roles || []),
    ].filter(Boolean) as string[] : [userId];
    
    // Build accessible vault IDs (for owners/admins) and folder IDs (for ACL users)
    // Vault owners and admins see all items in their vaults
    // Non-admin users see items in folders they have explicit folder-level ACL on OR vault-level ACL on
    const accessibleVaultIds = new Set<string>(userVaultIds);
    const accessibleFolderIds = new Set<string>();
    
    if (isAdmin) {
      // Admins get access to ALL items in shared vaults - they see everything
      const sharedVaults = await db
        .select({ id: vaultVaults.id })
        .from(vaultVaults)
        .where(eq(vaultVaults.type, 'shared'));
      
      for (const vault of sharedVaults) {
        accessibleVaultIds.add(vault.id);
      }
      // Admins don't need folder-level ACLs - they have vault-level access to all shared vaults
      // So we skip the folder ACL check for admins
    } else if (userPrincipalIds.length > 0) {
      // Check vault-level ACLs - users with vault ACL see all items in that vault
      const vaultAclConditions = userPrincipalIds.map(id => eq(vaultAcls.principalId, id));
      const vaultAclsList = await db
        .select({ resourceId: vaultAcls.resourceId })
        .from(vaultAcls)
        .where(
          and(
            eq(vaultAcls.resourceType, 'vault'),
            or(...vaultAclConditions)
          )
        );
      
      for (const acl of vaultAclsList) {
        accessibleVaultIds.add(acl.resourceId);
      }
      
      // Check folder-level ACLs - users with folder ACL see items in that folder AND all descendant folders
      const folderAclConditions = userPrincipalIds.map(id => eq(vaultAcls.principalId, id));
      const folderAcls = await db
        .select({ resourceId: vaultAcls.resourceId })
        .from(vaultAcls)
        .where(
          and(
            eq(vaultAcls.resourceType, 'folder'),
            or(...folderAclConditions)
          )
        );
      
      // Get the folder IDs the user has direct access to
      const directAccessFolderIds = new Set<string>();
      for (const acl of folderAcls) {
        directAccessFolderIds.add(acl.resourceId);
      }
      
      // Get all descendant folders (children, grandchildren, etc.) of folders the user has access to
      const allAccessibleFolderIds = await getDescendantFolderIds(db, directAccessFolderIds);
      
      // Add all accessible folders (direct + descendants) to the set
      for (const folderId of allAccessibleFolderIds) {
        accessibleFolderIds.add(folderId);
      }
    }
    
    if (accessibleVaultIds.size === 0 && accessibleFolderIds.size === 0) {
      return NextResponse.json({
        items: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
      });
    }

    // Build conditions:
    // - Owners/admins: see all items in their accessible vaults
    // - Non-admin users: see items in folders with explicit folder-level ACL OR vault-level ACL
    const accessConditions: ReturnType<typeof eq>[] = [];
    
    if (accessibleVaultIds.size > 0) {
      accessConditions.push(inArray(vaultItems.vaultId, Array.from(accessibleVaultIds)));
    }
    if (accessibleFolderIds.size > 0) {
      // Use inArray for folderId matching - this will match items in the accessible folders
      // Note: items with folderId = null (root items) won't match this condition
      accessConditions.push(inArray(vaultItems.folderId, Array.from(accessibleFolderIds)));
    }
    
    // Build the where clause - if we have both vault and folder access, use OR
    // If only one, use that condition directly
    const conditions: ReturnType<typeof eq>[] = [];
    if (accessConditions.length > 0) {
      if (accessConditions.length > 1) {
        conditions.push(or(...accessConditions)!);
      } else {
        conditions.push(accessConditions[0]);
      }
    }
    
    if (vaultId) {
      conditions.push(eq(vaultItems.vaultId, vaultId));
    }
    if (folderId) {
      // When filtering by folderId:
      // - Admins: ignore folderId filter - they see ALL items in the vault (already filtered by vaultId above)
      // - Non-admins: include items in that folder AND all descendant folders
      if (!isAdmin) {
        // Non-admins: filter to folder and descendants
        const descendantFolderIds = await getDescendantFolderIds(db, new Set([folderId]));
        const folderIdsToInclude = Array.from(descendantFolderIds);
        if (folderIdsToInclude.length > 0) {
          conditions.push(inArray(vaultItems.folderId, folderIdsToInclude));
        } else {
          // Fallback to just the folder itself if no descendants
          conditions.push(eq(vaultItems.folderId, folderId));
        }
      }
      // Admins: don't add folderId filter - they see all items in the vault
    }
    if (search) {
      conditions.push(like(vaultItems.title, `%${search}%`));
    }

    const sortColumns: Record<string, AnyColumn> = {
      id: vaultItems.id,
      title: vaultItems.title,
      username: vaultItems.username,
      url: vaultItems.url,
      createdAt: vaultItems.createdAt,
      updatedAt: vaultItems.updatedAt,
    };
    const orderCol = sortColumns[sortBy] ?? vaultItems.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderCol) : desc(orderCol);

    const whereClause = and(...conditions);

    const countQuery = db.select({ count: sql<number>`count(*)` }).from(vaultItems);
    const countResult = await countQuery.where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // Select only non-sensitive fields (exclude secretBlobEncrypted)
    // We temporarily select secretBlobEncrypted server-side to derive flags like hasTotp,
    // but we never return the encrypted blob to the client.
    const items = await db
      .select({
        id: vaultItems.id,
        vaultId: vaultItems.vaultId,
        folderId: vaultItems.folderId,
        type: vaultItems.type,
        title: vaultItems.title,
        username: vaultItems.username,
        url: vaultItems.url,
        tags: vaultItems.tags,
        createdBy: vaultItems.createdBy,
        updatedBy: vaultItems.updatedBy,
        createdAt: vaultItems.createdAt,
        updatedAt: vaultItems.updatedAt,
        secretBlobEncrypted: vaultItems.secretBlobEncrypted,
      })
      .from(vaultItems)
      .where(whereClause)
      .orderBy(orderDirection)
      .limit(pageSize)
      .offset(offset);

    const { decrypt } = await import('../utils/encryption');
    const safeItems = items.map((item: any) => {
      let hasTotp = false;
      try {
        const secretBlob = JSON.parse(decrypt(item.secretBlobEncrypted));
        hasTotp = !!secretBlob?.totpSecret;
      } catch {
        // ignore parse/decrypt errors; treat as no TOTP
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { secretBlobEncrypted, ...safeItem } = item;
      return { ...safeItem, hasTotp };
    });

    return NextResponse.json({
      items: safeItems,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[vault] List items error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault/items
 * Create a new item in a vault
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }
    if (!body.vaultId) {
      return NextResponse.json(
        { error: 'Vault ID is required' },
        { status: 400 }
      );
    }
    if ((body.type ?? 'credential') === 'credential' && !String(body.url ?? '').trim()) {
      return NextResponse.json(
        { error: 'URL is required for Login items' },
        { status: 400 }
      );
    }

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get full user info for ACL checking
    const user = extractUserFromRequest(request);
    const isAdmin = user?.roles?.includes('admin') || false;

    // Verify user owns the vault or has ACL access
    const [vault] = await db
      .select()
      .from(vaultVaults)
      .where(eq(vaultVaults.id, body.vaultId))
      .limit(1);

    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }

    // Check if user owns the vault
    const isOwner = vault.ownerUserId === userId;
    
    // Check if user has ACL access (for shared vaults)
    let hasAclAccess = false;
    if (!isOwner && user) {
      // If folderId is provided, check folder access; otherwise check vault access
      if (body.folderId) {
        const { checkFolderAccess } = await import('../lib/acl-utils');
        const accessCheck = await checkFolderAccess(db, body.folderId, user, { 
          requiredPermissions: ['READ_WRITE'] 
        });
        hasAclAccess = accessCheck.hasAccess;
      } else {
        // For root-level items, check vault-level ACL
        const { checkVaultAccess } = await import('../lib/acl-utils');
        const accessCheck = await checkVaultAccess(db, body.vaultId, user, ['READ_WRITE']);
        hasAclAccess = accessCheck.hasAccess;
      }
    }

    // Admins have access to shared vaults
    const isAdminWithSharedAccess = isAdmin && vault.type === 'shared';

    if (!isOwner && !hasAclAccess && !isAdminWithSharedAccess) {
      return NextResponse.json({ error: 'Forbidden: You do not have access to create items in this vault' }, { status: 403 });
    }

    // Encrypt the secret blob
    const { encrypt } = await import('../utils/encryption');
    const secretData: any = {};
    
    // Add type-specific secret fields
    if (body.type === 'api_key') {
      // For API keys, store the secret in the password field
      secretData.password = body.secret || body.password || '';
      secretData.notes = body.notes || '';
    } else if (body.type === 'secure_note') {
      // For secure notes, store content in notes field
      secretData.notes = body.notes || '';
    } else {
      // For credentials, store password and notes normally
      secretData.password = body.password || '';
      secretData.notes = body.notes || '';
    }
    
    // Encrypt the secret blob
    const secretBlobEncrypted = encrypt(JSON.stringify(secretData));

    const result = await db.insert(vaultItems).values({
      vaultId: body.vaultId,
      folderId: body.folderId || null,
      type: body.type || 'credential',
      title: body.title as string,
      username: body.username || null,
      url: body.url || null,
      tags: body.tags || [],
      secretBlobEncrypted,
      secretVersion: 1,
      createdBy: userId,
    }).returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('[vault] Create item error:', error);
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    );
  }
}

