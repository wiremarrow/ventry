/**
 * Custom error class for authentication errors
 * Provides consistent error structure with error codes
 */

import type { AuthErrorCode } from './constants.js';

export class AuthError extends Error {
  public readonly code: AuthErrorCode;
  public readonly originalError?: Error;

  constructor(message: string, code: AuthErrorCode, originalError?: Error) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError);
    }
  }
}
