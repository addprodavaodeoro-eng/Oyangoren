import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  RefreshCw,
  FileWarning
} from 'lucide-react';
import { QuarantinedFileRecord } from '../types';
import { formatFileSize, formatDate, formatTime } from '../lib/settings';
import { 
  getQuarantinedRecords, 
  releaseQuarantinedRecord, 
  deleteQuarantinedRecord,
  saveQuarantinedRecords,
  logAdminActivity
} from '../lib/submissionService';

interface QuarantineSectionProps {
  onFileRestored?: () => void;
}

export const QuarantineSection: React.FC<QuarantineSectionProps> = ({ onFileRestored }) => {
  const [records, setRecords] = useState<QuarantinedFileRecord[]>([]);

  const loadRecords = () => {
    setRecords(getQuarantinedRecords());
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleRelease = (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to release "${fileName}" from quarantine? Only release if you have verified the file is safe.`)) {
      return;
    }
    const updated = releaseQuarantinedRecord(fileId);
    setRecords(updated);
    logAdminActivity('Security Quarantine', fileId, `Admin manually released file "${fileName}" from quarantine.`);
    onFileRestored?.();
  };

  const handleDelete = (fileId: string, fileName: string) => {
    if (!confirm(`Permanently purge "${fileName}" from quarantine logs?`)) {
      return;
    }
    const updated = deleteQuarantinedRecord(fileId);
    setRecords(updated);
    logAdminActivity('Security Quarantine', fileId, `Admin permanently purged quarantined file "${fileName}".`);
    onFileRestored?.();
  };

  const handleClearAll = () => {
    if (!confirm('Clear all quarantine logs?')) return;
    saveQuarantinedRecords([]);
    setRecords([]);
    logAdminActivity('Security Quarantine', 'ALL', 'Admin cleared all quarantine records.');
    onFileRestored?.();
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border-3 border-black shadow-[4px_4px_0px_#000]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h2 className="font-pixel text-sm uppercase tracking-wider text-zinc-900">
              FILE QUARANTINE & MALWARE ISOLATION
            </h2>
          </div>
          <p className="text-xs text-zinc-600 font-bold mt-1">
            Suspicious files and blocked executables are automatically quarantined to protect company workstations.
          </p>
        </div>

        {records.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="mc-btn-secondary py-2 px-3 text-xs font-black uppercase text-red-700"
          >
            CLEAR QUARANTINE LOGS
          </button>
        )}
      </div>

      {/* Warning Notice Banner */}
      <div className="p-4 bg-amber-500 border-3 border-black text-black shadow-[4px_4px_0px_#000] flex items-start gap-3">
        <Lock className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-xs font-bold leading-relaxed">
          <span className="font-pixel text-[11px] block uppercase font-black">STRICT WORKSTATION PROTECTION</span>
          Quarantined files are completely isolated. They cannot be executed, previewed as live scripts, or downloaded without manual Super Admin override.
        </div>
      </div>

      {/* Quarantine Table */}
      <div className="bg-white border-3 border-black shadow-[4px_4px_0px_#000] overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-100 border-b-2 border-black text-zinc-900 font-pixel text-[10px] uppercase tracking-wider">
              <th className="p-3">File Name</th>
              <th className="p-3">Detection Reason</th>
              <th className="p-3">Session Ref</th>
              <th className="p-3">Size</th>
              <th className="p-3">Quarantined Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 font-mono">
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500 font-bold uppercase font-sans">
                  <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                  No files are currently in quarantine. System is clean and safe.
                </td>
              </tr>
            ) : (
              records.map((item) => {
                const displayName = item.fileName || item.name || 'Unnamed File';
                const sessionRef = item.submissionId || item.uploadId || item.sessionId || '—';
                const dateDisplay = item.detectedAt || item.date || '—';
                const targetKey = item.fileId || item.id;
                return (
                  <tr key={targetKey} className="hover:bg-red-50/40 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2 font-bold text-red-900">
                        <FileWarning className="w-4 h-4 text-red-600 shrink-0" />
                        <span className="truncate max-w-xs">{displayName}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="bg-red-100 text-red-900 border border-red-800 px-2 py-0.5 text-[10px] font-bold uppercase">
                        {item.reason}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-700">{sessionRef}</td>
                    <td className="p-3 text-zinc-700 font-bold">{formatFileSize(item.size)}</td>
                    <td className="p-3 text-zinc-600 text-[11px]">
                      {dateDisplay}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-sans">
                        <button
                          type="button"
                          onClick={() => handleRelease(targetKey, displayName)}
                          className="p-1.5 bg-emerald-100 hover:bg-emerald-200 border-2 border-black text-emerald-900 shadow-[1px_1px_0px_#000] text-[10px] font-black uppercase flex items-center gap-1"
                          title="Release file from quarantine"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>RELEASE</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(targetKey, displayName)}
                          className="p-1.5 bg-red-100 hover:bg-red-200 border-2 border-black text-red-900 shadow-[1px_1px_0px_#000] text-[10px] font-black uppercase"
                          title="Purge record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
