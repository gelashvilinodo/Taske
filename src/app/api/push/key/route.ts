import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** The public VAPID key the browser needs to subscribe; null when push is not set up on the server. */
export function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null }, { headers: { 'Cache-Control': 'no-store' } });
}
