import { NextResponse } from 'next/server'

export function POST() {
  return NextResponse.json({ error: 'setup disabled' }, { status: 410 })
}
