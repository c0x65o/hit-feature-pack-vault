// src/server/api/items.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, desc, asc, like, sql, and, inArray } from 'drizzle-orm';
import { getUserId } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/vault/items
 * List items for vaults the current user owns
 */
export async function GET(request) {
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
        // Get vaults the user owns
        const userVaults = await db
            .select({ id: vaultVaults.id })
            .from(vaultVaults)
            .where(eq(vaultVaults.ownerUserId, userId));
        const userVaultIds = userVaults.map((v) => v.id);
        if (userVaultIds.length === 0) {
            return NextResponse.json({
                items: [],
                pagination: { page, pageSize, total: 0, totalPages: 0 },
            });
        }
        // Build conditions - items must be in user's vaults
        const conditions = [inArray(vaultItems.vaultId, userVaultIds)];
        if (vaultId) {
            conditions.push(eq(vaultItems.vaultId, vaultId));
        }
        if (folderId) {
            conditions.push(eq(vaultItems.folderId, folderId));
        }
        if (search) {
            conditions.push(like(vaultItems.title, `%${search}%`));
        }
        const sortColumns = {
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
        const countQuery = db.select({ count: sql `count(*)` }).from(vaultItems);
        const countResult = await countQuery.where(whereClause);
        const total = Number(countResult[0]?.count || 0);
        // Select only non-sensitive fields (exclude secretBlobEncrypted)
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
        })
            .from(vaultItems)
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
    }
    catch (error) {
        console.error('[vault] List items error:', error);
        return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }
}
/**
 * POST /api/vault/items
 * Create a new item in a vault
 */
export async function POST(request) {
    try {
        const db = getDb();
        const body = await request.json();
        if (!body.title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }
        if (!body.vaultId) {
            return NextResponse.json({ error: 'Vault ID is required' }, { status: 400 });
        }
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Verify user owns the vault
        const vault = await db
            .select()
            .from(vaultVaults)
            .where(and(eq(vaultVaults.id, body.vaultId), eq(vaultVaults.ownerUserId, userId)))
            .limit(1);
        if (!vault[0]) {
            return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
        }
        // Encrypt the secret blob (placeholder - actual encryption should use KMS)
        const secretData = {
            password: body.password || '',
            notes: body.notes || '',
        };
        const secretBlobEncrypted = Buffer.from(JSON.stringify(secretData)).toString('base64');
        const result = await db.insert(vaultItems).values({
            vaultId: body.vaultId,
            folderId: body.folderId || null,
            type: body.type || 'credential',
            title: body.title,
            username: body.username || null,
            url: body.url || null,
            tags: body.tags || [],
            secretBlobEncrypted,
            secretVersion: 1,
            createdBy: userId,
        }).returning({
            id: vaultItems.id,
            vaultId: vaultItems.vaultId,
            folderId: vaultItems.folderId,
            type: vaultItems.type,
            title: vaultItems.title,
            username: vaultItems.username,
            url: vaultItems.url,
            tags: vaultItems.tags,
            createdBy: vaultItems.createdBy,
            createdAt: vaultItems.createdAt,
        });
        return NextResponse.json(result[0], { status: 201 });
    }
    catch (error) {
        console.error('[vault] Create item error:', error);
        return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
    }
}
