import type { NextResponse } from 'next/server';

const isProduction = process.env.NODE_ENV === 'production';
export const REFRESH_COOKIE_NAME = isProduction ? '__Host-ch_auth_refresh' : 'ch_auth_refresh';

export const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
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
