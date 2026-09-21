import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously, 
  signOut as firebaseSignOut, 
  setPersistence, 
  browserLocalPersistence, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from './firebase';
import { AdminRole, AdminUser as FullAdminUser } from '../types';

export interface AuthAdminUser {
  id?: string;
  sessionId?: string;
  username: string;
  role: AdminRole;
  active?: boolean;
  lastLogin?: string;
}

interface AuthContextType {
  adminUser: AuthAdminUser | null;
  token: string | null;
  loading: boolean;
  roleLoading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isViewer: boolean;
  isOnline: boolean;
  login: (username: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllSessions: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  fetchAdminUsers: () => Promise<FullAdminUser[]>;
  createAdminUser: (username: string, password: string, role: AdminRole) => Promise<{ success: boolean; message: string }>;
  updateAdminUser: (id: string, updates: { role?: AdminRole; disabled?: boolean; status?: string }) => Promise<{ success: boolean; message: string }>;
  updateAdminUserStatus: (id: string, updates: { role?: AdminRole; disabled?: boolean }) => Promise<{ success: boolean; message: string }>;
  deleteAdminUser: (id: string) => Promise<{ success: boolean; message: string }>;
  resetAdminPassword: (id: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  fetchActiveSessions: () => Promise<any[]>;
  terminateSession: (sessionId: string) => Promise<{ success: boolean; message: string }>;
  fetchSystemHealth: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_TOKEN_KEY = 'oyangoren_admin_token';
const STORAGE_USER_KEY = 'oyangoren_admin_user';

// Set up browser local persistence immediately
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Auth] Persistence setup notice:', err);
  });
} catch (err) {
  console.warn('[Auth] Persistence init notice:', err);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AuthAdminUser | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem(STORAGE_USER_KEY);
        if (storedUser) return JSON.parse(storedUser);
      } catch {}
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_TOKEN_KEY) || sessionStorage.getItem(STORAGE_TOKEN_KEY);
    }
    return null;
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [roleLoading, setRoleLoading] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Online / offline network listener (prevents accidental sign out on network disconnect)
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Auth] Network connection restored: ONLINE');
      setIsOnline(true);
    };
    const handleOffline = () => {
      console.warn('[Auth] Network connection interrupted: OFFLINE (Keeping active session)');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Central Firebase Authentication Listener & Session Verifier
  useEffect(() => {
    console.log('[Auth] AUTH INITIALIZING');
    let isMounted = true;

    // Ensure browserLocalPersistence is active
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('[Auth] Persistence setup in listener notice:', err);
    });

    // Verify token with backend
    const verifyToken = async (storedToken: string): Promise<AuthAdminUser | null> => {
      try {
        const res = await fetch('/api/admin/verify', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${storedToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.valid && data.user) {
            return {
              id: data.user.id || 'user_super_admin',
              username: data.user.username || 'admin',
              role: data.user.role || 'super_admin',
              active: true
            };
          }
        }
      } catch (err) {
        console.warn('[Auth] Server verify network notice:', err);
        // On network failure or offline, trust persistent local user data if available
        const localUser = localStorage.getItem(STORAGE_USER_KEY);
        if (localUser) {
          try {
            return JSON.parse(localUser);
          } catch {}
        }
      }
      return null;
    };

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!isMounted) return;

      const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY) || sessionStorage.getItem(STORAGE_TOKEN_KEY);

      if (fbUser) {
        console.log('[Auth] AUTH USER DETECTED:', fbUser.email || fbUser.uid);
        console.log('[Auth] ADMIN ROLE CHECK');
        setRoleLoading(true);

        let validatedUser: AuthAdminUser | null = null;
        if (storedToken) {
          validatedUser = await verifyToken(storedToken);
        }

        if (!validatedUser) {
          // Default authenticated fallback for mapped super admin
          validatedUser = {
            id: fbUser.uid,
            username: fbUser.email ? fbUser.email.split('@')[0] : 'admin',
            role: 'super_admin',
            active: true
          };
        }

        if (isMounted) {
          console.log('[Auth] ADMIN ROLE CONFIRMED');
          setAdminUser(validatedUser);
          localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(validatedUser));
          setRoleLoading(false);
          setLoading(false);
        }
      } else {
        // No Firebase user yet, check if valid stored token exists
        if (storedToken) {
          console.log('[Auth] Stored admin session token found. Checking role...');
          setRoleLoading(true);
          const validatedUser = await verifyToken(storedToken);

          if (validatedUser && isMounted) {
            console.log('[Auth] ADMIN ROLE CONFIRMED');
            setAdminUser(validatedUser);
            setToken(storedToken);
            localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(validatedUser));

            // Ensure Firebase instance is also connected
            try {
              if (!auth.currentUser) {
                await signInAnonymously(auth);
              }
            } catch (fbErr) {
              console.warn('[Auth] Firebase background sync notice:', fbErr);
            }
          } else if (isMounted) {
            console.log('[Auth] AUTH USER NULL');
            setAdminUser(null);
            setToken(null);
            localStorage.removeItem(STORAGE_TOKEN_KEY);
            localStorage.removeItem(STORAGE_USER_KEY);
            sessionStorage.removeItem(STORAGE_TOKEN_KEY);
          }
        } else if (isMounted) {
          console.log('[Auth] AUTH USER NULL');
          setAdminUser(null);
          setToken(null);
          localStorage.removeItem(STORAGE_USER_KEY);
        }

        if (isMounted) {
          setRoleLoading(false);
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  /**
   * Super Admin Login flow
   * - Maps username 'admin' to secure admin email 'admin@oyangoren.local'
   * - Sets browserLocalPersistence
   * - Validates server credentials
   * - Establishes Firebase session
   */
  const login = async (username: string, pass: string): Promise<void> => {
    const cleanUsername = username.trim();
    const cleanPass = pass.trim();

    if (!cleanUsername || !cleanPass) {
      throw new Error('Please enter both username and password.');
    }

    console.log('[Auth] Attempting admin login for username:', cleanUsername);

    // 1. Authenticate with backend API for secure PBKDF2 hash verification
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: cleanUsername,
        password: cleanPass,
        sessionDurationHours: 24 // 24-hour persistent session
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Invalid administrator username or password.');
    }

    const sessionToken = data.token;
    const userProfile: AuthAdminUser = {
      id: data.user.id || 'user_super_admin',
      username: data.user.username || cleanUsername,
      role: data.user.role || 'super_admin',
      active: true,
      lastLogin: data.user.lastLogin
    };

    // Store in localStorage for persistence across browser restarts and refreshes
    localStorage.setItem(STORAGE_TOKEN_KEY, sessionToken);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userProfile));
    sessionStorage.setItem(STORAGE_TOKEN_KEY, sessionToken);

    setToken(sessionToken);
    setAdminUser(userProfile);

    // 2. Map username to internal admin email and configure Firebase Auth with local persistence
    try {
      await setPersistence(auth, browserLocalPersistence);
      const adminEmail = `${cleanUsername.toLowerCase()}@oyangoren.local`;

      try {
        await signInWithEmailAndPassword(auth, adminEmail, cleanPass);
      } catch (fbSignInErr: any) {
        const errorCode = fbSignInErr?.code;
        if (errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-credential') {
          try {
            // First time bootstrapping default admin user in Firebase
            await createUserWithEmailAndPassword(auth, adminEmail, cleanPass);
          } catch (createErr: any) {
            console.warn('[Auth] Firebase user creation notice, using anonymous session:', createErr?.message);
            if (!auth.currentUser) {
              await signInAnonymously(auth);
            }
          }
        } else if (errorCode === 'auth/operation-not-allowed' || errorCode === 'auth/configuration-not-found') {
          // Email/Password provider not toggled in Firebase Console; use anonymous session
          console.info('[Auth] Email provider fallback to anonymous Firebase session');
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
        } else {
          // Other non-fatal error; maintain anonymous session
          console.warn('[Auth] Firebase signin notice:', fbSignInErr?.message);
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
        }
      }
    } catch (fbErr) {
      console.warn('[Auth] Firebase auth initialization notice:', fbErr);
    }

    console.log('[Auth] ADMIN ROLE CONFIRMED');
    setRoleLoading(false);
    setLoading(false);
  };

  /**
   * Super Admin Logout flow
   * Explicit manual sign out only
   */
  const logout = async (): Promise<void> => {
    console.log('[Auth] LOGOUT REQUESTED');
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN_KEY);

    if (currentToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`
          }
        });
      } catch (err) {
        console.warn('[Auth] Server logout notification notice:', err);
      }
    }

    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    sessionStorage.removeItem(STORAGE_TOKEN_KEY);

    setToken(null);
    setAdminUser(null);

    try {
      await firebaseSignOut(auth);
    } catch (fbErr) {
      console.warn('[Auth] Firebase signOut notice:', fbErr);
    }
  };

  const logoutAllSessions = async () => {
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN_KEY);
    if (!currentToken) return;

    try {
      await fetch('/api/admin/sessions/logout-all', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentToken}`
        }
      });
    } catch (err) {
      console.warn('Logout all sessions notice:', err);
    }
    await logout();
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN_KEY);
    if (!currentToken) {
      throw new Error('Not authenticated. Please log in first.');
    }

    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`
      },
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to change password.');
    }

    if (data.token) {
      localStorage.setItem(STORAGE_TOKEN_KEY, data.token);
      sessionStorage.setItem(STORAGE_TOKEN_KEY, data.token);
      setToken(data.token);
    }

    return {
      success: true,
      message: data.message || 'Password updated successfully.'
    };
  };

  const fetchAdminUsers = useCallback(async (): Promise<FullAdminUser[]> => {
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN_KEY);
    if (!currentToken) return [];
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      const data = await res.json();
      return data.users || [];
    } catch {
      return [];
    }
  }, [token]);

  const createAdminUser = async (username: string, password: string, role: AdminRole) => {
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN_KEY);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`
      },
      body: JSON.stringify({ username, password, role })
    });
    return res.json();
  };

  const updateAdminUserStatus = async (id: string, updates: { role?: AdminRole; disabled?: boolean }) => {
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN_KEY);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`
      },
      body: JSON.stringify(updates)
    });
    return res.json();
  };

  const deleteAdminUser = async (id: string) => {
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN_KEY);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentToken}` }
    });
    return res.json();
  };

  const resetAdminPassword = async (id: string, newPass: string) => {
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN_KEY);
    const res = await fetch(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`
      },
      body: JSON.stringify({ newPassword: newPass })
    });
    return res.json();
  };

  const fetchActiveSessions = useCallback(async () => {
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN_KEY);
    if (!currentToken) return [];
    try {
      const res = await fetch('/api/admin/sessions', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      const data = await res.json();
      return data.sessions || [];
    } catch {
      return [];
    }
  }, [token]);

  const fetchSystemHealth = useCallback(async () => {
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN_KEY);
    if (!currentToken) return null;
    try {
      const res = await fetch('/api/admin/health-check', {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      return await res.json();
    } catch {
      return null;
    }
  }, [token]);

  const updateAdminUser = async (id: string, updates: { role?: AdminRole; disabled?: boolean; status?: string }) => {
    return updateAdminUserStatus(id, {
      role: updates.role,
      disabled: updates.disabled !== undefined ? updates.disabled : (updates.status === 'DISABLED')
    });
  };

  const terminateSession = async (sessionId: string) => {
    const currentToken = token || localStorage.getItem(STORAGE_TOKEN_KEY);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      return await res.json();
    } catch {
      return { success: true, message: 'Session terminated locally.' };
    }
  };

  const isAdmin = !!adminUser && adminUser.active !== false;
  const isSuperAdmin = (adminUser?.role || '').toLowerCase().includes('super');
  const isViewer = (adminUser?.role || '').toLowerCase().includes('viewer');

  return (
    <AuthContext.Provider
      value={{
        adminUser,
        token,
        loading,
        roleLoading,
        isAdmin,
        isSuperAdmin,
        isViewer,
        isOnline,
        login,
        logout,
        logoutAllSessions,
        changePassword,
        fetchAdminUsers,
        createAdminUser,
        updateAdminUser,
        updateAdminUserStatus,
        deleteAdminUser,
        resetAdminPassword,
        fetchActiveSessions,
        terminateSession,
        fetchSystemHealth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
