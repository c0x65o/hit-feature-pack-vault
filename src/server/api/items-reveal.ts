// src/server/api/items-reveal.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults, vaultAuditEvents } from '@/lib/feature-pack-schemas';
import { eq, and } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { checkItemAccess } from '../lib/acl-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/vault/items/{id}/reveal -> id is second to last
  const idIndex = parts.indexOf('items') + 1;
  return parts[idIndex] || null;
}

/**
 * POST /api/vault/items/[id]/reveal
 * Reveal decrypted password/secret (audited)
 */
export async function POST(request: NextRequest) {
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

    // Verify user owns the vault or has ACL access
    const [vault] = await db
      .select()
      .from(vaultVaults)
      .where(eq(vaultVaults.id, item.vaultId))
      .limit(1);

    if (!vault) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check if user owns a PERSONAL vault (only personal vault owners have automatic access)
    const isPersonalVaultOwner = vault.ownerUserId === userId && vault.type === 'personal';
    
    // For shared vaults, everyone (including "owners") needs ACL access
    let hasAclAccess = false;
    if (!isPersonalVaultOwner) {
      const user = extractUserFromRequest(request);
      if (user) {
        // checkItemAccess handles admin access internally
        const accessCheck = await checkItemAccess(db, id, user, { requiredPermissions: ['READ_ONLY'] });
        hasAclAccess = accessCheck.hasAccess;
      }
    }

    if (!isPersonalVaultOwner && !hasAclAccess) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Create audit event for reveal action
    await db.insert(vaultAuditEvents).values({
      actorUserId: userId,
      action: 'ITEM_REVEAL_PASSWORD',
      resourceType: 'item',
      resourceId: id,
      success: true,
    });

    // Decrypt the secret blob
    try {
      const { decrypt } = await import('../utils/encryption');
      
      // Validate that secretBlobEncrypted exists and is not empty
      if (!item.secretBlobEncrypted || !item.secretBlobEncrypted.trim()) {
        console.error('[vault] Item has empty secretBlobEncrypted:', item.id);
        return NextResponse.json(
          { error: 'Item secret data is missing or corrupted' },
          { status: 500 }
        );
      }
      
      // Check if it's in the expected encrypted format (iv:authTag:encrypted)
      const parts = item.secretBlobEncrypted.split(':');
      if (parts.length !== 3) {
        console.error('[vault] Item secretBlobEncrypted is not in encrypted format (expected iv:authTag:encrypted):', item.id, 'Format:', parts.length, 'parts');
        return NextResponse.json(
          { error: 'Item secret data is in an invalid format. This may be due to a migration issue.' },
          { status: 500 }
        );
      }
      
      const secretBlob = JSON.parse(decrypt(item.secretBlobEncrypted));
      
      return NextResponse.json({
        password: secretBlob.password || null,
        secret: secretBlob.secret || secretBlob.password || null, // For API keys
        notes: secretBlob.notes || null,
        totpSecret: secretBlob.totpSecret || null,
        twoFactorType: secretBlob.twoFactorType || null,
        // Don't expose recovery codes or other sensitive data
      });
    } catch (error) {
      console.error('[vault] Decryption error for item:', item.id, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to decrypt item: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[vault] Reveal item error:', error);
    return NextResponse.json(
      { error: 'Failed to reveal item' },
      { status: 500 }
    );
  }
}
