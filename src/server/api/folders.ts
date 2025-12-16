// src/server/api/folders.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultFolders, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, desc, asc, like, sql, and, inArray, type AnyColumn } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/vault/folders
 * List folders for vaults the current user owns
 */
export async function GET(request: NextRequest) {
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

    // Search and filters
    const search = searchParams.get('search') || '';
    const vaultId = searchParams.get('vaultId') || null;
    const parentId = searchParams.get('parentId') || null;

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get vaults the user owns
    const userVaults = await db
      .select({ id: vaultVaults.id })
      .from(vaultVaults)
      .where(eq(vaultVaults.ownerUserId, userId));
    
    const userVaultIds = userVaults.map((v: { id: string }) => v.id);
    
    if (userVaultIds.length === 0) {
      return NextResponse.json({
        items: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
      });
    }

    // Build where conditions - folders must be in user's vaults
    const conditions: ReturnType<typeof eq>[] = [inArray(vaultFolders.vaultId, userVaultIds)];
    
    if (vaultId) {
      conditions.push(eq(vaultFolders.vaultId, vaultId));
    }
    if (parentId) {
      conditions.push(eq(vaultFolders.parentId, parentId));
    } else if (searchParams.get('parentId') === 'null') {
      // Explicitly query for root folders
      conditions.push(sql`${vaultFolders.parentId} IS NULL`);
    }
    if (search) {
      conditions.push(like(vaultFolders.name, `%${search}%`));
    }

    // Apply sorting
    const sortColumns: Record<string, AnyColumn> = {
      id: vaultFolders.id,
      name: vaultFolders.name,
      path: vaultFolders.path,
      createdAt: vaultFolders.createdAt,
    };
    const orderCol = sortColumns[sortBy] ?? vaultFolders.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderCol) : desc(orderCol);

    const whereClause = and(...conditions);

    // Get total count
    const countQuery = db.select({ count: sql<number>`count(*)` }).from(vaultFolders);
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

    return NextResponse.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[vault] List folders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault/folders
 * Create a new folder in a vault
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    if (!body.vaultId) {
      return NextResponse.json(
        { error: 'Vault ID is required' },
        { status: 400 }
      );
    }

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns the vault
    const vault = await db
      .select()
      .from(vaultVaults)
      .where(and(
        eq(vaultVaults.id, body.vaultId),
        eq(vaultVaults.ownerUserId, userId)
      ))
      .limit(1);

    if (!vault[0]) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }

    // Build materialized path
    let path = '/';
    if (body.parentId) {
      const parent = await db
        .select()
        .from(vaultFolders)
        .where(eq(vaultFolders.id, body.parentId))
        .limit(1);
      
      if (parent[0]) {
        path = `${parent[0].path}${body.name}/`;
      }
    } else {
      path = `/${body.name}/`;
    }

    const result = await db.insert(vaultFolders).values({
      vaultId: body.vaultId,
      parentId: body.parentId || null,
      name: body.name as string,
      path,
      createdBy: userId,
    }).returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('[vault] Create folder error:', error);
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}

