import crypto from 'crypto';
import type { NextApiRequest } from 'next';

/**
 * Checks if the request is authenticated.
 * Supports:
 * 1. Cookie 'admin_session' (for browser pages and dashboard APIs)
 * 2. Query parameter 'key' (for stream/M3U/EPG APIs)
 */
export function isRequestAuthenticated(req: NextApiRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;

  // If no password is set, authentication is disabled (always authenticated)
  if (!adminPassword) {
    return true;
  }

  const expectedToken = crypto
    .createHash('sha256')
    .update(adminPassword)
    .digest('hex');

  // Check 1: Cookie validation (matching hashed password)
  const sessionToken = req.cookies.admin_session;
  if (sessionToken === expectedToken) {
    return true;
  }

  // Check 2: Query parameter validation (matching plain text password)
  const queryKey = req.query.key;
  if (queryKey === adminPassword) {
    return true;
  }

  return false;
}
