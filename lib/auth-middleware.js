import { verifyToken } from './jwt.js';

export function authenticate(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  return verifyToken(token);
}

export function requireAdmin(user) {
  return user && user.role === 'admin';
}
