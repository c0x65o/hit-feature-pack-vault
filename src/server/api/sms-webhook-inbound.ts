// src/server/api/sms-webhook-inbound.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsMessages, vaultSmsNumbers } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/vault/sms/webhook/inbound
 * Inbound SMS webhook (Twilio/etc)
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    // TODO: Verify webhook signature/authentication
    // TODO: Extract phone number and message
    // TODO: Find associated SMS number
    // TODO: Encrypt and store message

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[vault] SMS webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process SMS webhook' },
      { status: 500 }
    );
  }
}

