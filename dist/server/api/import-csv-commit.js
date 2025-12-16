// src/server/api/import-csv-commit.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems } from '@/lib/feature-pack-schemas';
import { getUserId } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * POST /api/vault/import/csv/commit
 * Commit CSV import
 */
export async function POST(request) {
    try {
        const db = getDb();
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const body = await request.json();
        const items = body.items;
        const mappings = body.mappings;
        if (!items || !Array.isArray(items)) {
            return NextResponse.json({ error: 'items array is required' }, { status: 400 });
        }
        // TODO: Implement CSV import with encryption and validation
        const results = await db.insert(vaultItems).values(items.map((item) => ({
            ...item,
            userId: userId,
        }))).returning();
        return NextResponse.json({ items: results, count: results.length });
    }
    catch (error) {
        console.error('[vault] CSV commit error:', error);
        return NextResponse.json({ error: 'Failed to commit CSV import' }, { status: 500 });
    }
}
