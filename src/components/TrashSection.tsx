import React, { useState } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  File, 
  CheckSquare, 
  Square, 
  Calendar, 
  Clock, 
  HardDrive 
} from 'lucide-react';
import { UploadSession } from '../types';
import { formatFileSize, formatDate, formatTime } from '../lib/settings';
import { 
  restoreSubmissionFromTrash, 
  deletePermanently, 
  bulkRestoreFromTrash, 
  bulkDeletePermanently 
} from '../lib/submissionService';

interface TrashSectionProps {
  submissions: UploadSession[];
  onSubmissionRestored: (id: string) => void;
  onSubmissionDeletedPermanently: (id: string) => void;
}

export const TrashSection: React.FC<TrashSectionProps> = ({
  submissions,
  onSubmissionRestored,
  onSubmissionDeletedPermanently
}) => {
  const trashedSessions = submissions.filter((s) => s.isTrash);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sessionToDelete, setSessionToDelete] = useState<UploadSession | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const isAllSelected =
    trashedSessions.length > 0 && selectedIds.length === trashedSessions.length;

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(trashedSessions.map((s) => s.id));
    }
  };

  const handleRestoreSingle = async (session: UploadSession) => {
    await restoreSubmissionFromTrash(session.id);
    onSubmissionRestored(session.id);
  };

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    await bulkRestoreFromTrash(selectedIds);
    selectedIds.forEach((id) => onSubmissionRestored(id));
    setSelectedIds([]);
  };

  const confirmPermanentDeleteSingle = async () => {
    if (!sessionToDelete) return;
    await deletePermanently(sessionToDelete);
    onSubmissionDeletedPermanently(sessionToDelete.id);
    setSessionToDelete(null);
  };

  const confirmPermanentDeleteBulk = async () => {
    const toDelete = trashedSessions.filter((s) => selectedIds.includes(s.id));
    await bulkDeletePermanently(toDelete);
    selectedIds.forEach((id) => onSubmissionDeletedPermanently(id));
    setSelectedIds([]);
    setIsBulkDeleting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Description */}
      <div className="mc-card p-5 bg-white border-3 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 border-2 border-black flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-700" />
          </div>
          <div>
            <h2 className="text-base font-black uppercase text-zinc-950">
              Trash & Recycle Bin ({trashedSessions.length})
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Deleted sessions are preserved here safely before being permanently erased.
            </p>
          </div>
        </div>

        {/* Bulk Action Controls */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkRestore}
              className="mc-btn-primary py-2 px-3 text-xs font-black uppercase flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore ({selectedIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkDeleting(true)}
              className="mc-btn-danger py-2 px-3 text-xs font-black uppercase flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Permanently ({selectedIds.length})</span>
            </button>
          </div>
        )}
      </div>

      {trashedSessions.length === 0 ? (
        /* Empty State */
        <div className="mc-card p-12 bg-white border-3 border-black shadow-[4px_4px_0px_#000] text-center">
          <div className="w-14 h-14 bg-zinc-100 border-2 border-black mx-auto mb-3 flex items-center justify-center text-zinc-400">
            <Trash2 className="w-7 h-7" />
          </div>
          <h3 className="font-pixel text-xs text-zinc-900 uppercase mb-1">
            TRASH IS EMPTY
          </h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto font-medium">
            When you delete an upload session from the dashboard, it will be moved here for recovery or permanent deletion.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select all bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-200 border-2 border-black">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-xs font-black uppercase text-zinc-800 hover:text-black"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-700" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>Select All ({trashedSessions.length})</span>
            </button>

            <span className="text-[11px] font-bold text-zinc-600 font-mono">
              {selectedIds.length} Selected
            </span>
          </div>

          {/* Trashed items list */}
          <div className="space-y-3">
            {trashedSessions.map((session) => {
              const isSelected = selectedIds.includes(session.id);
              return (
                <div
                  key={session.id}
                  className={`mc-card p-4 sm:p-5 bg-white border-3 border-black shadow-[4px_4px_0px_#000] transition-colors ${
                    isSelected ? 'ring-2 ring-blue-600 bg-blue-50/20' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(session.id)}
                        className="mt-0.5"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-700" />
                        ) : (
                          <Square className="w-5 h-5 text-zinc-600" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-pixel text-xs text-zinc-950 font-bold">
                            {session.uploadId}
                          </span>
                          <span className="bg-red-100 text-red-800 border border-black text-[10px] font-black px-1.5 py-0.2 uppercase">
                            IN TRASH
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 font-medium">
                          <span className="flex items-center gap-1">
                            <File className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{session.fileCount} files</span>
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{formatFileSize(session.totalSize)}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{session.date}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{session.time}</span>
                          </span>
                        </div>

                        {session.trashedAt && (
                          <div className="text-[10px] text-red-600 font-bold uppercase mt-1">
                            Deleted: {formatDate(session.trashedAt)} at {formatTime(session.trashedAt)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleRestoreSingle(session)}
                        className="mc-btn-primary py-1.5 px-3 text-xs font-black uppercase flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>RESTORE</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSessionToDelete(session)}
                        className="mc-btn-danger py-1.5 px-3 text-xs font-black uppercase flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>DELETE PERMANENTLY</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Single Permanent Deletion */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="mc-card p-6 bg-white border-3 border-black shadow-[8px_8px_0px_#000] max-w-md w-full animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-red-700 font-pixel text-xs mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>PERMANENT DELETION CONFIRMATION</span>
            </div>

            <p className="text-sm font-bold text-zinc-900 mb-2">
              Are you sure you want to permanently delete these files? This action cannot be undone.
            </p>

            <p className="text-xs text-zinc-600 mb-4 bg-zinc-100 p-2.5 border border-black font-mono">
              Target Upload: <strong className="text-black">{sessionToDelete.uploadId}</strong> ({sessionToDelete.fileCount} files, {formatFileSize(sessionToDelete.totalSize)})
            </p>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="mc-btn-secondary py-2 px-4 text-xs font-black uppercase"
              >
                CANCEL
              </button>

              <button
                type="button"
                onClick={confirmPermanentDeleteSingle}
                className="mc-btn-danger py-2 px-4 text-xs font-black uppercase flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>YES, DELETE PERMANENTLY</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Bulk Permanent Deletion */}
      {isBulkDeleting && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="mc-card p-6 bg-white border-3 border-black shadow-[8px_8px_0px_#000] max-w-md w-full animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-red-700 font-pixel text-xs mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>PERMANENT BULK DELETION</span>
            </div>

            <p className="text-sm font-bold text-zinc-900 mb-2">
              Are you sure you want to permanently delete these {selectedIds.length} upload sessions? This action cannot be undone.
            </p>

            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => setIsBulkDeleting(false)}
                className="mc-btn-secondary py-2 px-4 text-xs font-black uppercase"
              >
                CANCEL
              </button>

              <button
                type="button"
                onClick={confirmPermanentDeleteBulk}
                className="mc-btn-danger py-2 px-4 text-xs font-black uppercase flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>CONFIRM PERMANENT DELETE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
