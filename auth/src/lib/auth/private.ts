import crypto from 'node:crypto';

const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_DEV_PEPPER = 'dev-private-pepper';
const MIN_PEPPER_LENGTH = 32;

const getPepper = () => {
  const pepper = process.env.PRIVATE_DATA_PEPPER || process.env.CHITTER_PRIVATE_PEPPER;
  if (pepper) {
    if (pepper.length < MIN_PEPPER_LENGTH) {
      if (isProduction) {
        throw new Error(`PRIVATE_DATA_PEPPER must be at least ${MIN_PEPPER_LENGTH} characters.`);
      }
    }
    return pepper;
  }
  if (isProduction) {
    throw new Error('PRIVATE_DATA_PEPPER must be defined in production.');
  }
  return DEFAULT_DEV_PEPPER;
};

export const hashPrivateValue = (value: string) =>
  crypto.createHmac('sha256', getPepper()).update(value).digest('hex');
