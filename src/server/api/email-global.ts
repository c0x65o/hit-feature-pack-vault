// src/server/api/email-global.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSettings } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { encrypt, decrypt } from '../utils/encryption';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GLOBAL_EMAIL_SETTING_KEY = 'global_2fa_email';

/**
 * GET /api/vault/email/global
 * Get the global 2FA email address (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = user.roles?.includes('admin') || false;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const db = getDb();

    const [setting] = await db
      .select()
      .from(vaultSettings)
      .where(eq(vaultSettings.key, GLOBAL_EMAIL_SETTING_KEY))
      .limit(1);

    let emailAddress: string | null = null;

    if (setting) {
      try {
        emailAddress = decrypt(setting.valueEncrypted);
      } catch (err) {
        console.error('[vault] Failed to decrypt global email setting:', err);
      }
    }

    return NextResponse.json({ emailAddress });
  } catch (error) {
    console.error('[vault] Get global email error:', error);
    return NextResponse.json(
      { error: 'Failed to get global email address' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault/email/global
 * Set the global 2FA email address (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = user.roles?.includes('admin') || false;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { emailAddress } = body;

    if (!emailAddress || typeof emailAddress !== 'string') {
      return NextResponse.json({ error: 'emailAddress is required' }, { status: 400 });
    }

    // Basic email validation
    if (!emailAddress.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const db = getDb();

    // Encrypt the email address
    const encryptedEmail = encrypt(emailAddress);

    // Check if setting already exists
    const [existing] = await db
      .select()
      .from(vaultSettings)
      .where(eq(vaultSettings.key, GLOBAL_EMAIL_SETTING_KEY))
      .limit(1);

    if (existing) {
      // Update existing setting
      await db
        .update(vaultSettings)
        .set({
          valueEncrypted: encryptedEmail,
          updatedAt: new Date(),
        })
        .where(eq(vaultSettings.key, GLOBAL_EMAIL_SETTING_KEY));
    } else {
      // Create new setting
      await db.insert(vaultSettings).values({
        key: GLOBAL_EMAIL_SETTING_KEY,
        valueEncrypted: encryptedEmail,
      });
    }

    console.log('[vault] Updated global 2FA email address');

    return NextResponse.json({ emailAddress });
  } catch (error) {
    console.error('[vault] Set global email error:', error);
    return NextResponse.json(
      { error: 'Failed to set global email address' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vault/email/global
 * Delete the global 2FA email address (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = user.roles?.includes('admin') || false;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const db = getDb();

    await db
      .delete(vaultSettings)
      .where(eq(vaultSettings.key, GLOBAL_EMAIL_SETTING_KEY));

    console.log('[vault] Deleted global 2FA email address');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[vault] Delete global email error:', error);
    return NextResponse.json(
      { error: 'Failed to delete global email address' },
      { status: 500 }
    );
  }
}

