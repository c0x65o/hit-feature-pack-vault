// src/server/api/vaults.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, desc, asc, like, sql, and, or, type AnyColumn } from 'drizzle-orm';
import { getUserId } from '../auth';

// Required for Next.js App Router
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/vault/vaults
 * List all vaults for the current user (personal + shared they have access to)
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

    // Search
    const search = searchParams.get('search') || '';
    
    // Filter by type
    const type = searchParams.get('type') as 'personal' | 'shared' | null;

    // Per-user scope: filter by owner user ID
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [eq(vaultVaults.ownerUserId, userId)];
    if (search) {
      conditions.push(like(vaultVaults.name, `%${search}%`));
    }
    if (type) {
      conditions.push(eq(vaultVaults.type, type));
    }

    // Apply sorting - map sortBy to actual column
    const sortColumns: Record<string, AnyColumn> = {
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
    const countQuery = db.select({ count: sql<number>`count(*)` }).from(vaultVaults);
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
  } catch (error) {
    console.error('[vault] List error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vaults' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault/vaults
 * Create a new vault (personal or shared)
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Get user ID for per-user scope
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await db.insert(vaultVaults).values({
      name: body.name as string,
      type: (body.type as 'personal' | 'shared') || 'personal',
      ownerUserId: userId,
      ownerOrgId: body.ownerOrgId || null,
      tenantId: body.tenantId || null,
      encryptionKeyVersion: body.encryptionKeyVersion || 1,
    }).returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('[vault] Create error:', error);
    return NextResponse.json(
      { error: 'Failed to create vault' },
      { status: 500 }
    );
  }
}

