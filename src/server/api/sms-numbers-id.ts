// src/server/api/sms-numbers-id.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsNumbers, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, and } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return parts[parts.length - 1] || null;
}

/**
 * GET /api/vault/sms/numbers/[id]
 */
export async function GET(request: NextRequest) {
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

    // Get SMS number
    const [smsNumber] = await db
      .select()
      .from(vaultSmsNumbers)
      .where(eq(vaultSmsNumbers.id, id))
      .limit(1);

    if (!smsNumber) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify user owns the vault the SMS number belongs to
    if (smsNumber.vaultId) {
      const [vault] = await db
        .select()
        .from(vaultVaults)
        .where(and(
          eq(vaultVaults.id, smsNumber.vaultId),
          eq(vaultVaults.ownerUserId, userId)
        ))
        .limit(1);

      if (!vault) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    return NextResponse.json(smsNumber);
  } catch (error) {
    console.error('[vault] Get SMS number error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SMS number' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vault/sms/numbers/[id]
 */
export async function DELETE(request: NextRequest) {
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

    // Get SMS number
    const [smsNumber] = await db
      .select()
      .from(vaultSmsNumbers)
      .where(eq(vaultSmsNumbers.id, id))
      .limit(1);

    if (!smsNumber) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify user owns the vault the SMS number belongs to
    if (smsNumber.vaultId) {
      const [vault] = await db
        .select()
        .from(vaultVaults)
        .where(and(
          eq(vaultVaults.id, smsNumber.vaultId),
          eq(vaultVaults.ownerUserId, userId)
        ))
        .limit(1);

      if (!vault) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    await db
      .delete(vaultSmsNumbers)
      .where(eq(vaultSmsNumbers.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[vault] Delete SMS number error:', error);
    return NextResponse.json(
      { error: 'Failed to delete SMS number' },
      { status: 500 }
    );
  }
}
