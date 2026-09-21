import React, { useState } from 'react';
import { History, X, Trash2, Filter } from 'lucide-react';
import { ActivityLog, ActivityAction } from '../types';
import { getStoredActivityLogs } from '../lib/settings';

interface AdminActivityLogModalProps {
  onClose: () => void;
}

export const AdminActivityLogModal: React.FC<AdminActivityLogModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<ActivityLog[]>(() => getStoredActivityLogs());
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const handleClearLogs = () => {
    if (window.confirm('Clear all stored activity logs?')) {
      localStorage.removeItem('oyangoren_admin_activity_log');
      setLogs([]);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterAction === 'ALL') return true;
    return log.action === filterAction;
  });

  const getActionBadgeColor = (action: ActivityAction) => {
    switch (action) {
      case 'Login':
        return 'bg-blue-100 text-blue-800 border-blue-900';
      case 'File Download':
      case 'Download All':
        return 'bg-emerald-100 text-emerald-800 border-emerald-900';
      case 'Status Change':
        return 'bg-amber-100 text-amber-800 border-amber-900';
      case 'Archive':
        return 'bg-purple-100 text-purple-800 border-purple-900';
      case 'Restore':
        return 'bg-cyan-100 text-cyan-800 border-cyan-900';
      case 'Delete':
      case 'Permanent Delete':
        return 'bg-red-100 text-red-800 border-red-900';
      case 'Settings Change':
        return 'bg-zinc-100 text-zinc-800 border-zinc-900';
      default:
        return 'bg-zinc-100 text-zinc-800 border-zinc-900';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="mc-card bg-white border-3 border-black shadow-[8px_8px_0px_#000] max-w-2xl w-full p-5 sm:p-6 my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 border-2 border-black flex items-center justify-center">
              <History className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-zinc-950">
                Super Admin Activity Log
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                Audited timeline of administrative downloads, status transitions, and session actions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-zinc-200 hover:bg-zinc-300 border-2 border-black"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-600" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="mc-input px-2.5 py-1 text-xs text-zinc-900 font-bold uppercase"
            >
              <option value="ALL">All Actions</option>
              <option value="File Download">File Download</option>
              <option value="Download All">Download All</option>
              <option value="Status Change">Status Change</option>
              <option value="Archive">Archive</option>
              <option value="Restore">Restore</option>
              <option value="Delete">Delete</option>
              <option value="Permanent Delete">Permanent Delete</option>
              <option value="Settings Change">Settings Change</option>
              <option value="Login">Login</option>
            </select>
          </div>

          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="text-[11px] font-bold text-red-700 hover:text-red-900 flex items-center gap-1 uppercase"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear Log</span>
            </button>
          )}
        </div>

        {/* Log Entries */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[250px]">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 font-pixel text-xs">
              NO ACTIVITY LOGGED YET
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-zinc-50 border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2 py-0.5 border font-black text-[10px] uppercase shadow-[1px_1px_0px_#000] ${getActionBadgeColor(
                      log.action
                    )}`}
                  >
                    {log.action}
                  </span>

                  <div>
                    {log.uploadId && (
                      <span className="font-mono font-bold text-blue-700 mr-2">
                        {log.uploadId}
                      </span>
                    )}
                    <span className="text-zinc-800 font-medium">{log.details || ''}</span>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-500 font-mono whitespace-nowrap self-end sm:self-center">
                  <span>{log.date} {log.time}</span> • <strong className="text-zinc-800">{log.admin}</strong>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
