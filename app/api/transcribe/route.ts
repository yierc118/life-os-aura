// /api/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // TODO: Implement transcribe logic
  return NextResponse.json({ message: 'Transcribe route working!' });
}
