// src/server/api/import-csv-preview.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/vault/import/csv/preview
 * Preview CSV import with mapping
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const csvData = body.csvData;

    if (!csvData) {
      return NextResponse.json(
        { error: 'csvData is required' },
        { status: 400 }
      );
    }

    // TODO: Implement CSV parsing and preview logic
    return NextResponse.json({
      preview: [],
      mappings: {},
    });
  } catch (error) {
    console.error('[vault] CSV preview error:', error);
    return NextResponse.json(
      { error: 'Failed to preview CSV' },
      { status: 500 }
    );
  }
}

