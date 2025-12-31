// src/server/api/sms-global.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSettings } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { encrypt, decrypt } from '../utils/encryption';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GLOBAL_PHONE_SETTING_KEY = 'global_2fa_phone';

/**
 * GET /api/vault/sms/global
 * Get the global 2FA phone number (any authenticated user)
 */
export async function GET(request: NextRequest) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const [setting] = await db
      .select()
      .from(vaultSettings)
      .where(eq(vaultSettings.key, GLOBAL_PHONE_SETTING_KEY))
      .limit(1);

    let phoneNumber: string | null = null;
    if (setting) {
      try {
        phoneNumber = decrypt(setting.valueEncrypted);
      } catch (err) {
        console.error('[vault] Failed to decrypt global phone setting:', err);
      }
    }

    return NextResponse.json({ phoneNumber });
  } catch (error) {
    console.error('[vault] Get global phone error:', error);
    return NextResponse.json(
      { error: 'Failed to get global phone number' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault/sms/global
 * Set the global 2FA phone number (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = user.roles?.includes('admin') || false;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { phoneNumber } = body || {};

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
    }

    // E.164 validation
    if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
      return NextResponse.json({ error: 'Phone number must be in E.164 format (e.g., +1234567890)' }, { status: 400 });
    }

    const db = getDb();
    const encryptedPhone = encrypt(phoneNumber);

    const [existing] = await db
      .select()
      .from(vaultSettings)
      .where(eq(vaultSettings.key, GLOBAL_PHONE_SETTING_KEY))
      .limit(1);

    if (existing) {
      await db
        .update(vaultSettings)
        .set({
          valueEncrypted: encryptedPhone,
          updatedAt: new Date(),
        })
        .where(eq(vaultSettings.key, GLOBAL_PHONE_SETTING_KEY));
    } else {
      await db.insert(vaultSettings).values({
        key: GLOBAL_PHONE_SETTING_KEY,
        valueEncrypted: encryptedPhone,
      });
    }

    console.log('[vault] Updated global 2FA phone number');
    return NextResponse.json({ phoneNumber });
  } catch (error) {
    console.error('[vault] Set global phone error:', error);
    return NextResponse.json(
      { error: 'Failed to set global phone number' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vault/sms/global
 * Delete the global 2FA phone number (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = user.roles?.includes('admin') || false;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const db = getDb();
    await db.delete(vaultSettings).where(eq(vaultSettings.key, GLOBAL_PHONE_SETTING_KEY));

    console.log('[vault] Deleted global 2FA phone number');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[vault] Delete global phone error:', error);
    return NextResponse.json(
      { error: 'Failed to delete global phone number' },
      { status: 500 }
    );
  }
}

