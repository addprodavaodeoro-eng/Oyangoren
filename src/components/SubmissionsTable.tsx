import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  ChevronRight, 
  Clock, 
  Calendar, 
  Layers,
  CheckSquare,
  Square,
  Download,
  CheckCircle2,
  Archive,
  Trash2,
  Smartphone,
  Laptop,
  Eye,
  Filter,
  Pin,
  Tag,
  MessageSquare
} from 'lucide-react';
import JSZip from 'jszip';
import { UploadSession, UploadStatus } from '../types';
import { formatFileSize, formatDate, formatTime } from '../lib/settings';
import { StatusBadge } from './StatusBadge';
import { 
  bulkUpdateStatus, 
  bulkMoveToTrash, 
  moveSubmissionToTrash,
  deletePermanently,
  markSessionDownloaded 
} from '../lib/submissionService';

interface SubmissionsTableProps {
  submissions: UploadSession[];
  onSelectSubmission: (submission: UploadSession) => void;
  onRefreshData?: () => void;
  onSubmissionUpdated?: (updated: UploadSession) => void;
  onSubmissionDeleted?: (id: string) => void;
}

export const SubmissionsTable: React.FC<SubmissionsTableProps> = ({
  submissions,
  onSelectSubmission,
  onRefreshData,
  onSubmissionUpdated,
  onSubmissionDeleted
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'TODAY' | 'DOWNLOADED' | 'COMPLETED' | 'ARCHIVED'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH'>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'size_desc' | 'size_asc' | 'files_desc' | 'files_asc'>('newest');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  // Filter out any trashed sessions
  const activeSubmissions = useMemo(() => {
    return submissions.filter((s) => !s.isTrash);
  }, [submissions]);

  // Apply filters and sorting
  const filteredSubmissions = useMemo(() => {
    let result = [...activeSubmissions];
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Date Filter
    if (dateFilter !== 'ALL') {
      const oneDay = 24 * 60 * 60 * 1000;
      result = result.filter((s) => {
        const subDate = new Date(s.createdAt);
        const diffMs = now.getTime() - subDate.getTime();

        if (dateFilter === 'TODAY') {
          return s.date === todayStr || subDate.toDateString() === now.toDateString();
        }
        if (dateFilter === 'YESTERDAY') {
          const yesterday = new Date(now.getTime() - oneDay);
          return subDate.toDateString() === yesterday.toDateString();
        }
        if (dateFilter === 'WEEK') {
          return diffMs <= 7 * oneDay;
        }
        if (dateFilter === 'MONTH') {
          return diffMs <= 30 * oneDay;
        }
        return true;
      });
    }

    // Status Filter
    if (statusFilter === 'TODAY') {
      result = result.filter((s) => s.date === todayStr);
    } else if (statusFilter !== 'ALL') {
      result = result.filter((s) => (s.status || 'NEW').toUpperCase() === statusFilter);
    }

    // Search filter: Upload ID, filenames, extensions
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((s) => {
        const matchesUploadId = s.uploadId?.toLowerCase().includes(term);
        const matchesDate = s.date?.toLowerCase().includes(term);
        const matchesFile = s.files?.some((f) => 
          f.name.toLowerCase().includes(term) || f.type?.toLowerCase().includes(term)
        );
        return matchesUploadId || matchesDate || matchesFile;
      });
    }

    // Sorting (Pinned sessions always stay on top unless explicit custom sorting)
    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();

      if (sortBy === 'newest') return timeB - timeA;
      if (sortBy === 'oldest') return timeA - timeB;
      if (sortBy === 'size_desc') return (b.totalSize || 0) - (a.totalSize || 0);
      if (sortBy === 'size_asc') return (a.totalSize || 0) - (b.totalSize || 0);
      if (sortBy === 'files_desc') return (b.fileCount || 0) - (a.fileCount || 0);
      if (sortBy === 'files_asc') return (a.fileCount || 0) - (b.fileCount || 0);
      return 0;
    });

    return result;
  }, [activeSubmissions, statusFilter, dateFilter, searchTerm, sortBy]);

  // Counts for pills
  const newCount = activeSubmissions.filter((s) => (s.status || 'NEW').toUpperCase() === 'NEW').length;
  const downloadedCount = activeSubmissions.filter((s) => (s.status || '').toUpperCase() === 'DOWNLOADED').length;
  const completedCount = activeSubmissions.filter((s) => (s.status || '').toUpperCase() === 'COMPLETED').length;
  const archivedCount = activeSubmissions.filter((s) => (s.status || '').toUpperCase() === 'ARCHIVED').length;

  const isAllSelected =
    filteredSubmissions.length > 0 && selectedIds.length === filteredSubmissions.length;

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSubmissions.map((s) => s.id));
    }
  };

  // Bulk action: Mark Completed
  const handleBulkMarkCompleted = async () => {
    if (selectedIds.length === 0) return;
    await bulkUpdateStatus(selectedIds, 'COMPLETED');
    setSelectedIds([]);
    onRefreshData?.();
  };

  // Bulk action: Archive
  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    await bulkUpdateStatus(selectedIds, 'ARCHIVED');
    setSelectedIds([]);
    onRefreshData?.();
  };

  // Bulk action: Move to Trash
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Move ${selectedIds.length} upload session(s) to Trash?`)) {
      const idsToDelete = [...selectedIds];
      await bulkMoveToTrash(idsToDelete);
      if (onSubmissionDeleted) {
        idsToDelete.forEach((id) => onSubmissionDeleted(id));
      }
      setSelectedIds([]);
      onRefreshData?.();
    }
  };

  // Quick action: Move single session to trash
  const handleQuickDelete = async (session: UploadSession, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Move upload session "${session.uploadId}" to Trash?`)) {
      await moveSubmissionToTrash(session.id);
      if (onSubmissionDeleted) {
        onSubmissionDeleted(session.id);
      }
      onRefreshData?.();
    }
  };

  // Bulk action: Download Selected ZIPs
  const handleBulkDownload = async () => {
    const sessionsToDownload = activeSubmissions.filter((s) => selectedIds.includes(s.id));
    if (sessionsToDownload.length === 0) return;

    setIsBulkDownloading(true);
    try {
      for (const session of sessionsToDownload) {
        if (!session.files || session.files.length === 0) continue;
        const zip = new JSZip();

        for (const file of session.files) {
          const fileUrl = file.downloadUrl || file.previewUrl;
          if (fileUrl) {
            try {
              const res = await fetch(fileUrl);
              const blob = await res.blob();
              zip.file(file.name, blob);
            } catch {
              zip.file(file.name, `File: ${file.name}\nSize: ${file.size}`);
            }
          } else {
            zip.file(file.name, `File: ${file.name}`);
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = `${session.uploadId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        await markSessionDownloaded(session.id);
      }
      setSelectedIds([]);
      onRefreshData?.();
    } catch (err) {
      console.error('Bulk download error:', err);
    } finally {
      setIsBulkDownloading(false);
    }
  };

  // Quick download for individual session from card
  const handleQuickDownloadAll = async (session: UploadSession, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session.files || session.files.length === 0) return;

    try {
      const zip = new JSZip();
      for (const file of session.files) {
        const fileUrl = file.downloadUrl || file.previewUrl;
        if (fileUrl) {
          try {
            const res = await fetch(fileUrl);
            const blob = await res.blob();
            zip.file(file.name, blob);
          } catch {
            zip.file(file.name, `File: ${file.name}`);
          }
        } else {
          zip.file(file.name, `File: ${file.name}`);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${session.uploadId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      await markSessionDownloaded(session.id);
      onRefreshData?.();
    } catch (err) {
      console.error('Quick download error:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="mc-card p-3 sm:p-4 bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              id="admin-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Upload ID (e.g. UPLOAD-20260921-001), file name, or type (.pdf)..."
              className="w-full mc-input pl-9 pr-3 py-2 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 font-medium"
            />
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
          </div>

          {/* Date & Sort Filters */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Date filter dropdown */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="mc-input px-2.5 py-2 text-xs font-bold text-zinc-800 uppercase bg-white cursor-pointer"
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>

            {/* Sort dropdown */}
            <select
              id="admin-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="mc-input px-2.5 py-2 text-xs font-bold text-zinc-800 uppercase bg-white cursor-pointer"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="size_desc">Sort: Largest Upload</option>
              <option value="size_asc">Sort: Smallest Upload</option>
              <option value="files_desc">Sort: Most Files</option>
              <option value="files_asc">Sort: Least Files</option>
            </select>
          </div>
        </div>

        {/* Status Pill Tabs */}
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-zinc-200">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1 text-xs font-black uppercase tracking-wider border-2 border-black transition-all ${
              statusFilter === 'ALL'
                ? 'bg-black text-white shadow-[2px_2px_0px_#000]'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
            }`}
          >
            ALL ({activeSubmissions.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('NEW')}
            className={`px-3 py-1 text-xs font-black uppercase tracking-wider border-2 border-black transition-all flex items-center gap-1.5 ${
              statusFilter === 'NEW'
                ? 'bg-[#FFD43B] text-black shadow-[2px_2px_0px_#000]'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block"></span>
            <span>NEW ({newCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('TODAY')}
            className={`px-3 py-1 text-xs font-black uppercase tracking-wider border-2 border-black transition-all ${
              statusFilter === 'TODAY'
                ? 'bg-blue-600 text-white shadow-[2px_2px_0px_#000]'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
            }`}
          >
            TODAY
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('DOWNLOADED')}
            className={`px-3 py-1 text-xs font-black uppercase tracking-wider border-2 border-black transition-all ${
              statusFilter === 'DOWNLOADED'
                ? 'bg-[#2563EB] text-white shadow-[2px_2px_0px_#000]'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
            }`}
          >
            DOWNLOADED ({downloadedCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-1 text-xs font-black uppercase tracking-wider border-2 border-black transition-all ${
              statusFilter === 'COMPLETED'
                ? 'bg-[#16a34a] text-white shadow-[2px_2px_0px_#000]'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
            }`}
          >
            COMPLETED ({completedCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ARCHIVED')}
            className={`px-3 py-1 text-xs font-black uppercase tracking-wider border-2 border-black transition-all ${
              statusFilter === 'ARCHIVED'
                ? 'bg-zinc-500 text-white shadow-[2px_2px_0px_#000]'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
            }`}
          >
            ARCHIVED ({archivedCount})
          </button>
        </div>
      </div>

      {/* Multi-Select Action Bar (Shows when items are checked) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-2 bg-zinc-100 border-2 border-black">
        <div className="flex items-center gap-2">
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
            <span>Select All ({filteredSubmissions.length})</span>
          </button>

          {selectedIds.length > 0 && (
            <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 border border-black">
              {selectedIds.length} Selected
            </span>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={isBulkDownloading}
              onClick={handleBulkDownload}
              className="mc-btn-success py-1.5 px-2.5 text-[11px] font-black uppercase flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isBulkDownloading ? 'Zipping...' : 'DOWNLOAD SELECTED'}</span>
            </button>

            <button
              type="button"
              onClick={handleBulkMarkCompleted}
              className="mc-btn-primary py-1.5 px-2.5 text-[11px] font-black uppercase flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>MARK COMPLETED</span>
            </button>

            <button
              type="button"
              onClick={handleBulkArchive}
              className="mc-btn-secondary py-1.5 px-2.5 text-[11px] font-black uppercase flex items-center gap-1"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>ARCHIVE</span>
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              className="mc-btn-danger py-1.5 px-2.5 text-[11px] font-black uppercase flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>DELETE</span>
            </button>
          </div>
        )}
      </div>

      {/* Upload Sessions Listing (Responsive Mobile Cards & Desktop Table) */}
      {filteredSubmissions.length === 0 ? (
        <div className="mc-card p-10 bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-center">
          <Layers className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
          <h3 className="text-base font-black uppercase text-zinc-900 font-pixel">
            No Upload Sessions Found
          </h3>
          <p className="text-xs text-zinc-600 mt-1">
            {searchTerm || statusFilter !== 'ALL' || dateFilter !== 'ALL'
              ? 'Try changing or clearing your search / status filters.'
              : 'Customer uploads will appear here in real-time as soon as files are uploaded.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredSubmissions.map((session) => {
            const isSelected = selectedIds.includes(session.id);
            const isNew = (session.status || 'NEW').toUpperCase() === 'NEW';

            return (
              <div
                key={session.id}
                onClick={() => onSelectSubmission(session)}
                className={`mc-card p-4 sm:p-5 bg-white border-3 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all cursor-pointer ${
                  isSelected ? 'ring-2 ring-blue-600 bg-blue-50/20' : ''
                } ${isNew ? 'ring-2 ring-[#FFD43B]' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Column: Checkbox, Upload ID + Date/Time */}
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={(e) => handleToggleSelect(session.id, e)}
                      className="mt-1"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-700" />
                      ) : (
                        <Square className="w-5 h-5 text-zinc-600" />
                      )}
                    </button>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-pixel text-sm sm:text-base font-black tracking-tight text-zinc-950">
                          {session.uploadId}
                        </span>
                        <StatusBadge status={session.status} size="sm" />
                        {session.pinned && (
                          <span className="bg-[#FFD43B] text-black font-pixel text-[8px] px-1.5 py-0.5 border border-black shadow-[1px_1px_0px_#000] uppercase flex items-center gap-1">
                            <Pin className="w-2.5 h-2.5 fill-black" />
                            PINNED
                          </span>
                        )}
                        {session.isNew && (
                          <span className="bg-red-600 text-white font-pixel text-[9px] px-1.5 py-0.5 border border-black shadow-[1px_1px_0px_#000]">
                            NEW UPLOAD
                          </span>
                        )}
                        {session.adminTags && session.adminTags.length > 0 && (
                          <div className="flex items-center gap-1">
                            {session.adminTags.slice(0, 3).map((t) => (
                              <span key={t} className="bg-blue-100 text-blue-900 border border-blue-800 text-[9px] font-mono font-bold px-1.5 py-0.2">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                        {session.adminNotes && session.adminNotes.length > 0 && (
                          <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-0.5" title={`${session.adminNotes.length} internal note(s)`}>
                            <MessageSquare className="w-3 h-3 text-zinc-600" />
                            {session.adminNotes.length}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 font-medium pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                          <strong className="text-zinc-800">{session.date}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{session.time}</span>
                        </span>
                        {session.deviceType && (
                          <span className="flex items-center gap-1 text-[11px] text-zinc-500 font-bold uppercase">
                            {session.deviceType === 'Mobile' ? (
                              <Smartphone className="w-3 h-3 text-blue-600" />
                            ) : (
                              <Laptop className="w-3 h-3 text-zinc-500" />
                            )}
                            <span>{session.deviceType}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Mobile Quick Actions [VIEW], [DOWNLOAD ALL] */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-200">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <div className="bg-zinc-100 border border-black px-2.5 py-1 text-center">
                        <span className="block text-[9px] text-zinc-500 font-bold uppercase font-sans">Files</span>
                        <span className="font-bold text-zinc-900">{session.fileCount}</span>
                      </div>
                      <div className="bg-zinc-100 border border-black px-2.5 py-1 text-center">
                        <span className="block text-[9px] text-zinc-500 font-bold uppercase font-sans">Size</span>
                        <span className="font-bold text-zinc-900">{formatFileSize(session.totalSize)}</span>
                      </div>
                    </div>

                    {/* Quick Action buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleQuickDownloadAll(session, e)}
                        className="mc-btn-success py-1.5 px-2 text-[11px] font-black uppercase flex items-center gap-1"
                        title="Download All Files (ZIP)"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">ZIP</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleQuickDelete(session, e)}
                        className="mc-btn-danger py-1.5 px-2 text-[11px] font-black uppercase flex items-center gap-1"
                        title="Move to Trash"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">TRASH</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectSubmission(session)}
                        className="mc-btn-primary py-1.5 px-2.5 text-[11px] font-black uppercase flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>VIEW</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* File preview tags */}
                {session.files && session.files.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-dashed border-zinc-200 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mr-1">
                      Files:
                    </span>
                    {session.files.slice(0, 4).map((f) => (
                      <span
                        key={f.fileId}
                        className={`border text-[11px] font-mono px-2 py-0.5 truncate max-w-[150px] sm:max-w-[200px] ${
                          f.isDownloaded
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                            : 'bg-zinc-100 border-zinc-400 text-zinc-800'
                        }`}
                        title={f.name}
                      >
                        {f.name}
                      </span>
                    ))}
                    {session.files.length > 4 && (
                      <span className="text-[11px] font-bold text-zinc-500 bg-zinc-200 px-1.5 py-0.5 border border-zinc-400 font-mono">
                        +{session.files.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
