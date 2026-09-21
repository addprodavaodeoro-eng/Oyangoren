import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  UserPlus, 
  Key, 
  Trash2, 
  Lock, 
  Unlock, 
  Activity, 
  Clock, 
  Monitor, 
  AlertOctagon, 
  CheckCircle2, 
  RefreshCw,
  LogOut,
  UserX,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { AdminRole, AdminUser, ActiveAdminSession } from '../types';

export const SecurityAdminCenter: React.FC = () => {
  const { 
    adminUser, 
    fetchAdminUsers, 
    createAdminUser, 
    updateAdminUser, 
    deleteAdminUser, 
    resetAdminPassword,
    fetchActiveSessions, 
    terminateSession 
  } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<ActiveAdminSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Form state for creating a user
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('PRINTING_STAFF');
  const [formError, setFormError] = useState<string | null>(null);

  // Password reset modal
  const [resetModalUser, setResetModalUser] = useState<AdminUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  const isSuperAdmin = (adminUser?.role || '').toLowerCase().includes('super');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [uList, sList] = await Promise.all([
        fetchAdminUsers(),
        fetchActiveSessions()
      ]);
      setUsers(uList);
      setSessions(sList);
    } catch (e: any) {
      console.error('Failed to load security center data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newUsername.trim() || !newPassword.trim()) {
      setFormError('Username and password are required.');
      return;
    }

    if (newPassword.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    const res = await createAdminUser(newUsername.trim(), newPassword, newRole);
    if (!res.success) {
      setFormError((res as any).error || res.message || 'Failed to create user.');
      return;
    }

    setStatusMessage(`Admin account "${newUsername}" created successfully!`);
    setIsCreatingUser(false);
    setNewUsername('');
    setNewPassword('');
    setNewRole('PRINTING_STAFF');
    loadData();
  };

  const handleToggleStatus = async (user: AdminUser) => {
    if (user.username === adminUser?.username) {
      alert('You cannot deactivate your own active account.');
      return;
    }
    const isCurrentlyActive = !user.disabled && user.status !== 'INACTIVE';
    const newStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
    const res = await updateAdminUser(user.id, { disabled: isCurrentlyActive, status: newStatus });
    if (res.success) {
      setStatusMessage(`User "${user.username}" is now ${newStatus}.`);
      loadData();
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (user.username === adminUser?.username) {
      alert('You cannot delete your own active account.');
      return;
    }
    if (!confirm(`Permanently delete admin user "${user.username}"?`)) return;

    const res = await deleteAdminUser(user.id);
    if (res.success) {
      setStatusMessage(`User "${user.username}" deleted.`);
      loadData();
    }
  };

  const handleExecutePasswordReset = async () => {
    if (!resetModalUser) return;
    if (resetPasswordValue.length < 6) {
      alert('New password must be at least 6 characters.');
      return;
    }
    const res = await resetAdminPassword(resetModalUser.id, resetPasswordValue);
    if (res.success) {
      setStatusMessage(`Password for "${resetModalUser.username}" reset successfully.`);
      setResetModalUser(null);
      setResetPasswordValue('');
      loadData();
    }
  };

  const handleTerminateSession = async (sessionId: string, username: string) => {
    if (!confirm(`Terminate active session for "${username}"?`)) return;
    const res = await terminateSession(sessionId);
    if (res.success) {
      setStatusMessage(`Session terminated.`);
      loadData();
    }
  };

  const handleTerminateAllOtherSessions = async () => {
    if (!confirm('Are you sure you want to terminate all other active admin sessions?')) return;
    for (const s of sessions) {
      const sid = s.id || s.sessionId || s.token || '';
      if (sid && sid !== adminUser?.sessionId) {
        await terminateSession(sid);
      }
    }
    setStatusMessage('All other active admin sessions terminated.');
    loadData();
  };

  const getRoleBadge = (role?: AdminRole) => {
    const roleStr = (role || '').toUpperCase();
    if (roleStr.includes('SUPER')) {
      return (
        <span className="bg-amber-400 text-black px-2 py-0.5 border border-black font-pixel text-[9px] font-black uppercase">
          SUPER ADMIN
        </span>
      );
    }
    if (roleStr.includes('MANAGER') || roleStr === 'ADMIN') {
      return (
        <span className="bg-blue-600 text-white px-2 py-0.5 border border-black font-pixel text-[9px] font-black uppercase">
          STORE MANAGER
        </span>
      );
    }
    return (
      <span className="bg-zinc-200 text-zinc-900 px-2 py-0.5 border border-black font-pixel text-[9px] font-black uppercase">
        PRINTING STAFF
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border-3 border-black shadow-[4px_4px_0px_#000]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
            <h2 className="font-pixel text-sm uppercase tracking-wider text-zinc-900">
              SECURITY & MULTI-ADMIN CENTER
            </h2>
          </div>
          <p className="text-xs text-zinc-600 font-bold mt-1">
            Manage admin role access, monitor active workstation sessions, and review security lockdowns.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={isLoading}
          className="mc-btn-secondary py-2 px-3 text-xs font-black uppercase flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>REFRESH</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border-2 border-emerald-800 text-emerald-950 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Admin Accounts Section */}
      <div className="bg-white p-5 border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-700" />
            <h3 className="font-pixel text-xs text-zinc-900 uppercase">
              ADMIN ACCOUNTS ({users.length})
            </h3>
          </div>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setIsCreatingUser(!isCreatingUser)}
              className="mc-btn-primary py-1.5 px-3 text-xs font-black uppercase flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isCreatingUser ? 'CANCEL' : 'CREATE ADMIN'}</span>
            </button>
          )}
        </div>

        {/* Create User Form (Super Admin only) */}
        {isCreatingUser && isSuperAdmin && (
          <form onSubmit={handleCreateUser} className="p-4 bg-zinc-50 border-2 border-black space-y-3 animate-in fade-in">
            <div className="font-pixel text-[11px] text-zinc-900 uppercase">CREATE NEW ADMIN ACCOUNT</div>

            {formError && (
              <div className="p-2 bg-red-100 border border-red-800 text-red-900 text-xs font-bold">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. staff_john"
                  className="w-full p-2 border-2 border-black text-xs font-bold bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full p-2 border-2 border-black text-xs font-bold bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">Role / Permissions</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AdminRole)}
                  className="w-full p-2 border-2 border-black text-xs font-bold bg-white"
                >
                  <option value="PRINTING_STAFF">Printing Staff (Standard)</option>
                  <option value="STORE_MANAGER">Store Manager</option>
                  <option value="SUPER_ADMIN">Super Admin (Full Access)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="mc-btn-success py-2 px-4 text-xs font-black uppercase"
              >
                SAVE ACCOUNT
              </button>
            </div>
          </form>
        )}

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100 border-b-2 border-black text-zinc-900 font-pixel text-[10px] uppercase">
                <th className="p-2.5">User</th>
                <th className="p-2.5">Role</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Created</th>
                <th className="p-2.5">Last Login</th>
                {isSuperAdmin && <th className="p-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50">
                  <td className="p-2.5 font-bold text-zinc-950 font-mono">
                    {u.username}
                    {u.username === adminUser?.username && (
                      <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-800 px-1 py-0.2 border border-blue-800">
                        YOU
                      </span>
                    )}
                  </td>
                  <td className="p-2.5">{getRoleBadge(u.role)}</td>
                  <td className="p-2.5">
                    {!u.disabled && u.status !== 'INACTIVE' ? (
                      <span className="text-emerald-700 font-bold font-mono">● ACTIVE</span>
                    ) : (
                      <span className="text-red-700 font-bold font-mono">● INACTIVE</span>
                    )}
                  </td>
                  <td className="p-2.5 text-zinc-600 font-mono text-[11px]">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-2.5 text-zinc-600 font-mono text-[11px]">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                  </td>
                  {isSuperAdmin && (
                    <td className="p-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Reset password */}
                        <button
                          type="button"
                          onClick={() => setResetModalUser(u)}
                          className="p-1 bg-zinc-100 hover:bg-zinc-200 border border-black shadow-[1px_1px_0px_#000]"
                          title="Reset Password"
                        >
                          <Key className="w-3.5 h-3.5 text-zinc-800" />
                        </button>

                        {/* Toggle active status */}
                        {u.username !== adminUser?.username && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className="p-1 bg-zinc-100 hover:bg-zinc-200 border border-black shadow-[1px_1px_0px_#000]"
                            title={!u.disabled && u.status !== 'INACTIVE' ? 'Deactivate account' : 'Activate account'}
                          >
                            {!u.disabled && u.status !== 'INACTIVE' ? (
                              <UserX className="w-3.5 h-3.5 text-amber-700" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                            )}
                          </button>
                        )}

                        {/* Delete user */}
                        {u.username !== adminUser?.username && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1 bg-red-100 hover:bg-red-200 border border-black text-red-900 shadow-[1px_1px_0px_#000]"
                            title="Delete account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Workstation Sessions */}
      <div className="bg-white p-5 border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-zinc-700" />
            <h3 className="font-pixel text-xs text-zinc-900 uppercase">
              ACTIVE SESSIONS ({sessions.length})
            </h3>
          </div>

          {sessions.length > 1 && (
            <button
              type="button"
              onClick={handleTerminateAllOtherSessions}
              className="mc-btn-secondary py-1 px-3 text-xs font-black uppercase text-red-700"
            >
              TERMINATE OTHER SESSIONS
            </button>
          )}
        </div>

        <div className="space-y-2">
          {sessions.map((s) => {
            const sid = s.id || s.sessionId || s.token || 'session';
            const isCurrent = sid === adminUser?.sessionId || s.isCurrent;
            const ip = s.ipAddress || '127.0.0.1';
            const ua = s.userAgent || s.browser || 'Web Browser';
            const activeTime = s.lastActive ? (typeof s.lastActive === 'number' ? new Date(s.lastActive).toLocaleTimeString() : String(s.lastActive)) : 'Just now';
            const loginTime = s.createdAt ? new Date(s.createdAt).toLocaleTimeString() : 'Recent';

            return (
              <div
                key={sid}
                className={`p-3 border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCurrent ? 'bg-blue-50 border-blue-900' : 'bg-zinc-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-200 border-2 border-black flex items-center justify-center font-pixel text-xs font-bold">
                    ID
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-zinc-950">{s.username}</span>
                      {getRoleBadge(s.role)}
                      {isCurrent && (
                        <span className="bg-blue-600 text-white font-pixel text-[8px] px-1.5 py-0.2 border border-black">
                          THIS DEVICE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      IP: {ip} • {ua}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <div className="text-right text-[11px] font-mono text-zinc-600">
                    <div>Logged in: {loginTime}</div>
                    <div className="text-zinc-400">Active: {activeTime}</div>
                  </div>

                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleTerminateSession(sid, s.username)}
                      className="p-1.5 bg-red-100 hover:bg-red-200 border-2 border-black text-red-900 shadow-[1px_1px_0px_#000] text-[10px] font-black uppercase flex items-center gap-1"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>KILL</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Brute Force Protection & Auto-lock Notice */}
      <div className="p-4 bg-zinc-900 text-white border-3 border-black shadow-[4px_4px_0px_#000] flex items-start gap-3">
        <AlertOctagon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed space-y-1">
          <div className="font-pixel text-[11px] text-red-400 uppercase font-black">
            AUTOMATED BRUTE FORCE DEFENSE ACTIVE
          </div>
          <p className="text-zinc-300 font-mono">
            IP addresses with 5 consecutive failed password attempts are automatically locked out for 15 minutes. All authentication events are cryptographically hashed and audit logged.
          </p>
        </div>
      </div>

      {/* Password Reset Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="mc-card p-6 bg-white border-3 border-black shadow-[8px_8px_0px_#000] max-w-sm w-full animate-in zoom-in-95 space-y-4">
            <div className="font-pixel text-xs text-zinc-900 uppercase">
              RESET PASSWORD: {resetModalUser.username}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-zinc-600 mb-1">
                New Password (min 6 characters)
              </label>
              <input
                type="password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="Enter new password"
                className="w-full p-2 border-2 border-black text-xs font-bold"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setResetModalUser(null);
                  setResetPasswordValue('');
                }}
                className="mc-btn-secondary py-2 px-3 text-xs font-black uppercase"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleExecutePasswordReset}
                className="mc-btn-success py-2 px-4 text-xs font-black uppercase"
              >
                SAVE PASSWORD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
