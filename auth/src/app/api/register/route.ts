import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// In-memory user store (for demo only; use a DB in production)
const users: any[] = [];

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    // Validate required fields
    if (!data.loginId || !data.password || (!data.email?.length && !data.phone?.length) || !data.username) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }
    // Check for duplicate loginId
    if (users.some(u => u.loginId === data.loginId)) {
      return NextResponse.json({ error: 'Login ID already exists.' }, { status: 409 });
    }
    // Assign UUID
    const userId = uuidv4();
    const user = {
      userId,
      loginId: data.loginId,
      password: data.password, // Already encrypted client-side
      email: data.email,
      phone: data.phone,
      username: data.username,
      name: data.name,
      gender: data.gender,
      dob: data.dob,
      location: data.location,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    return NextResponse.json({ userId }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}
