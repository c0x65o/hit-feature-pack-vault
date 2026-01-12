// src/server/api/items.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults, vaultAcls, vaultFolders } from '@/lib/feature-pack-schemas';
import { eq, desc, asc, like, sql, and, or, inArray, type AnyColumn } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { getDescendantFolderIds } from '../lib/acl-utils';
import { resolveVaultScopeMode } from '../lib/scope-mode';
import { requireVaultAction } from '../lib/require-action';

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

    // Check read permission and resolve scope mode
    const mode = await resolveVaultScopeMode(request, { entity: 'items', verb: 'read' });

    if (mode === 'none') {
      // Explicit deny: return empty results
      return NextResponse.json({
        items: [],
        pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
      });
    }

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
    
    // Get full user info
    const user = extractUserFromRequest(request);

    // Get PERSONAL vaults the user owns (personal vaults only - owner has full access)
    const userPersonalVaults = await db
      .select({ id: vaultVaults.id })
      .from(vaultVaults)
      .where(and(
        eq(vaultVaults.ownerUserId, userId),
        eq(vaultVaults.type, 'personal')
      ));
    
    const userPersonalVaultIds = userPersonalVaults.map((v: { id: string }) => v.id);
    
    // Build principal IDs for ACL matching (user ID, email, roles, and GROUP IDs)
    let userPrincipalIds: string[] = [userId];
    if (user) {
      const { getUserPrincipals } = await import('../lib/acl-utils');
      const principals = await getUserPrincipals(db, user, request);
      userPrincipalIds = [
        principals.userId,
        principals.userEmail,
        ...principals.roles,
        ...principals.groupIds, // Include group IDs for group-based ACLs
      ].filter(Boolean) as string[];
    }
    
    // Build accessible vault IDs and folder IDs based on scope mode (explicit branching on none/own/ldd/any)
    const accessibleVaultIds = new Set<string>();
    const accessibleFolderIds = new Set<string>();
    
    if (mode === 'own' || mode === 'ldd') {
      // Only show items in personal vaults owned by user
      for (const vaultId of userPersonalVaultIds) {
        accessibleVaultIds.add(vaultId);
      }
    } else if (mode === 'any') {
      // Show items in personal vaults owned by user + shared vaults with ACL access
      for (const vaultId of userPersonalVaultIds) {
        accessibleVaultIds.add(vaultId);
      }
      
      if (userPrincipalIds.length > 0) {
      // Non-admins: Check ACLs for shared vault access
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
    // CRITICAL: When checking folder-level access, also ensure item vault matches folder vault
    const accessConditions: ReturnType<typeof eq>[] = [];
    
    if (accessibleVaultIds.size > 0) {
      accessConditions.push(inArray(vaultItems.vaultId, Array.from(accessibleVaultIds)));
    }
    if (accessibleFolderIds.size > 0) {
      // For folder-level ACL: show items in accessible folders
      // CRITICAL: Items must be in the same vault as their folder (data integrity)
      // Get vault IDs for accessible folders to ensure items match folder vaults
      const foldersWithVaults = await db
        .select({ id: vaultFolders.id, vaultId: vaultFolders.vaultId })
        .from(vaultFolders)
        .where(inArray(vaultFolders.id, Array.from(accessibleFolderIds)));
      
      // Group folders by vault for efficient querying
      const foldersByVault = new Map<string, string[]>();
      for (const f of foldersWithVaults) {
        if (!foldersByVault.has(f.vaultId)) {
          foldersByVault.set(f.vaultId, []);
        }
        foldersByVault.get(f.vaultId)!.push(f.id);
      }
      
      // Build conditions: items in accessible folders AND item vault matches folder vault
      const folderConditions: ReturnType<typeof eq>[] = [];
      for (const [vaultId, folderIds] of foldersByVault.entries()) {
        folderConditions.push(
          and(
            inArray(vaultItems.folderId, folderIds),
            eq(vaultItems.vaultId, vaultId) // Ensure item vault matches folder vault
          )!
        );
      }
      
      if (folderConditions.length > 0) {
        if (folderConditions.length === 1) {
          accessConditions.push(folderConditions[0]);
        } else {
          accessConditions.push(or(...folderConditions)!);
        }
      }
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
      // Everyone (including admins): include items in that folder AND all descendant folders
      // CRITICAL: Items must be in the same vault as their folder (data integrity)
      const [folder] = await db
        .select({ vaultId: vaultFolders.vaultId })
        .from(vaultFolders)
        .where(eq(vaultFolders.id, folderId))
        .limit(1);
      
      if (folder) {
        // Filter to folder and descendants, AND ensure item vault matches folder vault
        const descendantFolderIds = await getDescendantFolderIds(db, new Set([folderId]));
        const folderIdsToInclude = Array.from(descendantFolderIds);
        if (folderIdsToInclude.length > 0) {
          conditions.push(
            and(
              inArray(vaultItems.folderId, folderIdsToInclude),
              eq(vaultItems.vaultId, folder.vaultId) // Ensure item vault matches folder vault
            )!
          );
        } else {
          // Fallback to just the folder itself if no descendants
          conditions.push(
            and(
              eq(vaultItems.folderId, folderId),
              eq(vaultItems.vaultId, folder.vaultId) // Ensure item vault matches folder vault
            )!
          );
        }
      }
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
    const { checkItemAccess } = await import('../lib/acl-utils');
    
    // Add permission flags to each item for UI conditional rendering
    const safeItemsWithPermissions = await Promise.all(
      items.map(async (item: any) => {
        let hasTotp = false;
        let twoFactorType: string | null = null;
        try {
          const secretBlob = JSON.parse(decrypt(item.secretBlobEncrypted));
          hasTotp = !!secretBlob?.totpSecret;
          twoFactorType = secretBlob?.twoFactorType || null;
        } catch {
          // ignore parse/decrypt errors; treat as no TOTP
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { secretBlobEncrypted, ...safeItem } = item;
        
        // Check permissions for this item (user should not be null at this point, but check for safety)
        const deleteCheck = user ? await checkItemAccess(db, item.id, user, { requiredPermissions: ['DELETE'] }) : { hasAccess: false };
        const writeCheck = user ? await checkItemAccess(db, item.id, user, { requiredPermissions: ['READ_WRITE'] }) : { hasAccess: false };
        const fullAccessCheck = user ? await checkItemAccess(db, item.id, user, { requiredPermissions: ['MANAGE_ACL'] }) : { hasAccess: false };
        
        return {
          ...safeItem,
          hasTotp,
          twoFactorType,
          canDelete: deleteCheck.hasAccess,
          canEdit: writeCheck.hasAccess,
          canMove: fullAccessCheck.hasAccess, // Moving requires full access (MANAGE_ACL) or admin
        };
      })
    );

    return NextResponse.json({
      items: safeItemsWithPermissions,
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

    // Check create permission
    const createCheck = await requireVaultAction(request, 'vault.items.create');
    if (createCheck) {
      return createCheck;
    }

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get full user info
    const user = extractUserFromRequest(request);
    
    // Check write permission and resolve scope mode
    const mode = await resolveVaultScopeMode(request, { entity: 'items', verb: 'write' });
    
    if (mode === 'none') {
      return NextResponse.json(
        { error: 'Forbidden: Write access denied' },
        { status: 403 }
      );
    }

    // Verify user owns the vault or has ACL access
    const [vault] = await db
      .select()
      .from(vaultVaults)
      .where(eq(vaultVaults.id, body.vaultId))
      .limit(1);

    if (!vault) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }

    // Apply scope mode filtering (explicit branching on none/own/ldd/any)
    const isPersonalVaultOwner = vault.ownerUserId === userId && vault.type === 'personal';
    
    if (mode === 'own' || mode === 'ldd') {
      // Only allow creating items in personal vaults owned by user
      if (!isPersonalVaultOwner) {
        return NextResponse.json({ error: 'Forbidden: Cannot create items in this vault with current permissions' }, { status: 403 });
      }
    } else if (mode === 'any') {
      // Allow create if user owns personal vault OR has ACL write access
      if (!isPersonalVaultOwner && user) {
        // If folderId is provided, check folder access; otherwise check vault access
        let hasAclAccess = false;
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
        
        if (!hasAclAccess) {
          return NextResponse.json({ error: 'Forbidden: You do not have access to create items in this vault' }, { status: 403 });
        }
      }
    }

    // CRITICAL: If folderId is provided, ensure the vaultId matches the folder's vault
    // Items must always be in the same vault as their folder
    if (body.folderId) {
      const [folder] = await db
        .select({ vaultId: vaultFolders.vaultId })
        .from(vaultFolders)
        .where(eq(vaultFolders.id, body.folderId))
        .limit(1);
      
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
      
      if (folder.vaultId !== body.vaultId) {
        // Auto-correct: use the folder's vault instead of the provided vault
        body.vaultId = folder.vaultId;
        
        // Re-verify access to the correct vault
        const [correctVault] = await db
          .select()
          .from(vaultVaults)
          .where(eq(vaultVaults.id, body.vaultId))
          .limit(1);
        
        if (!correctVault) {
          return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
        }
        
        // Re-check access for the correct vault (only personal vault owners get automatic access)
        const isCorrectPersonalVaultOwner = correctVault.ownerUserId === userId && correctVault.type === 'personal';
        let hasCorrectVaultAclAccess = false;
        if (!isCorrectPersonalVaultOwner && user) {
          const { checkVaultAccess } = await import('../lib/acl-utils');
          const accessCheck = await checkVaultAccess(db, body.vaultId, user, ['READ_WRITE']);
          hasCorrectVaultAclAccess = accessCheck.hasAccess;
        }
        
        if (!isCorrectPersonalVaultOwner && !hasCorrectVaultAclAccess) {
          return NextResponse.json({ error: 'Forbidden: No access to folder vault' }, { status: 403 });
        }
      }
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
      // Store 2FA type preference if provided
      if (body.twoFactorType !== undefined) {
        secretData.twoFactorType = body.twoFactorType;
      }
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

