// src/server/api/sms-numbers.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsNumbers, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, desc, inArray } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/vault/sms/numbers
 * List SMS numbers (for vaults user owns)
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get vaults owned by user
    const userVaults = await db
      .select({ id: vaultVaults.id })
      .from(vaultVaults)
      .where(eq(vaultVaults.ownerUserId, userId));

    const vaultIds = userVaults.map((v: { id: string }) => v.id);

    if (vaultIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Get SMS numbers for user's vaults
    const items = await db
      .select()
      .from(vaultSmsNumbers)
      .where(inArray(vaultSmsNumbers.vaultId, vaultIds))
      .orderBy(desc(vaultSmsNumbers.createdAt));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[vault] List SMS numbers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SMS numbers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault/sms/numbers
 * Provision SMS number for a vault
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const vaultId = body.vaultId;

    if (!vaultId) {
      return NextResponse.json({ error: 'vaultId is required' }, { status: 400 });
    }

    // Verify user owns the vault
    const [vault] = await db
      .select()
      .from(vaultVaults)
      .where(eq(vaultVaults.id, vaultId))
      .limit(1);

    if (!vault || vault.ownerUserId !== userId) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 });
    }

    // SMS number provisioning
    // Supported providers: 'twilio', 'fdroid', 'custom'
    // For F-Droid: manually add phone number and set provider to 'fdroid'
    // For Twilio: phone number would come from Twilio API (not implemented here)
    const result = await db.insert(vaultSmsNumbers).values({
      vaultId: vaultId,
      itemId: body.itemId || null,
      phoneNumber: body.phoneNumber || '[provisioned number]', // Required for F-Droid/custom
      provider: body.provider || 'fdroid', // Default to 'fdroid' for custom Android phone setup
      status: body.status || 'active', // Default to 'active' for F-Droid
    }).returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('[vault] Provision SMS number error:', error);
    return NextResponse.json(
      { error: 'Failed to provision SMS number' },
      { status: 500 }
    );
  }
}
