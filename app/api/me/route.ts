import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const role = request.headers.get('x-user-role') || 'anonymous'
  return NextResponse.json({ role })
}
