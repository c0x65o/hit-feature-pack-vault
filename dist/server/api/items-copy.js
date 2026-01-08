// src/server/api/items-copy.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultAuditEvents } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { checkItemAccess } from '../lib/acl-utils';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const idIndex = parts.indexOf('items') + 1;
    return parts[idIndex] || null;
}
/**
 * POST /api/vault/items/[id]/copy
 * Copy password to clipboard (audited)
 */
export async function POST(request) {
    try {
        const db = getDb();
        const id = extractId(request);
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Get item
        const [item] = await db
            .select()
            .from(vaultItems)
            .where(eq(vaultItems.id, id))
            .limit(1);
        if (!item) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Verify user has access via ACL check
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const accessCheck = await checkItemAccess(db, id, user, { requiredPermissions: ['READ_ONLY'] });
        if (!accessCheck.hasAccess) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // TODO: Implement copy logic and audit event
        // Create audit event for copy action
        await db.insert(vaultAuditEvents).values({
            actorUserId: userId,
            action: 'ITEM_COPY_PASSWORD',
            resourceType: 'item',
            resourceId: id,
            success: true,
        });
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('[vault] Copy item error:', error);
        return NextResponse.json({ error: 'Failed to copy item' }, { status: 500 });
    }
}
