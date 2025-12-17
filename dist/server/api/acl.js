// src/server/api/acl.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultAcls, vaultFolders, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, desc, and } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/vault/acl
 * List ACLs for a specific resource
 */
export async function GET(request) {
    try {
        const db = getDb();
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const resourceType = searchParams.get('resource_type');
        const resourceId = searchParams.get('resource_id');
        // Build conditions
        const conditions = [];
        if (resourceType) {
            conditions.push(eq(vaultAcls.resourceType, resourceType));
        }
        if (resourceId) {
            conditions.push(eq(vaultAcls.resourceId, resourceId));
        }
        // TODO: Add access control - verify user has SHARE permission on the resource
        const items = await db
            .select()
            .from(vaultAcls)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
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
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Validate required fields
        if (!body.resourceType || !body.resourceId || !body.principalType || !body.principalId || !body.permissions) {
            return NextResponse.json({ error: 'Missing required fields: resourceType, resourceId, principalType, principalId, permissions' }, { status: 400 });
        }
        const isAdmin = user.roles?.includes('admin') || false;
        // Only admins can manage ACLs on shared vaults/folders
        if (body.resourceType === 'folder') {
            // Get the folder to find its vault
            const [folder] = await db
                .select({ vaultId: vaultFolders.vaultId })
                .from(vaultFolders)
                .where(eq(vaultFolders.id, body.resourceId))
                .limit(1);
            if (!folder) {
                return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
            }
            // Get the vault to check type
            const [vault] = await db
                .select()
                .from(vaultVaults)
                .where(eq(vaultVaults.id, folder.vaultId))
                .limit(1);
            if (!vault) {
                return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
            }
            // For shared vaults, only admins can manage ACLs
            if (vault.type === 'shared' && !isAdmin) {
                return NextResponse.json({ error: 'Forbidden: Only administrators can manage access on shared vaults' }, { status: 403 });
            }
            // For personal vaults, only the owner can manage ACLs
            if (vault.type === 'personal' && vault.ownerUserId !== user.sub) {
                return NextResponse.json({ error: 'Forbidden: You do not have access to this vault' }, { status: 403 });
            }
        }
        else if (body.resourceType === 'vault') {
            const [vault] = await db
                .select()
                .from(vaultVaults)
                .where(eq(vaultVaults.id, body.resourceId))
                .limit(1);
            if (!vault) {
                return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
            }
            // For shared vaults, only admins can manage ACLs
            if (vault.type === 'shared' && !isAdmin) {
                return NextResponse.json({ error: 'Forbidden: Only administrators can manage access on shared vaults' }, { status: 403 });
            }
            // For personal vaults, only the owner can manage ACLs
            if (vault.type === 'personal' && vault.ownerUserId !== user.sub) {
                return NextResponse.json({ error: 'Forbidden: You do not have access to this vault' }, { status: 403 });
            }
        }
        const result = await db.insert(vaultAcls).values({
            resourceType: body.resourceType,
            resourceId: body.resourceId,
            principalType: body.principalType,
            principalId: body.principalId,
            permissions: Array.isArray(body.permissions) ? body.permissions : [],
            inherit: body.inherit !== undefined ? body.inherit : true,
            createdBy: user.sub,
        }).returning();
        return NextResponse.json(result[0], { status: 201 });
    }
    catch (error) {
        console.error('[vault] Create ACL error:', error);
        return NextResponse.json({ error: 'Failed to create ACL' }, { status: 500 });
    }
}
