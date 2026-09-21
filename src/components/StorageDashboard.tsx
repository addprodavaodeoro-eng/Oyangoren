import React, { useMemo } from 'react';
import { 
  HardDrive, 
  Files, 
  Calendar, 
  TrendingUp, 
  PieChart, 
  Layers, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  Archive 
} from 'lucide-react';
import { UploadSession } from '../types';
import { formatFileSize } from '../lib/settings';

interface StorageDashboardProps {
  submissions: UploadSession[];
}

export const StorageDashboard: React.FC<StorageDashboardProps> = ({ submissions }) => {
  // Only count active non-trashed sessions
  const activeSessions = submissions.filter((s) => !s.isTrash);
  const trashedSessions = submissions.filter((s) => s.isTrash);

  // Storage metrics
  const totalStorageBytes = activeSessions.reduce((acc, s) => acc + (s.totalSize || 0), 0);
  const trashedStorageBytes = trashedSessions.reduce((acc, s) => acc + (s.totalSize || 0), 0);

  // Total files count
  const totalFiles = activeSessions.reduce((acc, s) => acc + (s.fileCount || (s.files ? s.files.length : 0)), 0);

  // Largest upload session
  const largestUploadSession = activeSessions.reduce(
    (max, s) => ((s.totalSize || 0) > (max?.totalSize || 0) ? s : max),
    activeSessions[0] || null
  );

  // Largest individual file
  const largestFile = useMemo<{ name: string; size: number; uploadId: string } | null>(() => {
    let best: { name: string; size: number; uploadId: string } | null = null;
    activeSessions.forEach((s) => {
      s.files?.forEach((f) => {
        if (!best || f.size > best.size) {
          best = { name: f.name, size: f.size, uploadId: s.uploadId };
        }
      });
    });
    return best;
  }, [activeSessions]);

  // Uploads Today & This Month
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const uploadsToday = activeSessions.filter((s) => {
    if (s.date === todayStr) return true;
    try {
      const d = new Date(s.createdAt);
      return d.toDateString() === now.toDateString();
    } catch {
      return false;
    }
  }).length;

  const uploadsThisMonth = activeSessions.filter((s) => {
    try {
      const d = new Date(s.createdAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    } catch {
      return false;
    }
  }).length;

  // Storage quota limit (e.g. 50 GB standard cloud bucket)
  const maxStorageLimitBytes = 50 * 1024 * 1024 * 1024; // 50 GB
  const storagePercent = Math.min(100, Math.max(0.1, (totalStorageBytes / maxStorageLimitBytes) * 100));

  // File type distribution
  let pdfCount = 0;
  let imageCount = 0;
  let officeCount = 0;
  let otherCount = 0;

  activeSessions.forEach((s) => {
    if (s.files) {
      s.files.forEach((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        if (ext === 'pdf') {
          pdfCount++;
        } else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'tiff', 'heic'].includes(ext)) {
          imageCount++;
        } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt'].includes(ext)) {
          officeCount++;
        } else {
          otherCount++;
        }
      });
    }
  });

  const countedFilesTotal = pdfCount + imageCount + officeCount + otherCount || 1;
  const pdfPercent = Math.round((pdfCount / countedFilesTotal) * 100);
  const imagePercent = Math.round((imageCount / countedFilesTotal) * 100);
  const officePercent = Math.round((officeCount / countedFilesTotal) * 100);
  const otherPercent = Math.max(0, 100 - (pdfPercent + imagePercent + officePercent));

  return (
    <div className="space-y-6">
      {/* Storage Capacity Bar Card */}
      <div className="mc-card p-5 sm:p-6 bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 border-black mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-100 border-2 border-black flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-zinc-950">
                Cloud Storage Allocation
              </h2>
              <p className="text-xs text-zinc-500 font-medium">
                Active customer print upload files in Firebase Cloud Storage.
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs sm:text-sm font-black font-mono text-zinc-900">
              {formatFileSize(totalStorageBytes)} / 50 GB
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-5 bg-zinc-200 border-2 border-black p-0.5 shadow-inner">
          <div
            className="h-full bg-[#2563EB] border-r-2 border-black transition-all duration-300"
            style={{ width: `${storagePercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600 uppercase mt-2">
          <span>{storagePercent.toFixed(2)}% Used</span>
          <span>{formatFileSize(maxStorageLimitBytes - totalStorageBytes)} Available</span>
        </div>
      </div>

      {/* Main Metric Blocks */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Storage */}
        <div className="mc-card p-4 bg-white border-3 border-black shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-blue-600" />
            <span>Total Storage</span>
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono text-zinc-950">
            {formatFileSize(totalStorageBytes)}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-1">
            Across {activeSessions.length} sessions
          </div>
        </div>

        {/* Total Files */}
        <div className="mc-card p-4 bg-white border-3 border-black shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1 flex items-center gap-1.5">
            <Files className="w-3.5 h-3.5 text-emerald-600" />
            <span>Total Files</span>
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono text-zinc-950">
            {totalFiles}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-1">
            Uploaded by customers
          </div>
        </div>

        {/* Uploads Today */}
        <div className="mc-card p-4 bg-white border-3 border-black shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Uploads Today</span>
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono text-zinc-950">
            {uploadsToday}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-1">
            Today's sessions
          </div>
        </div>

        {/* Uploads This Month */}
        <div className="mc-card p-4 bg-white border-3 border-black shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
            <span>This Month</span>
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono text-zinc-950">
            {uploadsThisMonth}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-1">
            Month of {now.toLocaleDateString('en-US', { month: 'long' })}
          </div>
        </div>

        {/* Largest Upload Session */}
        <div className="mc-card p-4 bg-white border-3 border-black shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
            Largest Session
          </div>
          <div className="text-sm sm:text-base font-black font-mono text-zinc-950 truncate">
            {largestUploadSession ? formatFileSize(largestUploadSession.totalSize) : '0 B'}
          </div>
          <div className="text-[10px] text-blue-700 font-bold truncate mt-1">
            {largestUploadSession?.uploadId || 'None'}
          </div>
        </div>

        {/* Largest File */}
        <div className="mc-card p-4 bg-white border-3 border-black shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1">
            Largest File
          </div>
          <div className="text-sm sm:text-base font-black font-mono text-zinc-950 truncate">
            {largestFile ? formatFileSize(largestFile.size) : '0 B'}
          </div>
          <div className="text-[10px] text-zinc-600 font-medium truncate mt-1" title={largestFile?.name}>
            {largestFile?.name || 'None'}
          </div>
        </div>

        {/* Trash Storage */}
        <div className="mc-card p-4 bg-white border-3 border-black shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1 flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5 text-red-600" />
            <span>Trash Storage</span>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-zinc-950">
            {formatFileSize(trashedStorageBytes)}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-1">
            {trashedSessions.length} trashed sessions
          </div>
        </div>

        {/* Active Sessions */}
        <div className="mc-card p-4 bg-white border-3 border-black shadow-[3px_3px_0px_#000]">
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-600 mb-1 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Active Sessions</span>
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono text-zinc-950">
            {activeSessions.length}
          </div>
          <div className="text-[10px] text-zinc-500 font-medium mt-1">
            In system
          </div>
        </div>
      </div>

      {/* File Type Statistics Card */}
      <div className="mc-card p-5 sm:p-6 bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
        <div className="flex items-center gap-2 pb-3 border-b-2 border-black mb-4">
          <PieChart className="w-5 h-5 text-zinc-800" />
          <h3 className="text-sm sm:text-base font-black uppercase text-zinc-950">
            File Type Statistics
          </h3>
        </div>

        {/* Stacked Percentage Visual Bar */}
        <div className="w-full h-6 border-2 border-black flex overflow-hidden shadow-inner mb-4">
          {pdfPercent > 0 && (
            <div
              className="bg-red-500 h-full border-r border-black flex items-center justify-center text-[10px] font-bold text-white"
              style={{ width: `${pdfPercent}%` }}
              title={`PDF: ${pdfPercent}%`}
            >
              {pdfPercent > 10 ? `${pdfPercent}%` : ''}
            </div>
          )}
          {imagePercent > 0 && (
            <div
              className="bg-emerald-500 h-full border-r border-black flex items-center justify-center text-[10px] font-bold text-white"
              style={{ width: `${imagePercent}%` }}
              title={`Images: ${imagePercent}%`}
            >
              {imagePercent > 10 ? `${imagePercent}%` : ''}
            </div>
          )}
          {officePercent > 0 && (
            <div
              className="bg-blue-500 h-full border-r border-black flex items-center justify-center text-[10px] font-bold text-white"
              style={{ width: `${officePercent}%` }}
              title={`Office: ${officePercent}%`}
            >
              {officePercent > 10 ? `${officePercent}%` : ''}
            </div>
          )}
          {otherPercent > 0 && (
            <div
              className="bg-amber-500 h-full flex items-center justify-center text-[10px] font-bold text-black"
              style={{ width: `${otherPercent}%` }}
              title={`Other: ${otherPercent}%`}
            >
              {otherPercent > 10 ? `${otherPercent}%` : ''}
            </div>
          )}
        </div>

        {/* 4 Simple Breakdown Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-red-50 border-2 border-black shadow-[2px_2px_0px_#000]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-900 uppercase">
              <FileText className="w-4 h-4 text-red-600" />
              <span>PDF</span>
            </div>
            <div className="text-xl font-black font-mono text-zinc-950 mt-1">
              {pdfPercent}%
            </div>
            <div className="text-[10px] text-zinc-600 font-medium">
              {pdfCount} files
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border-2 border-black shadow-[2px_2px_0px_#000]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 uppercase">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span>Images</span>
            </div>
            <div className="text-xl font-black font-mono text-zinc-950 mt-1">
              {imagePercent}%
            </div>
            <div className="text-[10px] text-zinc-600 font-medium">
              {imageCount} files
            </div>
          </div>

          <div className="p-3 bg-blue-50 border-2 border-black shadow-[2px_2px_0px_#000]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 uppercase">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>Office Files</span>
            </div>
            <div className="text-xl font-black font-mono text-zinc-950 mt-1">
              {officePercent}%
            </div>
            <div className="text-[10px] text-zinc-600 font-medium">
              {officeCount} files
            </div>
          </div>

          <div className="p-3 bg-amber-50 border-2 border-black shadow-[2px_2px_0px_#000]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase">
              <Files className="w-4 h-4 text-amber-600" />
              <span>Other</span>
            </div>
            <div className="text-xl font-black font-mono text-zinc-950 mt-1">
              {otherPercent}%
            </div>
            <div className="text-[10px] text-zinc-600 font-medium">
              {otherCount} files
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
