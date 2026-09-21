import React, { useState } from 'react';
import { ShieldCheck, Lock, User, ArrowLeft, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface AdminLoginProps {
  onBackToCustomerView: () => void;
  onLoginSuccess: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onBackToCustomerView,
  onLoginSuccess
}) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
      onLoginSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid administrator username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen mc-pixel-bg py-10 px-4 flex flex-col justify-center items-center">
      <div className="max-w-md w-full mc-card p-6 sm:p-8 bg-white border-3 border-black shadow-[8px_8px_0px_#000]">
        {/* Top Back Navigation */}
        <button
          id="back-to-portal-btn"
          type="button"
          onClick={onBackToCustomerView}
          className="text-xs font-extrabold uppercase tracking-wider text-zinc-600 hover:text-black flex items-center gap-1.5 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customer Upload</span>
        </button>

        {/* Header Block */}
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 bg-[#2563EB] border-3 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center mb-3">
            <ShieldCheck className="w-8 h-8 text-[#FFD43B]" />
          </div>

          <div className="inline-block bg-[#0f172a] text-white px-3 py-1 border-2 border-black shadow-[2px_2px_0px_#000] text-[11px] font-black uppercase tracking-widest mb-2 font-pixel">
            STAFF CONSOLE
          </div>

          <h1 className="text-xl sm:text-2xl font-black uppercase text-zinc-950 tracking-tight">
            Super Admin Login
          </h1>
          <p className="text-xs text-zinc-600 mt-1 font-medium">
            Authorized Oyangoren Printing staff only. Access is strictly audited.
          </p>
        </div>

        {/* Error Notice */}
        {error && (
          <div
            id="admin-login-error"
            className="mb-4 p-3 bg-red-100 border-2 border-red-900 text-red-900 shadow-[2px_2px_0px_#991b1b] flex items-start gap-2 text-xs font-bold animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-700 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="admin-username"
              className="block text-xs font-black uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              Username
            </label>
            <div className="relative">
              <input
                id="admin-username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full mc-input pl-9 pr-3 py-2.5 text-sm text-zinc-900 font-medium placeholder-zinc-400"
              />
              <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-black uppercase tracking-wider text-zinc-800 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full mc-input pl-9 pr-10 py-2.5 text-sm text-zinc-900 font-medium placeholder-zinc-400"
              />
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3.5" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-800"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="admin-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full mc-btn-primary py-3 px-6 text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent"></span>
                <span>AUTHENTICATING...</span>
              </span>
            ) : (
              <span>SIGN IN TO DASHBOARD</span>
            )}
          </button>
        </form>

        {/* Security Notice */}
        <div className="mt-6 pt-4 border-t-2 border-dashed border-zinc-200 text-center">
          <p className="text-[11px] text-zinc-500 font-medium">
            🔒 Protected by salted PBKDF2 cryptography & signed session tokens.
          </p>
        </div>
      </div>
    </div>
  );
};
