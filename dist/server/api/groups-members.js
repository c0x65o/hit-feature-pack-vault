// src/server/api/groups-members.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultGroupMembers } from '@/lib/feature-pack-schemas';
import { eq, and } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/vault/groups/{id}/members -> id is second to last
    const idIndex = parts.indexOf('groups') + 1;
    return parts[idIndex] || null;
}
/**
 * GET /api/vault/groups/[id]/members
 * List group members
 */
export async function GET(request) {
    try {
        const user = extractUserFromRequest(request);
        if (!user || !user.roles?.includes('admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const db = getDb();
        const id = extractId(request);
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }
        const members = await db
            .select()
            .from(vaultGroupMembers)
            .where(eq(vaultGroupMembers.groupId, id));
        return NextResponse.json({ items: members });
    }
    catch (error) {
        console.error('[vault] List group members error:', error);
        return NextResponse.json({ error: 'Failed to fetch group members' }, { status: 500 });
    }
}
/**
 * POST /api/vault/groups/[id]/members
 * Add member to group
 */
export async function POST(request) {
    try {
        const user = extractUserFromRequest(request);
        if (!user || !user.roles?.includes('admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const db = getDb();
        const id = extractId(request);
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }
        const body = await request.json();
        const userId = body.userId;
        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }
        const result = await db.insert(vaultGroupMembers).values({
            groupId: id,
            userId: userId,
        }).returning();
        return NextResponse.json(result[0], { status: 201 });
    }
    catch (error) {
        console.error('[vault] Add group member error:', error);
        return NextResponse.json({ error: 'Failed to add group member' }, { status: 500 });
    }
}
/**
 * DELETE /api/vault/groups/[id]/members
 * Remove member from group
 */
export async function DELETE(request) {
    try {
        const user = extractUserFromRequest(request);
        if (!user || !user.roles?.includes('admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const db = getDb();
        const id = extractId(request);
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        if (!userId) {
            return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
        }
        await db
            .delete(vaultGroupMembers)
            .where(and(eq(vaultGroupMembers.groupId, id), eq(vaultGroupMembers.userId, userId)));
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('[vault] Remove group member error:', error);
        return NextResponse.json({ error: 'Failed to remove group member' }, { status: 500 });
    }
}
