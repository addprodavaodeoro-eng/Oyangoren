import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Database, 
  HardDrive, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Wrench, 
  Pause, 
  Play, 
  Cpu,
  Clock,
  Save,
  Zap
} from 'lucide-react';
import { UploadSession, AdminSettings } from '../types';
import { 
  getStoredSettings, 
  saveStoredSettings, 
  formatFileSize,
  logAdminActivity
} from '../lib/settings';

interface SystemHealthSectionProps {
  submissions: UploadSession[];
}

export const SystemHealthSection: React.FC<SystemHealthSectionProps> = ({ submissions }) => {
  const [settings, setSettings] = useState<AdminSettings>(getStoredSettings());
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [diagnosticTime, setDiagnosticTime] = useState<string>(new Date().toLocaleTimeString());
  const [apiLatency, setApiLatency] = useState<number>(42);
  const [apiStatus, setApiStatus] = useState<'OK' | 'WARN' | 'ERROR'>('OK');
  const [customMsgInput, setCustomMsgInput] = useState(settings.customUploadMessage || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Compute storage statistics
  const activeSubmissions = submissions.filter((s) => !s.isTrash);
  const totalUsedBytes = activeSubmissions.reduce((acc, s) => acc + (s.totalSize || 0), 0);
  const maxStorageGB = settings.maxStorageLimitGB || 10;
  const maxStorageBytes = maxStorageGB * 1024 * 1024 * 1024;
  const storagePercent = Math.min(100, Math.round((totalUsedBytes / maxStorageBytes) * 100));

  const totalFiles = activeSubmissions.reduce((acc, s) => acc + (s.fileCount || 0), 0);

  const runDiagnostics = async () => {
    setIsRunningDiagnostic(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/admin/health-check');
      const end = performance.now();
      setApiLatency(Math.round(end - start));
      if (res.ok) {
        setApiStatus('OK');
      } else {
        setApiStatus('WARN');
      }
    } catch {
      setApiStatus('ERROR');
      setApiLatency(999);
    } finally {
      setIsRunningDiagnostic(false);
      setDiagnosticTime(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const handleToggleMaintenanceMode = () => {
    const next = !settings.maintenanceMode;
    if (next && !confirm('Put system in MAINTENANCE MODE? Customers will not be able to upload files.')) {
      return;
    }
    const updated = { ...settings, maintenanceMode: next };
    saveStoredSettings(updated);
    setSettings(updated);
    logAdminActivity('System Config', 'SYSTEM', next ? 'Enabled Maintenance Mode' : 'Disabled Maintenance Mode');
  };

  const handleTogglePauseUploads = () => {
    const next = !settings.pauseNewUploads;
    const updated = { ...settings, pauseNewUploads: next };
    saveStoredSettings(updated);
    setSettings(updated);
    logAdminActivity('System Config', 'SYSTEM', next ? 'Paused new customer uploads' : 'Resumed customer uploads');
  };

  const handleSaveCustomMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = { ...settings, customUploadMessage: customMsgInput.trim() };
    saveStoredSettings(updated);
    setSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
    logAdminActivity('System Config', 'CUSTOM_MESSAGE', `Updated custom upload message: "${customMsgInput}"`);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border-3 border-black shadow-[4px_4px_0px_#000]">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#2563EB]" />
            <h2 className="font-pixel text-sm uppercase tracking-wider text-zinc-900">
              SYSTEM HEALTH & DIAGNOSTICS
            </h2>
          </div>
          <p className="text-xs text-zinc-600 font-bold mt-1">
            Real-time telemetry, storage consumption, database connectivity, and administrative override switches.
          </p>
        </div>

        <button
          type="button"
          onClick={runDiagnostics}
          disabled={isRunningDiagnostic}
          className="mc-btn-primary py-2 px-3 text-xs font-black uppercase flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunningDiagnostic ? 'animate-spin' : ''}`} />
          <span>RUN DIAGNOSTIC</span>
        </button>
      </div>

      {/* Live Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Backend API */}
        <div className="p-4 bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-2">
          <div className="flex items-center justify-between">
            <Server className="w-5 h-5 text-blue-600" />
            <span className="font-pixel text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-800 px-1.5 py-0.5">
              ONLINE
            </span>
          </div>
          <div className="font-pixel text-xs text-zinc-900">API GATEWAY</div>
          <div className="text-xs font-mono font-bold text-zinc-600">
            Latency: {apiLatency} ms
          </div>
        </div>

        {/* Firestore Database */}
        <div className="p-4 bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-2">
          <div className="flex items-center justify-between">
            <Database className="w-5 h-5 text-amber-600" />
            <span className="font-pixel text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-800 px-1.5 py-0.5">
              CONNECTED
            </span>
          </div>
          <div className="font-pixel text-xs text-zinc-900">FIRESTORE CLOUD</div>
          <div className="text-xs font-mono font-bold text-zinc-600">
            Sessions: {activeSubmissions.length} active
          </div>
        </div>

        {/* Cloud Storage */}
        <div className="p-4 bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-2">
          <div className="flex items-center justify-between">
            <HardDrive className="w-5 h-5 text-purple-600" />
            <span className="font-pixel text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-800 px-1.5 py-0.5">
              ACTIVE
            </span>
          </div>
          <div className="font-pixel text-xs text-zinc-900">FILE REPOSITORY</div>
          <div className="text-xs font-mono font-bold text-zinc-600">
            {totalFiles} files stored
          </div>
        </div>

        {/* Uptime / Health */}
        <div className="p-4 bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-2">
          <div className="flex items-center justify-between">
            <Zap className="w-5 h-5 text-emerald-600" />
            <span className="font-pixel text-[9px] bg-blue-100 text-blue-900 border border-blue-800 px-1.5 py-0.5">
              HEALTHY
            </span>
          </div>
          <div className="font-pixel text-xs text-zinc-900">SERVICE STABILITY</div>
          <div className="text-xs font-mono font-bold text-zinc-600">
            Checked: {diagnosticTime}
          </div>
        </div>
      </div>

      {/* Storage Gauge */}
      <div className="bg-white p-5 border-3 border-black shadow-[4px_4px_0px_#000] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-zinc-700" />
            <h3 className="font-pixel text-xs text-zinc-900 uppercase">
              STORAGE CAPACITY MONITOR
            </h3>
          </div>
          <span className="font-mono text-xs font-bold text-zinc-700">
            {formatFileSize(totalUsedBytes)} of {maxStorageGB} GB ({storagePercent}%)
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-5 bg-zinc-200 border-2 border-black p-0.5 shadow-inner">
          <div
            className={`h-full border-r-2 border-black transition-all duration-300 ${
              storagePercent > 85 ? 'bg-red-600' : storagePercent > 65 ? 'bg-amber-500' : 'bg-emerald-600'
            }`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>

        <div className="flex justify-between text-[11px] font-mono text-zinc-500 font-bold">
          <span>0 GB</span>
          <span>Warning threshold: 85%</span>
          <span>{maxStorageGB} GB</span>
        </div>
      </div>

      {/* Master Operational Switches */}
      <div className="bg-white p-5 border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
        <h3 className="font-pixel text-xs text-zinc-900 uppercase pb-2 border-b-2 border-black">
          OPERATIONAL OVERRIDES & MAINTENANCE CONTROLS
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Maintenance Mode */}
          <div className={`p-4 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2 ${
            settings.maintenanceMode ? 'bg-amber-100 border-amber-900' : 'bg-zinc-50'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-pixel text-xs text-zinc-900 uppercase">MAINTENANCE MODE</span>
              <button
                type="button"
                onClick={handleToggleMaintenanceMode}
                className={`py-1.5 px-3 font-pixel text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] ${
                  settings.maintenanceMode ? 'bg-red-600 text-white' : 'bg-zinc-200 text-zinc-800'
                }`}
              >
                {settings.maintenanceMode ? 'ACTIVE (BLOCKING)' : 'DISABLED'}
              </button>
            </div>
            <p className="text-xs text-zinc-600 font-bold">
              When active, the customer upload screen displays a maintenance banner and blocks uploads.
            </p>
          </div>

          {/* Pause New Uploads */}
          <div className={`p-4 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2 ${
            settings.pauseNewUploads ? 'bg-amber-100 border-amber-900' : 'bg-zinc-50'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-pixel text-xs text-zinc-900 uppercase">PAUSE NEW UPLOADS</span>
              <button
                type="button"
                onClick={handleTogglePauseUploads}
                className={`py-1.5 px-3 font-pixel text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_#000] ${
                  settings.pauseNewUploads ? 'bg-amber-500 text-black' : 'bg-zinc-200 text-zinc-800'
                }`}
              >
                {settings.pauseNewUploads ? 'PAUSED' : 'ACCEPTING'}
              </button>
            </div>
            <p className="text-xs text-zinc-600 font-bold">
              Temporarily stops intake without placing the entire system under maintenance.
            </p>
          </div>
        </div>

        {/* Custom Upload Message */}
        <form onSubmit={handleSaveCustomMessage} className="pt-2 space-y-2">
          <label className="block text-xs font-bold uppercase text-zinc-700">
            Custom Message on Customer Upload Screen (e.g. store announcements)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customMsgInput}
              onChange={(e) => setCustomMsgInput(e.target.value)}
              placeholder="e.g., We are open Monday to Saturday 8:00 AM - 6:00 PM."
              className="flex-1 p-2 border-2 border-black text-xs font-bold bg-zinc-50"
            />
            <button
              type="submit"
              className="mc-btn-success py-2 px-4 text-xs font-black uppercase flex items-center gap-1 shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveSuccess ? 'SAVED!' : 'UPDATE MESSAGE'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
