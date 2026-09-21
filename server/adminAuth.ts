import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type AdminRole = 'super_admin' | 'admin' | 'viewer';

export interface StoredUserAccount {
  id: string;
  username: string;
  role: AdminRole;
  salt: string;
  hash: string;
  disabled: boolean;
  createdAt: string;
  lastLogin?: string;
  twoFactorEnabled?: boolean;
}

interface StoredAuthStore {
  users: StoredUserAccount[];
  version: number;
}

export interface SessionRecord {
  token: string;
  username: string;
  role: AdminRole;
  deviceType: string;
  browser: string;
  ip: string;
  createdAt: number;
  expiresAt: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'admin-credentials.json');

// In-memory active sessions map (token -> SessionRecord)
const activeSessions = new Map<string, SessionRecord>();

// Brute-force protection: failed attempts tracker
interface FailedAttempt {
  count: number;
  lockedUntil: number;
  lastAttempt: number;
}
const failedAttempts = new Map<string, FailedAttempt>();

// Server-wide secret for signing HMAC tokens
let serverSecret = process.env.ADMIN_SESSION_SECRET || '';
if (!serverSecret) {
  serverSecret = crypto.randomBytes(32).toString('hex');
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

/**
 * Initialize or migrate stored admin credentials.
 * Default credentials:
 * Username: admin
 * Password: admin2026@
 * Role: super_admin
 */
export function initAdminAuth(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CREDENTIALS_FILE)) {
    const defaultSalt = crypto.randomBytes(16).toString('hex');
    const defaultHash = hashPassword('admin2026@', defaultSalt);

    const initialStore: StoredAuthStore = {
      version: 3,
      users: [
        {
          id: 'user_super_admin',
          username: 'admin',
          role: 'super_admin',
          salt: defaultSalt,
          hash: defaultHash,
          disabled: false,
          createdAt: new Date().toISOString(),
          twoFactorEnabled: false
        }
      ]
    };

    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(initialStore, null, 2), 'utf-8');
    console.log('[AdminAuth] Initialized multi-admin store with default Super Admin.');
  } else {
    // Migration check: if old format (single object), convert to array
    try {
      const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (!data.users && data.username) {
        const migrated: StoredAuthStore = {
          version: 3,
          users: [
            {
              id: 'user_super_admin',
              username: data.username,
              role: 'super_admin',
              salt: data.salt,
              hash: data.hash,
              disabled: false,
              createdAt: data.updatedAt || new Date().toISOString()
            }
          ]
        };
        fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(migrated, null, 2), 'utf-8');
        console.log('[AdminAuth] Migrated legacy single-admin store to multi-admin format.');
      }
    } catch (e) {
      console.error('[AdminAuth] Migration notice:', e);
    }
  }
}

function getStoredStore(): StoredAuthStore {
  initAdminAuth();
  const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
  return JSON.parse(raw);
}

function saveStoredStore(store: StoredAuthStore): void {
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Requirement 33: Login attempt protection
 * Check if IP or username is locked out.
 */
export function isLockedOut(identifier: string): { locked: boolean; waitSeconds?: number } {
  const attempt = failedAttempts.get(identifier.toLowerCase());
  if (!attempt) return { locked: false };

  const now = Date.now();
  if (attempt.lockedUntil > now) {
    const waitSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
    return { locked: true, waitSeconds };
  }

  // Clear expired lock
  if (attempt.lockedUntil > 0 && attempt.lockedUntil <= now) {
    failedAttempts.delete(identifier.toLowerCase());
  }

  return { locked: false };
}

export function recordFailedLogin(identifier: string): void {
  const key = identifier.toLowerCase();
  const now = Date.now();
  const current = failedAttempts.get(key) || { count: 0, lockedUntil: 0, lastAttempt: now };

  current.count += 1;
  current.lastAttempt = now;

  // Lock account for 15 minutes after 5 failed attempts
  if (current.count >= 5) {
    current.lockedUntil = now + 15 * 60 * 1000;
  }

  failedAttempts.set(key, current);
}

export function clearFailedLogins(identifier: string): void {
  failedAttempts.delete(identifier.toLowerCase());
}

/**
 * Verifies credentials and returns user account if valid.
 */
export function verifyAdminCredentials(
  username: string,
  password: string
): { success: boolean; user?: StoredUserAccount; error?: string } {
  try {
    const store = getStoredStore();
    const user = store.users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase()
    );

    if (!user) {
      return { success: false, error: 'Invalid administrator username or password.' };
    }

    if (user.disabled) {
      return { success: false, error: 'This administrator account has been disabled.' };
    }

    const testHash = hashPassword(password, user.salt);
    const matches = crypto.timingSafeEqual(
      Buffer.from(testHash, 'hex'),
      Buffer.from(user.hash, 'hex')
    );

    if (!matches) {
      return { success: false, error: 'Invalid administrator username or password.' };
    }

    // Update lastLogin
    user.lastLogin = new Date().toISOString();
    saveStoredStore(store);

    return { success: true, user };
  } catch (err) {
    console.error('[AdminAuth] Error verifying credentials:', err);
    return { success: false, error: 'Authentication service error.' };
  }
}

/**
 * Creates cryptographically signed session token.
 */
export function createAdminSession(
  username: string,
  role: AdminRole = 'super_admin',
  durationHours = 1,
  deviceInfo = { deviceType: 'Desktop', browser: 'Chrome', ip: '127.0.0.1' }
): { token: string; expiresIn: number } {
  const now = Date.now();
  const durationMs = (durationHours > 0 ? durationHours : 1) * 60 * 60 * 1000;
  const expiresAt = now + durationMs;

  const payload = `${username}:${role}:${now}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', serverSecret).update(payload).digest('hex');
  const token = `${Buffer.from(payload).toString('base64url')}.${signature}`;

  activeSessions.set(token, {
    token,
    username,
    role,
    deviceType: deviceInfo.deviceType,
    browser: deviceInfo.browser,
    ip: deviceInfo.ip,
    createdAt: now,
    expiresAt
  });

  return {
    token,
    expiresIn: Math.floor(durationMs / 1000)
  };
}

/**
 * Validates session token and returns role and user info.
 */
export function validateAdminSession(token: string | undefined): {
  valid: boolean;
  username?: string;
  role?: AdminRole;
} {
  if (!token) return { valid: false };

  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };

  const [encodedPayload, signature] = parts;
  let payloadStr = '';
  try {
    payloadStr = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
  } catch {
    return { valid: false };
  }

  const expectedSignature = crypto.createHmac('sha256', serverSecret).update(payloadStr).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return { valid: false };
  }

  const [username, role, _createdAtStr, expiresAtStr] = payloadStr.split(':');
  const expiresAt = parseInt(expiresAtStr, 10);

  if (isNaN(expiresAt) || Date.now() > expiresAt || !activeSessions.has(token)) {
    activeSessions.delete(token);
    return { valid: false };
  }

  return { valid: true, username, role: (role as AdminRole) || 'super_admin' };
}

export function revokeAdminSession(token: string): void {
  activeSessions.delete(token);
}

export function revokeAllSessions(username?: string): void {
  if (!username) {
    activeSessions.clear();
  } else {
    for (const [token, session] of activeSessions.entries()) {
      if (session.username.toLowerCase() === username.toLowerCase()) {
        activeSessions.delete(token);
      }
    }
  }
}

export function getActiveSessionsList(currentToken?: string): SessionRecord[] {
  const now = Date.now();
  const list: SessionRecord[] = [];
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt > now) {
      list.push({
        ...session,
        token: session.token === currentToken ? 'CURRENT' : session.token.substring(0, 12) + '...'
      });
    } else {
      activeSessions.delete(token);
    }
  }
  return list;
}

// ==========================================
// Admin Users Management (Requirement 30 & 31)
// ==========================================

export function getAdminUsersSafe(): Omit<StoredUserAccount, 'salt' | 'hash'>[] {
  const store = getStoredStore();
  return store.users.map(({ salt: _s, hash: _h, ...safe }) => safe);
}

export function addAdminUser(
  username: string,
  password: string,
  role: AdminRole = 'admin'
): { success: boolean; message: string; user?: Omit<StoredUserAccount, 'salt' | 'hash'> } {
  const store = getStoredStore();
  const cleanUsername = username.trim();

  if (!cleanUsername || cleanUsername.length < 3) {
    return { success: false, message: 'Username must be at least 3 characters long.' };
  }
  if (!password || password.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters long.' };
  }

  const exists = store.users.some(
    (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
  );
  if (exists) {
    return { success: false, message: 'An administrator with this username already exists.' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  const newUser: StoredUserAccount = {
    id: `admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    username: cleanUsername,
    role,
    salt,
    hash,
    disabled: false,
    createdAt: new Date().toISOString()
  };

  store.users.push(newUser);
  saveStoredStore(store);

  const { salt: _s, hash: _h, ...safe } = newUser;
  return { success: true, message: `Admin account "${cleanUsername}" created successfully.`, user: safe };
}

export function updateAdminRoleOrStatus(
  id: string,
  updates: { role?: AdminRole; disabled?: boolean }
): { success: boolean; message: string } {
  const store = getStoredStore();
  const user = store.users.find((u) => u.id === id);

  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  // Requirement 31: Do not allow disabling or removing Super Admin
  if (user.username.toLowerCase() === 'admin' && updates.disabled === true) {
    return { success: false, message: 'The primary Super Admin account cannot be disabled.' };
  }
  if (user.username.toLowerCase() === 'admin' && updates.role && updates.role !== 'super_admin') {
    return { success: false, message: 'The primary Super Admin role cannot be changed.' };
  }

  if (updates.role) user.role = updates.role;
  if (typeof updates.disabled === 'boolean') user.disabled = updates.disabled;

  saveStoredStore(store);
  return { success: true, message: 'Admin account updated successfully.' };
}

export function removeAdminUser(id: string): { success: boolean; message: string } {
  const store = getStoredStore();
  const user = store.users.find((u) => u.id === id);

  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  if (user.username.toLowerCase() === 'admin' || user.id === 'user_super_admin') {
    return { success: false, message: 'The primary Super Admin cannot be removed.' };
  }

  store.users = store.users.filter((u) => u.id !== id);
  saveStoredStore(store);

  // Invalidate any active session for this user
  revokeAllSessions(user.username);

  return { success: true, message: `Admin account "${user.username}" removed.` };
}

export function resetAdminUserPassword(
  id: string,
  newPassword: string
): { success: boolean; message: string } {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, message: 'New password must be at least 6 characters long.' };
  }

  const store = getStoredStore();
  const user = store.users.find((u) => u.id === id);

  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  const newSalt = crypto.randomBytes(16).toString('hex');
  user.salt = newSalt;
  user.hash = hashPassword(newPassword, newSalt);

  saveStoredStore(store);
  revokeAllSessions(user.username);

  return { success: true, message: `Password for "${user.username}" reset successfully.` };
}

/**
 * Updates administrator password after verifying old password.
 */
export function updateAdminPassword(
  username: string,
  currentPassword: string,
  newPassword: string
): { success: boolean; message: string } {
  try {
    const store = getStoredStore();
    const user = store.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

    if (!user) {
      return { success: false, message: 'Invalid administrator username.' };
    }

    const currentTestHash = hashPassword(currentPassword, user.salt);
    const matches = crypto.timingSafeEqual(Buffer.from(currentTestHash, 'hex'), Buffer.from(user.hash, 'hex'));
    if (!matches) {
      return { success: false, message: 'Current password is incorrect.' };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    user.salt = newSalt;
    user.hash = hashPassword(newPassword, newSalt);

    saveStoredStore(store);
    return { success: true, message: 'Administrator password updated successfully.' };
  } catch (err: any) {
    console.error('[AdminAuth] Error updating password:', err);
    return { success: false, message: err.message || 'Failed to update password.' };
  }
}

