import { NextRequest, NextResponse } from 'next/server';

// This middleware extracts the username from subdomains like user.{username}.chittersync.com
export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  // Example: user.john.chittersync.com
  // Split by '.' and look for the username in the second position
  const parts = host.split('.');
  let username = null;
  if (parts.length > 2 && parts[0] === 'user') {
    username = parts[1];
  }

  // Optionally, you can set the username in a header or cookie for use in your app
  if (username) {
    const res = NextResponse.next();
    res.headers.set('x-username', username);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  // Apply this middleware to all routes, or restrict as needed
  matcher: [
    '/((?!_next|api|static|favicon.ico).*)',
  ],
};
