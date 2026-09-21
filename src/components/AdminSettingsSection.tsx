import React, { useState } from 'react';
import { 
  Save, 
  Check, 
  RotateCcw, 
  Sliders, 
  Shield, 
  KeyRound, 
  AlertCircle, 
  Lock, 
  Volume2, 
  Clock, 
  Palette, 
  History,
  Trash2,
  Globe,
  Smartphone,
  Radio,
  ExternalLink
} from 'lucide-react';
import { AdminSettings } from '../types';
import { 
  getStoredSettings, 
  saveStoredSettings, 
  DEFAULT_SETTINGS, 
  playNotificationSound,
  logAdminActivity,
  getEffectivePublicUploadUrl
} from '../lib/settings';
import { useAuth } from '../lib/AuthContext';
import { AdminActivityLogModal } from './AdminActivityLogModal';

export const AdminSettingsSection: React.FC = () => {
  const { changePassword, adminUser } = useAuth();
  const [settings, setSettings] = useState<AdminSettings>(getStoredSettings());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredSettings(settings);
    logAdminActivity('Settings Change', undefined, `Updated retention: ${settings.autoDeleteDays} days, sound: ${settings.soundNotification ? 'on' : 'off'}`);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all portal settings to default values?')) {
      setSettings(DEFAULT_SETTINGS);
      saveStoredSettings(DEFAULT_SETTINGS);
      logAdminActivity('Settings Change', undefined, 'Reset settings to default');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  const handleTestSound = () => {
    playNotificationSound();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password confirmation does not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordSuccess('Password successfully updated and securely hashed.');
        logAdminActivity('Settings Change', undefined, 'Admin password changed');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Activity Log Quick Launcher */}
      <div className="mc-card p-4 bg-blue-50 border-3 border-blue-900 shadow-[4px_4px_0px_#1e3a8a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 border-2 border-black flex items-center justify-center">
            <History className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black uppercase text-blue-950">
              Audit & Activity Tracking
            </h3>
            <p className="text-[11px] text-blue-800 font-medium">
              View all admin actions, downloads, and status transitions.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowActivityLogModal(true)}
          className="mc-btn-yellow py-2 px-3 text-xs font-black uppercase flex items-center gap-1.5 self-start sm:self-auto"
        >
          <History className="w-3.5 h-3.5" />
          <span>VIEW ACTIVITY LOG</span>
        </button>
      </div>

      {/* Super Admin Security Section */}
      <div className="mc-card p-5 sm:p-6 bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
        <div className="flex items-center gap-2.5 pb-3 border-b-2 border-black mb-4">
          <div className="w-8 h-8 bg-blue-100 border-2 border-black flex items-center justify-center">
            <Shield className="w-4 h-4 text-blue-700" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black uppercase text-zinc-950">
              Super Admin Security
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Administrator credentials are cryptographically protected via PBKDF2/HMAC with high-iteration salt.
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
          <div className="bg-zinc-50 border border-zinc-300 p-3 text-xs text-zinc-700 font-mono">
            <span>Current Admin User: </span>
            <strong className="text-zinc-900">{adminUser?.username || 'admin'}</strong>
          </div>

          {passwordError && (
            <div className="p-3 bg-red-50 border-2 border-red-800 text-red-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 bg-emerald-50 border-2 border-emerald-800 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-800 uppercase mb-1">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full mc-input px-3 py-2 text-xs sm:text-sm text-zinc-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-800 uppercase mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full mc-input px-3 py-2 text-xs sm:text-sm text-zinc-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-800 uppercase mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="w-full mc-input px-3 py-2 text-xs sm:text-sm text-zinc-900"
              />
            </div>
          </div>

          <button
            id="change-password-btn"
            type="submit"
            disabled={passwordLoading}
            className="mc-btn-primary py-2 px-4 text-xs font-black uppercase flex items-center gap-2 shadow-[2px_2px_0px_#000]"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{passwordLoading ? 'UPDATING...' : 'UPDATE ADMIN PASSWORD'}</span>
          </button>
        </form>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {savedSuccess && (
          <div className="p-3.5 bg-emerald-100 border-3 border-emerald-900 text-emerald-900 text-xs font-bold flex items-center gap-2 shadow-[3px_3px_0px_#065f46]">
            <Check className="w-4 h-4 text-emerald-800" />
            <span>Settings successfully updated!</span>
          </div>
        )}

        {/* Retention Policy & Storage Management */}
        <div className="mc-card p-5 sm:p-6 bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
          <div className="flex items-center gap-2.5 pb-3 border-b-2 border-black mb-4">
            <div className="w-8 h-8 bg-red-100 border-2 border-black flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-700" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-zinc-950">
                Data Retention & Auto Cleanup
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                Automatically clean up old files after customer printing jobs are completed.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                Auto-Delete / Retention Period
              </label>
              <select
                value={settings.autoDeleteDays}
                onChange={(e) => setSettings({ ...settings, autoDeleteDays: Number(e.target.value) })}
                className="w-full mc-input px-3 py-2 text-sm text-zinc-900 font-bold uppercase"
              >
                <option value={1}>1 Day (24 Hours)</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days (1 Week - Recommended)</option>
                <option value={14}>14 Days (2 Weeks)</option>
                <option value={30}>30 Days (1 Month)</option>
                <option value={0}>Never (Manual Deletion Only)</option>
              </select>
              <p className="text-[11px] text-zinc-500 mt-1">
                Files older than the retention threshold will be automatically moved to Trash to maintain storage quotas.
              </p>
            </div>
          </div>
        </div>

        {/* Real-time Notifications & Sound */}
        <div className="mc-card p-5 sm:p-6 bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
          <div className="flex items-center gap-2.5 pb-3 border-b-2 border-black mb-4">
            <div className="w-8 h-8 bg-amber-100 border-2 border-black flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-amber-800" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-zinc-950">
                Audio Notifications & Alerts
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                Audio chime alerts when a customer scans and uploads files at the store counter.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.soundNotification}
                onChange={(e) => setSettings({ ...settings, soundNotification: e.target.checked })}
                className="w-4 h-4 rounded-none text-blue-600 border-2 border-black"
              />
              <span className="text-xs font-bold text-zinc-800 uppercase">
                Play alert chime sound when new files are uploaded
              </span>
            </label>

            <div>
              <button
                type="button"
                onClick={handleTestSound}
                className="mc-btn-secondary py-1.5 px-3 text-xs font-black uppercase flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>TEST AUDIO CHIME</span>
              </button>
            </div>
          </div>
        </div>

        {/* Portal Branding & Display */}
        <div className="mc-card p-5 sm:p-6 bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
          <div className="flex items-center gap-2.5 pb-3 border-b-2 border-black mb-4">
            <div className="w-8 h-8 bg-amber-100 border-2 border-black flex items-center justify-center">
              <Sliders className="w-4 h-4 text-amber-800" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-zinc-950">
                Portal Branding & Display
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                Public titles displayed to customers when scanning the permanent QR code.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                Business / Organization Name
              </label>
              <input
                type="text"
                value={settings.businessName}
                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                className="w-full mc-input px-3 py-2 text-sm text-zinc-900 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                Upload Button Label
              </label>
              <input
                type="text"
                value={settings.uploadButtonText}
                onChange={(e) => setSettings({ ...settings, uploadButtonText: e.target.value })}
                className="w-full mc-input px-3 py-2 text-sm text-zinc-900 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Public Cloud Domain & Cross-Network Availability */}
        <div className="mc-card p-5 sm:p-6 bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
          <div className="flex items-center gap-2.5 pb-3 border-b-2 border-black mb-4">
            <div className="w-8 h-8 bg-emerald-100 border-2 border-black flex items-center justify-center">
              <Globe className="w-4 h-4 text-emerald-800" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-zinc-950">
                Public Cloud Domain & Network Settings
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                Configure the public HTTPS domain for customer QR codes so customers can upload from any network (Mobile Data, 4G/5G, Wi-Fi).
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 font-medium space-y-1.5">
              <div className="flex items-center gap-1.5 font-extrabold text-emerald-900 uppercase">
                <Smartphone className="w-4 h-4" />
                <span>Active Public Upload URL for Customer QR Codes</span>
              </div>
              <p>
                Permanent Route: <code className="bg-emerald-100 px-1.5 py-0.5 text-emerald-950 font-bold break-all">{getEffectivePublicUploadUrl(settings)}</code>
              </p>
              <p className="text-[11px] text-emerald-800">
                Customers do NOT need to be on the store Wi-Fi. Mobile Data, 4G, 5G, and any external Wi-Fi network are fully supported.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                Production Web App URL (Optional Custom / Cloud URL)
              </label>
              <input
                type="text"
                placeholder="https://oyangoren-upload.web.app or https://ais-pre-4nftuh3gtfkewmsaq4futd-176505772096.asia-southeast1.run.app"
                value={settings.productionUrl || ''}
                onChange={(e) => setSettings({ ...settings, productionUrl: e.target.value })}
                className="w-full mc-input px-3 py-2 text-sm text-zinc-900 font-medium"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Leave empty to automatically use the public cloud hosting URL. Never use localhost for customer QR posters.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                Custom Domain (e.g. upload.oyangoren.com)
              </label>
              <input
                type="text"
                placeholder="upload.oyangoren.com"
                value={settings.customDomain || ''}
                onChange={(e) => setSettings({ ...settings, customDomain: e.target.value })}
                className="w-full mc-input px-3 py-2 text-sm text-zinc-900 font-medium"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Connect your business custom domain with HTTPS. The permanent customer path will always be <code>/upload</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Limits & Controls */}
        <div className="mc-card p-5 sm:p-6 bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
          <div className="flex items-center gap-2.5 pb-3 border-b-2 border-black mb-4">
            <div className="w-8 h-8 bg-blue-100 border-2 border-black flex items-center justify-center">
              <Lock className="w-4 h-4 text-blue-800" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-zinc-950">
                Upload Limits & Polling
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                Configure size thresholds and dashboard refresh frequencies.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                Max File Size (MB)
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={settings.maxFileSizeMB}
                onChange={(e) => setSettings({ ...settings, maxFileSizeMB: Number(e.target.value) })}
                className="w-full mc-input px-3 py-2 text-sm text-zinc-900 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                Max Files Per Upload Session
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.maxFilesPerSubmission}
                onChange={(e) => setSettings({ ...settings, maxFilesPerSubmission: Number(e.target.value) })}
                className="w-full mc-input px-3 py-2 text-sm text-zinc-900 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase mb-1">
                Refresh Frequency (sec)
              </label>
              <select
                value={settings.refreshIntervalSeconds}
                onChange={(e) => setSettings({ ...settings, refreshIntervalSeconds: Number(e.target.value) })}
                className="w-full mc-input px-3 py-2 text-sm text-zinc-900 font-bold"
              >
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
              </select>
            </div>
          </div>

          {/* Workflow Automation Toggles */}
          <div className="mt-5 pt-4 border-t border-zinc-200 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoMarkDownloaded}
                onChange={(e) => setSettings({ ...settings, autoMarkDownloaded: e.target.checked })}
                className="w-4 h-4 rounded-none text-blue-600 border-2 border-black"
              />
              <span className="text-xs font-bold text-zinc-800 uppercase">
                Automatically transition session status from NEW/OPENED to DOWNLOADED upon file download
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableZipDownload}
                onChange={(e) => setSettings({ ...settings, enableZipDownload: e.target.checked })}
                className="w-4 h-4 rounded-none text-blue-600 border-2 border-black"
              />
              <span className="text-xs font-bold text-zinc-800 uppercase">
                Enable "Download All (ZIP)" feature for upload sessions
              </span>
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            id="reset-settings-btn"
            type="button"
            onClick={handleResetDefaults}
            className="mc-btn-secondary text-xs font-bold px-4 py-2 flex items-center gap-1.5 uppercase"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            id="save-settings-submit-btn"
            type="submit"
            className="mc-btn-success text-xs sm:text-sm font-extrabold px-6 py-2.5 flex items-center gap-2 uppercase"
          >
            <Save className="w-4 h-4" />
            <span>SAVE CONFIGURATION</span>
          </button>
        </div>
      </form>

      {/* Activity Log Modal */}
      {showActivityLogModal && (
        <AdminActivityLogModal onClose={() => setShowActivityLogModal(false)} />
      )}
    </div>
  );
};
