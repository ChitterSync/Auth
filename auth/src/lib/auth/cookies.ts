import type { NextResponse } from 'next/server';

export const REFRESH_COOKIE_NAME = 'ch_auth_refresh';

const isProduction = process.env.NODE_ENV === 'production';

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
});

export const setRefreshCookie = (res: NextResponse, token: string) => {
  res.cookies.set(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
};

export const clearRefreshCookie = (res: NextResponse) => {
  res.cookies.set(REFRESH_COOKIE_NAME, '', {
    ...getRefreshCookieOptions(),
    maxAge: 0,
  });
};
