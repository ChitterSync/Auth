let argon2Module: typeof import('argon2') | null | undefined;
let bcryptModule: typeof import('bcryptjs') | null | undefined;

const BCRYPT_COST = 12;

const loadArgon2 = async () => {
  if (argon2Module !== undefined) return argon2Module;
  try {
    argon2Module = await import('argon2');
  } catch {
    argon2Module = null;
  }
  return argon2Module;
};

const loadBcrypt = async () => {
  if (bcryptModule !== undefined) return bcryptModule;
  try {
    bcryptModule = await import('bcryptjs');
  } catch {
    bcryptModule = null;
  }
  return bcryptModule;
};

export const hashPassword = async (password: string) => {
  const argon2 = await loadArgon2();
  if (argon2) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  const bcrypt = await loadBcrypt();
  if (!bcrypt) {
    throw new Error('No password hashing library is available.');
  }

  return bcrypt.hash(password, BCRYPT_COST);
};

export const verifyPassword = async (password: string, passwordHash: string) => {
  if (!passwordHash) return false;

  if (passwordHash.startsWith('$argon2')) {
    const argon2 = await loadArgon2();
    if (!argon2) return false;
    return argon2.verify(passwordHash, password);
  }

  const bcrypt = await loadBcrypt();
  if (!bcrypt) return false;

  return bcrypt.compare(password, passwordHash);
};
