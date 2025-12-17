// src/server/api/search.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults, vaultFolders, vaultAcls } from '@/lib/feature-pack-schemas';
import { eq, like, or, and, inArray } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { getDescendantFolderIds } from '../lib/acl-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/vault/search
 * Search items by metadata (access-controlled via ACLs)
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!query) {
      return NextResponse.json({ items: [] });
    }

    const isAdmin = user.roles?.includes('admin') || false;

    // Get PERSONAL vaults the user owns (personal vaults only)
    const userPersonalVaults = await db
      .select({ id: vaultVaults.id })
      .from(vaultVaults)
      .where(and(
        eq(vaultVaults.ownerUserId, userId),
        eq(vaultVaults.type, 'personal')
      ));

    const accessibleVaultIds = new Set<string>(userPersonalVaults.map((v: { id: string }) => v.id));
    const accessibleFolderIds = new Set<string>();

    // Build principal IDs for ACL matching (user ID, email, roles, and GROUP IDs)
    const { getUserPrincipals } = await import('../lib/acl-utils');
    const principals = await getUserPrincipals(db, user);
    const userPrincipalIds = [
      principals.userId,
      principals.userEmail,
      ...principals.roles,
      ...principals.groupIds, // Include group IDs for group-based ACLs
    ].filter(Boolean) as string[];

    if (isAdmin) {
      // Admins get access to all items in shared vaults
      const sharedVaults = await db
        .select({ id: vaultVaults.id })
        .from(vaultVaults)
        .where(eq(vaultVaults.type, 'shared'));

      for (const vault of sharedVaults) {
        accessibleVaultIds.add(vault.id);
      }
    } else if (userPrincipalIds.length > 0) {
      // Check vault-level ACLs
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

      // Check folder-level ACLs
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

      const directAccessFolderIds = new Set<string>();
      for (const acl of folderAcls) {
        directAccessFolderIds.add(acl.resourceId);
      }

      const allAccessibleFolderIds = await getDescendantFolderIds(db, directAccessFolderIds);
      for (const folderId of allAccessibleFolderIds) {
        accessibleFolderIds.add(folderId);
      }
    }

    if (accessibleVaultIds.size === 0 && accessibleFolderIds.size === 0) {
      return NextResponse.json({ items: [] });
    }

    // Build access conditions
    const accessConditions: ReturnType<typeof eq>[] = [];
    if (accessibleVaultIds.size > 0 && accessibleFolderIds.size > 0) {
      accessConditions.push(
        or(
          inArray(vaultItems.vaultId, Array.from(accessibleVaultIds)),
          inArray(vaultItems.folderId, Array.from(accessibleFolderIds))
        )!
      );
    } else if (accessibleVaultIds.size > 0) {
      accessConditions.push(inArray(vaultItems.vaultId, Array.from(accessibleVaultIds)));
    } else if (accessibleFolderIds.size > 0) {
      accessConditions.push(inArray(vaultItems.folderId, Array.from(accessibleFolderIds)));
    }

    // Search items with access control
    const items = await db
      .select({
        id: vaultItems.id,
        vaultId: vaultItems.vaultId,
        folderId: vaultItems.folderId,
        title: vaultItems.title,
        type: vaultItems.type,
        username: vaultItems.username,
        url: vaultItems.url,
        createdAt: vaultItems.createdAt,
        updatedAt: vaultItems.updatedAt,
      })
      .from(vaultItems)
      .where(and(
        ...accessConditions,
        or(
          like(vaultItems.title, `%${query}%`),
          like(vaultItems.username, `%${query}%`),
          like(vaultItems.url, `%${query}%`)
        )
      ))
      .limit(50);

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[vault] Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search items' },
      { status: 500 }
    );
  }
}
