// src/server/api/groups.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultStaticGroups } from '@/lib/feature-pack-schemas';
import { desc } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/vault/groups
 * List groups (static groups only)
 */
export async function GET(request) {
    try {
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Check admin role for static groups
        if (!user.roles?.includes('admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const db = getDb();
        const items = await db
            .select()
            .from(vaultStaticGroups)
            .orderBy(desc(vaultStaticGroups.createdAt));
        return NextResponse.json({ items });
    }
    catch (error) {
        console.error('[vault] List groups error:', error);
        return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
    }
}
/**
 * POST /api/vault/groups
 * Create group (static groups only)
 */
export async function POST(request) {
    try {
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!user.roles?.includes('admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const db = getDb();
        const body = await request.json();
        if (!body.name) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }
        const result = await db.insert(vaultStaticGroups).values({
            name: body.name,
            description: body.description || null,
        }).returning();
        return NextResponse.json(result[0], { status: 201 });
    }
    catch (error) {
        console.error('[vault] Create group error:', error);
        return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
    }
}
