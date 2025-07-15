import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
}

export function signJWT(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}