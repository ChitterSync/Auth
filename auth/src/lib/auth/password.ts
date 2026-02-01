let argon2Module: typeof import('argon2') | null | undefined;
let bcryptModule: typeof import('bcryptjs') | null | undefined;

const parseNumber = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isProduction = process.env.NODE_ENV === 'production';
const BCRYPT_COST = parseNumber(process.env.BCRYPT_COST, 13);
const PEPPER_PREFIX = 'pepper1:';
const DEFAULT_ARGON2_MEMORY_COST = 65536;
const DEFAULT_ARGON2_TIME_COST = 3;
const DEFAULT_ARGON2_PARALLELISM = 1;

const getArgon2Options = () => ({
  memoryCost: parseNumber(process.env.ARGON2_MEMORY_COST, DEFAULT_ARGON2_MEMORY_COST),
  timeCost: parseNumber(process.env.ARGON2_TIME_COST, DEFAULT_ARGON2_TIME_COST),
  parallelism: parseNumber(process.env.ARGON2_PARALLELISM, DEFAULT_ARGON2_PARALLELISM),
});

const getPasswordPepper = () => {
  const pepper = process.env.PASSWORD_PEPPER || process.env.CHITTER_PASSWORD_PEPPER;
  if (pepper) return Buffer.from(pepper, 'utf8');
  if (isProduction) {
    throw new Error('PASSWORD_PEPPER must be defined in production.');
  }
  return null;
};

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
    const pepper = getPasswordPepper();
    const options = getArgon2Options();
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      ...options,
      ...(pepper ? { secret: pepper } : {}),
    });
    return pepper ? `${PEPPER_PREFIX}${hash}` : hash;
  }

  const bcrypt = await loadBcrypt();
  if (!bcrypt) {
    throw new Error('No password hashing library is available.');
  }

  return bcrypt.hash(password, BCRYPT_COST);
};

export const verifyPassword = async (password: string, passwordHash: string) => {
  if (!passwordHash) return false;

  const usesPepper = passwordHash.startsWith(PEPPER_PREFIX);
  const storedHash = usesPepper ? passwordHash.slice(PEPPER_PREFIX.length) : passwordHash;

  if (storedHash.startsWith('$argon2')) {
    const argon2 = await loadArgon2();
    if (!argon2) return false;
    const pepper = usesPepper ? getPasswordPepper() : null;
    if (usesPepper && !pepper) {
      throw new Error('PASSWORD_PEPPER is required to verify this password hash.');
    }
    return argon2.verify(storedHash, password, pepper ? { secret: pepper } : undefined);
  }

  const bcrypt = await loadBcrypt();
  if (!bcrypt) return false;

  return bcrypt.compare(password, storedHash);
};
