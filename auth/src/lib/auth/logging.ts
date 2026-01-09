type AuthEvent = {
  event: string;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export const logAuthEvent = (payload: AuthEvent) => {
  const entry = {
    ...payload,
    timestamp: new Date().toISOString(),
  };
  console.info('[auth]', JSON.stringify(entry));
};
