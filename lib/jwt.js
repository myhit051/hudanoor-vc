import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hudanoor-default-secret-key-for-dev';
const EXPIRES_IN = '30d';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}
