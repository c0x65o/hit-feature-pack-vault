// src/server/api/webhook-api-key.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSettings } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getUserId } from '../auth';
import { encrypt, decrypt } from '../utils/encryption';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WEBHOOK_API_KEY_SETTING_KEY = 'webhook_api_key';

/**
 * GET /api/vault/webhook/api-key
 * Get the current webhook API key (decrypted)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();

    // Try to get from database first
    const [setting] = await db
      .select()
      .from(vaultSettings)
      .where(eq(vaultSettings.key, WEBHOOK_API_KEY_SETTING_KEY))
      .limit(1);

    let apiKey: string | null = null;

    if (setting) {
      // Decrypt the stored key
      apiKey = decrypt(setting.valueEncrypted);
    } else {
      // Check environment variable as fallback
      apiKey = process.env.VAULT_SMS_WEBHOOK_API_KEY || null;
    }

    if (!apiKey) {
      return NextResponse.json({ 
        apiKey: null,
        message: 'No API key configured. Generate one to secure your webhooks.'
      });
    }

    return NextResponse.json({ apiKey });
  } catch (error) {
    console.error('[vault] Get webhook API key error:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook API key' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault/webhook/api-key
 * Generate a new webhook API key (GUID)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();

    // Generate a new GUID-based API key
    const newApiKey = randomUUID();

    // Encrypt the API key
    const encryptedKey = encrypt(newApiKey);

    // Check if setting already exists
    const [existing] = await db
      .select()
      .from(vaultSettings)
      .where(eq(vaultSettings.key, WEBHOOK_API_KEY_SETTING_KEY))
      .limit(1);

    if (existing) {
      // Update existing setting
      await db
        .update(vaultSettings)
        .set({
          valueEncrypted: encryptedKey,
          updatedAt: new Date(),
        })
        .where(eq(vaultSettings.key, WEBHOOK_API_KEY_SETTING_KEY));
    } else {
      // Create new setting
      await db.insert(vaultSettings).values({
        key: WEBHOOK_API_KEY_SETTING_KEY,
        valueEncrypted: encryptedKey,
      });
    }

    console.log('[vault] Generated new webhook API key');

    return NextResponse.json({ 
      apiKey: newApiKey,
      message: 'New API key generated successfully'
    });
  } catch (error) {
    console.error('[vault] Generate webhook API key error:', error);
    return NextResponse.json(
      { error: 'Failed to generate webhook API key' },
      { status: 500 }
    );
  }
}

