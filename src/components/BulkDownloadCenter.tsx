import React, { useState, useMemo } from 'react';
import { 
  Archive, 
  Download, 
  FileSpreadsheet, 
  FileJson, 
  Calendar, 
  CheckSquare, 
  Square, 
  FolderDown, 
  Layers, 
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { UploadSession } from '../types';
import { 
  formatFileSize, 
  formatDate, 
  formatTime 
} from '../lib/settings';
import { 
  generateSmartZipBlob, 
  triggerBlobDownload,
  exportSessionsToCSV,
  exportSessionsToExcelCSV,
  exportSessionsToJSON,
  markFileDownloaded
} from '../lib/submissionService';

interface BulkDownloadCenterProps {
  submissions: UploadSession[];
  onSubmissionUpdated: (updated: UploadSession) => void;
}

type DatePreset = 'all' | 'today' | 'yesterday' | 'last7' | 'manual';

export const BulkDownloadCenter: React.FC<BulkDownloadCenterProps> = ({
  submissions,
  onSubmissionUpdated
}) => {
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPackaging, setIsPackaging] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeSubmissions = useMemo(() => {
    return submissions.filter((s) => !s.isTrash);
  }, [submissions]);

  // Compute preset dates
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Filtered submissions based on preset
  const filteredSubmissions = useMemo(() => {
    switch (selectedPreset) {
      case 'today':
        return activeSubmissions.filter((s) => s.createdAt && s.createdAt.slice(0, 10) === todayStr);
      case 'yesterday':
        return activeSubmissions.filter((s) => s.createdAt && s.createdAt.slice(0, 10) === yesterdayStr);
      case 'last7':
        return activeSubmissions.filter((s) => s.createdAt && new Date(s.createdAt) >= sevenDaysAgo);
      default:
        return activeSubmissions;
    }
  }, [activeSubmissions, selectedPreset, todayStr, yesterdayStr]);

  // Selectable items
  const currentItemsToDownload = useMemo(() => {
    if (selectedPreset === 'manual') {
      return activeSubmissions.filter((s) => selectedIds.has(s.id));
    }
    return filteredSubmissions;
  }, [activeSubmissions, filteredSubmissions, selectedPreset, selectedIds]);

  const totalFiles = currentItemsToDownload.reduce((acc, s) => acc + (s.fileCount || 0), 0);
  const totalBytes = currentItemsToDownload.reduce((acc, s) => acc + (s.totalSize || 0), 0);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllFiltered = () => {
    if (selectedIds.size === filteredSubmissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSubmissions.map((s) => s.id)));
    }
  };

  const handleDownloadSmartZip = async () => {
    if (currentItemsToDownload.length === 0) return;
    setIsPackaging(true);
    setProgressPercent(0);
    setStatusMessage('Collecting and packaging files into smart ZIP with subfolders...');

    try {
      const zipBlob = await generateSmartZipBlob(currentItemsToDownload, (pct) => {
        setProgressPercent(pct);
      });

      const datePart = new Date().toISOString().slice(0, 10);
      let zipName = `OYANGOREN-UPLOADS-${datePart}.zip`;
      if (selectedPreset === 'manual') {
        zipName = `OYANGOREN-SELECTED-UPLOADS-${datePart}.zip`;
      } else if (selectedPreset === 'today') {
        zipName = `OYANGOREN-UPLOADS-TODAY-${datePart}.zip`;
      }

      triggerBlobDownload(zipBlob, zipName);
      setStatusMessage('Smart ZIP created and downloaded successfully!');

      // Mark files as downloaded
      for (const session of currentItemsToDownload) {
        for (const f of session.files || []) {
          await markFileDownloaded(session.id, f.fileId);
        }
      }
    } catch (err: any) {
      console.error('ZIP generation error:', err);
      setStatusMessage(`Failed to generate ZIP: ${err.message || 'Unknown error'}`);
    } finally {
      setIsPackaging(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border-3 border-black shadow-[4px_4px_0px_#000]">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-[#2563EB]" />
            <h2 className="font-pixel text-sm uppercase tracking-wider text-zinc-900">
              BULK DOWNLOAD CENTER
            </h2>
          </div>
          <p className="text-xs text-zinc-600 font-bold mt-1">
            Package multiple customer upload sessions into organized ZIP folders or export full records.
          </p>
        </div>

        {/* Action Summary Pill */}
        <div className="flex items-center gap-3 bg-zinc-100 p-2.5 border-2 border-black">
          <div className="text-right">
            <div className="font-pixel text-[11px] text-zinc-900">
              {currentItemsToDownload.length} SESSIONS • {totalFiles} FILES
            </div>
            <div className="text-[11px] font-mono font-bold text-zinc-600">
              Total Size: {formatFileSize(totalBytes)}
            </div>
          </div>
        </div>
      </div>

      {/* Preset Selectors */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button
          type="button"
          onClick={() => setSelectedPreset('all')}
          className={`p-3 border-2 border-black text-left shadow-[2px_2px_0px_#000] font-bold text-xs uppercase transition-colors ${
            selectedPreset === 'all'
              ? 'bg-[#2563EB] text-white'
              : 'bg-white text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <div className="font-pixel text-[10px]">ALL ACTIVE</div>
          <div className="text-[11px] opacity-80 mt-0.5">{activeSubmissions.length} Sessions</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedPreset('today')}
          className={`p-3 border-2 border-black text-left shadow-[2px_2px_0px_#000] font-bold text-xs uppercase transition-colors ${
            selectedPreset === 'today'
              ? 'bg-[#2563EB] text-white'
              : 'bg-white text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <div className="font-pixel text-[10px]">TODAY'S UPLOADS</div>
          <div className="text-[11px] opacity-80 mt-0.5">
            {activeSubmissions.filter((s) => s.createdAt?.slice(0, 10) === todayStr).length} Sessions
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedPreset('yesterday')}
          className={`p-3 border-2 border-black text-left shadow-[2px_2px_0px_#000] font-bold text-xs uppercase transition-colors ${
            selectedPreset === 'yesterday'
              ? 'bg-[#2563EB] text-white'
              : 'bg-white text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <div className="font-pixel text-[10px]">YESTERDAY</div>
          <div className="text-[11px] opacity-80 mt-0.5">
            {activeSubmissions.filter((s) => s.createdAt?.slice(0, 10) === yesterdayStr).length} Sessions
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedPreset('last7')}
          className={`p-3 border-2 border-black text-left shadow-[2px_2px_0px_#000] font-bold text-xs uppercase transition-colors ${
            selectedPreset === 'last7'
              ? 'bg-[#2563EB] text-white'
              : 'bg-white text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <div className="font-pixel text-[10px]">LAST 7 DAYS</div>
          <div className="text-[11px] opacity-80 mt-0.5">
            {activeSubmissions.filter((s) => s.createdAt && new Date(s.createdAt) >= sevenDaysAgo).length} Sessions
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedPreset('manual')}
          className={`p-3 border-2 border-black text-left shadow-[2px_2px_0px_#000] font-bold text-xs uppercase transition-colors ${
            selectedPreset === 'manual'
              ? 'bg-[#2563EB] text-white'
              : 'bg-white text-zinc-900 hover:bg-zinc-50'
          }`}
        >
          <div className="font-pixel text-[10px]">MANUAL PICK</div>
          <div className="text-[11px] opacity-80 mt-0.5">{selectedIds.size} Selected</div>
        </button>
      </div>

      {/* Main Download Actions Bar */}
      <div className="bg-white p-5 border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-xs text-zinc-900 uppercase">
              TARGET: {currentItemsToDownload.length} Sessions ({totalFiles} Files • {formatFileSize(totalBytes)})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Download as ZIP */}
            <button
              type="button"
              disabled={isPackaging || currentItemsToDownload.length === 0}
              onClick={handleDownloadSmartZip}
              className="mc-btn-success py-2.5 px-4 text-xs font-black uppercase flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD AS SMART ZIP</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              disabled={currentItemsToDownload.length === 0}
              onClick={() => exportSessionsToCSV(currentItemsToDownload)}
              className="mc-btn-secondary py-2.5 px-3 text-xs font-black uppercase flex items-center gap-1.5 disabled:opacity-50"
              title="Export records to CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>CSV</span>
            </button>

            {/* Export Excel CSV */}
            <button
              type="button"
              disabled={currentItemsToDownload.length === 0}
              onClick={() => exportSessionsToExcelCSV(currentItemsToDownload)}
              className="mc-btn-secondary py-2.5 px-3 text-xs font-black uppercase flex items-center gap-1.5 disabled:opacity-50"
              title="Export Excel-compatible CSV with UTF-8 BOM"
            >
              <FileSpreadsheet className="w-4 h-4 text-green-700" />
              <span>EXCEL CSV</span>
            </button>

            {/* Export JSON */}
            <button
              type="button"
              disabled={currentItemsToDownload.length === 0}
              onClick={() => exportSessionsToJSON(currentItemsToDownload)}
              className="mc-btn-secondary py-2.5 px-3 text-xs font-black uppercase flex items-center gap-1.5 disabled:opacity-50"
              title="Export JSON metadata"
            >
              <FileJson className="w-4 h-4 text-blue-700" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {/* Progress Bar during ZIP creation */}
        {isPackaging && (
          <div className="p-3 bg-blue-50 border-2 border-black animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-blue-950 uppercase mb-1">
              <span>Packaging files into folders...</span>
              <span className="font-mono">{progressPercent}%</span>
            </div>
            <div className="w-full h-3 bg-zinc-200 border border-black p-0.5">
              <div
                className="h-full bg-emerald-600 border-r border-black transition-all duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {statusMessage && !isPackaging && (
          <div className="p-2.5 bg-emerald-50 border-2 border-emerald-800 text-emerald-950 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Smart ZIP Folder Structure Hint */}
      <div className="p-4 bg-amber-50 border-2 border-black shadow-[3px_3px_0px_#000] text-xs">
        <div className="font-pixel text-[10px] text-amber-950 uppercase mb-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>SMART ZIP STRUCTURE</span>
        </div>
        <p className="text-zinc-700 font-bold mb-2">
          Files will be organized into folders named after each Upload ID. Original customer filenames are 100% preserved.
        </p>
        <div className="font-mono text-[11px] bg-white p-2.5 border border-black text-zinc-800 space-y-1">
          <div>📁 UPLOAD-20260921-001/</div>
          <div className="pl-4">📄 design.pdf</div>
          <div className="pl-4">📄 document.docx</div>
          <div>📁 UPLOAD-20260921-002/</div>
          <div className="pl-4">🖼️ photo.jpg</div>
        </div>
      </div>

      {/* Manual Selection Table */}
      {selectedPreset === 'manual' && (
        <div className="bg-white p-4 border-3 border-black shadow-[4px_4px_0px_#000] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b-2 border-black">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-xs font-black uppercase text-zinc-900 flex items-center gap-1.5 hover:underline"
            >
              {selectedIds.size === filteredSubmissions.length ? (
                <CheckSquare className="w-4 h-4 text-[#2563EB]" />
              ) : (
                <Square className="w-4 h-4 text-zinc-600" />
              )}
              <span>Select All ({filteredSubmissions.length})</span>
            </button>
            <span className="text-xs font-mono text-zinc-600 font-bold">
              {selectedIds.size} of {filteredSubmissions.length} selected
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
            {filteredSubmissions.map((sub) => {
              const isSelected = selectedIds.has(sub.id);
              return (
                <div
                  key={sub.id}
                  onClick={() => toggleSelect(sub.id)}
                  className={`p-2.5 border-2 border-black flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50 border-blue-900' : 'bg-zinc-50 hover:bg-zinc-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#2563EB] shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-zinc-950">
                        {sub.uploadId || sub.id}
                      </span>
                      <span className="text-[11px] text-zinc-500 ml-2 font-mono">
                        {sub.date} • {sub.time}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                    <span className="bg-zinc-200 px-1.5 py-0.5 border border-black text-[10px] font-bold">
                      {sub.fileCount} {sub.fileCount === 1 ? 'FILE' : 'FILES'}
                    </span>
                    <span className="text-zinc-600 font-bold">{formatFileSize(sub.totalSize)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
