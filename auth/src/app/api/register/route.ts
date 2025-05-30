import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Define a proper User type instead of any
interface User {
  userId: string;
  loginId: string;
  password: string;
  email?: string;
  phone?: string;
  username: string;
  name?: string;
  gender?: string;
  dob?: string;
  location?: string;
  createdAt: string;
}

// In-memory user store (demo only, replace with DB in prod)
const users: User[] = [];

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Validate required fields
    if (
      !data.loginId ||
      !data.password ||
      (!data.email?.length && !data.phone?.length) ||
      !data.username
    ) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Check for duplicate loginId
    if (users.some(u => u.loginId === data.loginId)) {
      return NextResponse.json({ error: 'Login ID already exists.' }, { status: 409 });
    }

    // Assign UUID and create user object
    const user: User = {
      userId: uuidv4(),
      loginId: data.loginId,
      password: data.password, // assumed encrypted client-side
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

    return NextResponse.json({ userId: user.userId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}
