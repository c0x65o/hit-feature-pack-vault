// src/server/api/acl.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultAcls } from '@/lib/feature-pack-schemas';
import { desc } from 'drizzle-orm';
import { getUserId } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/vault/acl
 * List ACLs
 */
export async function GET(request) {
    try {
        const db = getDb();
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // TODO: Implement ACL listing with proper access control
        const items = await db
            .select()
            .from(vaultAcls)
            .orderBy(desc(vaultAcls.createdAt));
        return NextResponse.json({ items });
    }
    catch (error) {
        console.error('[vault] List ACL error:', error);
        return NextResponse.json({ error: 'Failed to fetch ACLs' }, { status: 500 });
    }
}
/**
 * POST /api/vault/acl
 * Create ACL entry
 */
export async function POST(request) {
    try {
        const db = getDb();
        const body = await request.json();
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // TODO: Implement ACL creation with validation
        const result = await db.insert(vaultAcls).values({
            ...body,
            createdBy: userId,
        }).returning();
        return NextResponse.json(result[0], { status: 201 });
    }
    catch (error) {
        console.error('[vault] Create ACL error:', error);
        return NextResponse.json({ error: 'Failed to create ACL' }, { status: 500 });
    }
}
