// src/server/api/acl-recompute.ts
import { NextResponse } from 'next/server';
import { getUserId } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * POST /api/vault/acl/recompute
 * Recompute effective ACLs for a resource
 */
export async function POST(request) {
    try {
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const body = await request.json();
        const resourceId = body.resourceId;
        const resourceType = body.resourceType;
        if (!resourceId || !resourceType) {
            return NextResponse.json({ error: 'resourceId and resourceType are required' }, { status: 400 });
        }
        // TODO: Implement ACL recomputation logic
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('[vault] Recompute ACL error:', error);
        return NextResponse.json({ error: 'Failed to recompute ACLs' }, { status: 500 });
    }
}
