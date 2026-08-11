import { createHmac, timingSafeEqual } from 'node:crypto';

export const CATALOG_OPS_COOKIE = 'sylistly_catalog_ops';
export const CATALOG_OPS_SESSION_TTL_SECONDS = 8 * 60 * 60;

interface CatalogOpsAuthEnv {
  [key: string]: string | undefined;
  CATALOG_OPS_TOKEN?: string;
  CATALOG_OPS_SESSION_SECRET?: string;
}

interface CatalogOpsCredentials {
  authorization?: string | null;
  sessionCookie?: string | null;
}

function value(env: CatalogOpsAuthEnv, key: keyof CatalogOpsAuthEnv): string {
  return String(env[key] || '').trim();
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionSecret(env: CatalogOpsAuthEnv): string {
  return value(env, 'CATALOG_OPS_SESSION_SECRET') || value(env, 'CATALOG_OPS_TOKEN');
}

function signature(timestamp: string, env: CatalogOpsAuthEnv): string {
  const secret = sessionSecret(env);
  if (!secret) return '';
  return createHmac('sha256', secret).update(`catalog-ops:${timestamp}`).digest('base64url');
}

export function catalogOpsAuthConfigured(env: CatalogOpsAuthEnv = process.env): boolean {
  return value(env, 'CATALOG_OPS_TOKEN').length >= 24;
}

export function catalogOpsTokenMatches(token: string, env: CatalogOpsAuthEnv = process.env): boolean {
  const expected = value(env, 'CATALOG_OPS_TOKEN');
  return expected.length >= 24 && safeEqual(token.trim(), expected);
}

export function createCatalogOpsSession(
  env: CatalogOpsAuthEnv = process.env,
  now = new Date(),
): string | null {
  if (!catalogOpsAuthConfigured(env)) return null;
  const timestamp = String(now.getTime());
  return `v1.${timestamp}.${signature(timestamp, env)}`;
}

export function verifyCatalogOpsSession(
  cookieValue: string | null | undefined,
  env: CatalogOpsAuthEnv = process.env,
  now = new Date(),
): boolean {
  if (!catalogOpsAuthConfigured(env) || !cookieValue) return false;
  const [version, timestamp, providedSignature, extra] = cookieValue.split('.');
  if (version !== 'v1' || !timestamp || !providedSignature || extra) return false;
  const createdAt = Number(timestamp);
  if (!Number.isFinite(createdAt) || createdAt > now.getTime() + 60_000) return false;
  if (now.getTime() - createdAt > CATALOG_OPS_SESSION_TTL_SECONDS * 1000) return false;
  return safeEqual(providedSignature, signature(timestamp, env));
}

export function hasCatalogOpsAccess(
  credentials: CatalogOpsCredentials,
  env: CatalogOpsAuthEnv = process.env,
  now = new Date(),
): boolean {
  const authorization = credentials.authorization || '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  if (bearer && catalogOpsTokenMatches(bearer, env)) return true;
  return verifyCatalogOpsSession(credentials.sessionCookie, env, now);
}
