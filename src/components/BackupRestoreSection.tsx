import React, { useState, useRef } from 'react';
import { 
  DatabaseBackup, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  FileJson, 
  Clock, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { UploadSession } from '../types';
import { exportSystemBackupJSON, importSystemBackupJSON } from '../lib/submissionService';

interface BackupRestoreSectionProps {
  submissions: UploadSession[];
  onReloadRequested: () => void;
}

export const BackupRestoreSection: React.FC<BackupRestoreSectionProps> = ({
  submissions,
  onReloadRequested
}) => {
  const [restoreStatus, setRestoreStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateBackup = () => {
    exportSystemBackupJSON(submissions);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setRestoreStatus(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = importSystemBackupJSON(content);
      setIsRestoring(false);
      setRestoreStatus(result);
      if (result.success) {
        onReloadRequested();
      }
    };
    reader.onerror = () => {
      setIsRestoring(false);
      setRestoreStatus({ success: false, message: 'Failed to read backup file.' });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border-3 border-black shadow-[4px_4px_0px_#000]">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseBackup className="w-5 h-5 text-[#2563EB]" />
            <h2 className="font-pixel text-sm uppercase tracking-wider text-zinc-900">
              SYSTEM BACKUP & DISASTER RECOVERY
            </h2>
          </div>
          <p className="text-xs text-zinc-600 font-bold mt-1">
            Export complete system metadata snapshots and restore past records during migrations or hardware failure.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateBackup}
          className="mc-btn-success py-2.5 px-4 text-xs font-black uppercase flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>CREATE SYSTEM BACKUP (JSON)</span>
        </button>
      </div>

      {restoreStatus && (
        <div
          className={`p-4 border-3 border-black text-xs font-bold flex items-center gap-2.5 animate-in fade-in ${
            restoreStatus.success
              ? 'bg-emerald-100 text-emerald-950 border-emerald-900 shadow-[3px_3px_0px_#065f46]'
              : 'bg-red-100 text-red-950 border-red-900 shadow-[3px_3px_0px_#991b1b]'
          }`}
        >
          {restoreStatus.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
          )}
          <span>{restoreStatus.message}</span>
        </div>
      )}

      {/* Restore Card */}
      <div className="bg-white p-6 border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
        <h3 className="font-pixel text-xs text-zinc-900 uppercase pb-2 border-b-2 border-black">
          RESTORE FROM BACKUP FILE
        </h3>
        <p className="text-xs text-zinc-600 font-bold">
          Upload an official <span className="font-mono bg-zinc-100 px-1 border border-black">.json</span> backup file exported previously. All contained sessions, configuration parameters, and quarantine registries will be safely reconstructed and merged.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileSelected}
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="p-8 border-3 border-black border-dashed bg-zinc-50 hover:bg-amber-50/50 cursor-pointer text-center transition-colors shadow-[3px_3px_0px_#000]"
        >
          <FileJson className="w-8 h-8 text-[#2563EB] mx-auto mb-2" />
          <div className="mc-btn-primary py-2 px-4 text-xs font-black uppercase inline-block mb-1">
            {isRestoring ? 'IMPORTING BACKUP...' : 'SELECT BACKUP JSON FILE'}
          </div>
          <div className="text-[11px] text-zinc-500 font-semibold uppercase">
            or drag and drop .json backup file here
          </div>
        </div>
      </div>

      {/* Backup Schedule & Specifications Notice */}
      <div className="p-4 bg-zinc-100 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2 text-xs font-mono">
        <div className="font-pixel text-[10px] text-zinc-900 uppercase flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-700" />
          <span>BACKUP SPECIFICATIONS & PAYLOAD</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-zinc-700">
          <li>Snapshot format: Standard UTF-8 JSON with system schema v3.0</li>
          <li>Payload components: Upload sessions registry, file checksums, download logs, admin activity entries, and operational preferences</li>
          <li>Cloud files stored in Firebase Storage remain accessible via permanent cryptographically tokenized URLs</li>
        </ul>
      </div>
    </div>
  );
};
