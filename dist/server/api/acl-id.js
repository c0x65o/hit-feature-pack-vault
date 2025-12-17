// src/server/api/acl-id.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultAcls } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { checkFolderAccess, checkVaultAccess } from '../lib/acl-utils';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    return parts[parts.length - 1] || null;
}
/**
 * DELETE /api/vault/acl/[id]
 * Delete ACL entry
 */
export async function DELETE(request) {
    try {
        const db = getDb();
        const id = extractId(request);
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Get ACL to verify permissions
        const [acl] = await db
            .select()
            .from(vaultAcls)
            .where(eq(vaultAcls.id, id))
            .limit(1);
        if (!acl) {
            return NextResponse.json({ error: 'ACL not found' }, { status: 404 });
        }
        // Verify user has READ_WRITE permission on the resource (required to manage ACLs)
        if (acl.resourceType === 'folder') {
            const accessCheck = await checkFolderAccess(db, acl.resourceId, user, { requiredPermissions: ['READ_WRITE'] });
            if (!accessCheck.hasAccess) {
                return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions') }, { status: 403 });
            }
        }
        else if (acl.resourceType === 'vault') {
            const accessCheck = await checkVaultAccess(db, acl.resourceId, user, ['READ_WRITE']);
            if (!accessCheck.hasAccess) {
                return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions') }, { status: 403 });
            }
        }
        await db.delete(vaultAcls).where(eq(vaultAcls.id, id));
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('[vault] Delete ACL error:', error);
        return NextResponse.json({ error: 'Failed to delete ACL' }, { status: 500 });
    }
}
