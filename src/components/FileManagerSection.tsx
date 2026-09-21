import React, { useState, useMemo } from 'react';
import { 
  FolderOpen, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Eye, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  Archive, 
  FileCheck, 
  Hash, 
  ExternalLink,
  CheckSquare,
  Square,
  X,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { UploadSession, UploadedFileRecord, FileCategory } from '../types';
import { formatFileSize, formatDate, formatTime } from '../lib/settings';
import { markFileDownloaded, deleteIndividualFile, triggerBlobDownload } from '../lib/submissionService';
import JSZip from 'jszip';

interface FileManagerSectionProps {
  submissions: UploadSession[];
  onSubmissionUpdated: (updated: UploadSession) => void;
  onOpenDetailModal: (submission: UploadSession) => void;
}

interface FlattenedFileRecord {
  file: UploadedFileRecord;
  session: UploadSession;
}

export const FileManagerSection: React.FC<FileManagerSectionProps> = ({
  submissions,
  onSubmissionUpdated,
  onOpenDetailModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'size-desc' | 'name-asc'>('date-desc');
  const [selectedFileKeys, setSelectedFileKeys] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<FlattenedFileRecord | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // Flatten all files from active sessions
  const allFiles: FlattenedFileRecord[] = useMemo(() => {
    const list: FlattenedFileRecord[] = [];
    const active = submissions.filter((s) => !s.isTrash);
    for (const s of active) {
      for (const f of s.files || []) {
        list.push({ file: f, session: s });
      }
    }
    return list;
  }, [submissions]);

  // Apply search, category, and sort filters
  const filteredFiles = useMemo(() => {
    return allFiles
      .filter(({ file, session }) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = file.name.toLowerCase().includes(q);
          const matchSession = (session.uploadId || session.id).toLowerCase().includes(q);
          const matchHash = (file.hash || '').toLowerCase().includes(q);
          if (!matchName && !matchSession && !matchHash) return false;
        }

        // Category filter
        if (categoryFilter !== 'ALL') {
          if (categoryFilter === 'LARGE') {
            if (file.size < 50 * 1024 * 1024) return false;
          } else if (file.category !== categoryFilter) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'size-desc') return b.file.size - a.file.size;
        if (sortBy === 'name-asc') return a.file.name.localeCompare(b.file.name);
        if (sortBy === 'date-asc') {
          const da = new Date(a.file.uploadedAt || a.session.createdAt).getTime();
          const db = new Date(b.file.uploadedAt || b.session.createdAt).getTime();
          return da - db;
        }
        // date-desc default
        const da = new Date(a.file.uploadedAt || a.session.createdAt).getTime();
        const db = new Date(b.file.uploadedAt || b.session.createdAt).getTime();
        return db - da;
      });
  }, [allFiles, searchQuery, categoryFilter, sortBy]);

  const totalFilteredSize = filteredFiles.reduce((acc, item) => acc + item.file.size, 0);

  const getFileKey = (session: UploadSession, file: UploadedFileRecord) => `${session.id}__${file.fileId}`;

  const toggleSelectFile = (key: string) => {
    const next = new Set(selectedFileKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedFileKeys(next);
  };

  const selectAll = () => {
    if (selectedFileKeys.size === filteredFiles.length) {
      setSelectedFileKeys(new Set());
    } else {
      setSelectedFileKeys(new Set(filteredFiles.map((f) => getFileKey(f.session, f.file))));
    }
  };

  const handleDownloadSingle = async (session: UploadSession, file: UploadedFileRecord) => {
    if (!file.downloadUrl) return;
    await markFileDownloaded(session.id, file.fileId);
    const link = document.createElement('a');
    link.href = file.downloadUrl;
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteSingle = async (session: UploadSession, file: UploadedFileRecord) => {
    if (!confirm(`Are you sure you want to delete file "${file.name}"? This cannot be undone.`)) {
      return;
    }
    const updated = await deleteIndividualFile(session.id, file.fileId);
    if (updated) {
      onSubmissionUpdated(updated);
    }
  };

  const handleDeleteSelectedFiles = async () => {
    const selectedItems = allFiles.filter((item) => selectedFileKeys.has(getFileKey(item.session, item.file)));
    if (selectedItems.length === 0) return;

    if (!confirm(`Are you sure you want to permanently delete ${selectedItems.length} selected file(s)? This will delete them from storage and database.`)) {
      return;
    }

    for (const { session, file } of selectedItems) {
      const updated = await deleteIndividualFile(session.id, file.fileId);
      if (updated) {
        onSubmissionUpdated(updated);
      }
    }
    setSelectedFileKeys(new Set());
  };

  const handleDownloadSelectedAsZip = async () => {
    const selectedItems = allFiles.filter((item) => selectedFileKeys.has(getFileKey(item.session, item.file)));
    if (selectedItems.length === 0) return;

    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      for (const { session, file } of selectedItems) {
        if (!file.downloadUrl) continue;
        try {
          const res = await fetch(file.downloadUrl);
          const blob = await res.blob();
          const folderName = session.uploadId || session.id;
          zip.folder(folderName)?.file(file.name, blob);
          await markFileDownloaded(session.id, file.fileId);
        } catch (e) {
          console.warn('Could not fetch file for ZIP', file.name, e);
        }
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(zipBlob, `OYANGOREN-SELECTED-FILES-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (err) {
      console.error('ZIP generation error:', err);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const getCategoryIcon = (category?: FileCategory) => {
    switch (category) {
      case 'IMAGE':
        return <ImageIcon className="w-4 h-4 text-purple-600" />;
      case 'PDF':
        return <FileText className="w-4 h-4 text-red-600" />;
      case 'SPREADSHEET':
        return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
      case 'ARCHIVE':
        return <Archive className="w-4 h-4 text-amber-600" />;
      default:
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 border-3 border-black shadow-[4px_4px_0px_#000]">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#2563EB]" />
            <h2 className="font-pixel text-sm uppercase tracking-wider text-zinc-900">
              FILE MANAGER (ALL SESSIONS)
            </h2>
          </div>
          <p className="text-xs text-zinc-600 font-bold mt-1">
            Global repository of all individual files uploaded across customer sessions.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-zinc-100 p-2.5 border-2 border-black font-mono text-xs">
          <div>
            <span className="font-pixel text-[11px] text-zinc-900">{filteredFiles.length} FILES</span>
            <span className="text-zinc-500 ml-1">({formatFileSize(totalFilteredSize)})</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 border-3 border-black shadow-[4px_4px_0px_#000] space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search filename, upload ID, or SHA-256..."
              className="w-full pl-9 pr-3 py-2 border-2 border-black font-bold text-xs bg-zinc-50 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-600 shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-3 border-2 border-black font-bold text-xs bg-zinc-50 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="IMAGE">Images (JPG, PNG, TIFF...)</option>
              <option value="PDF">PDF Documents</option>
              <option value="DOCUMENT">Word & Text Documents</option>
              <option value="SPREADSHEET">Excel & Sheets</option>
              <option value="ARCHIVE">Zip & Archives</option>
              <option value="LARGE">Large Files (&gt; 50 MB)</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-600 shrink-0">Sort:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full py-2 px-3 border-2 border-black font-bold text-xs bg-zinc-50 focus:bg-white focus:outline-none"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="size-desc">Largest Size</option>
              <option value="name-asc">Filename (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Selected Batch Actions Bar */}
        {selectedFileKeys.size > 0 && (
          <div className="p-3 bg-blue-50 border-2 border-black flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
            <div className="text-xs font-bold text-blue-950 font-pixel text-[11px]">
              {selectedFileKeys.size} FILES SELECTED
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeleteSelectedFiles}
                className="mc-btn-danger py-1.5 px-3 text-xs font-black uppercase flex items-center gap-1.5"
                title="Permanently delete selected files"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>DELETE SELECTED ({selectedFileKeys.size})</span>
              </button>
              <button
                type="button"
                disabled={isDownloadingZip}
                onClick={handleDownloadSelectedAsZip}
                className="mc-btn-success py-1.5 px-3 text-xs font-black uppercase flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>DOWNLOAD SELECTED ({selectedFileKeys.size})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedFileKeys(new Set())}
                className="mc-btn-secondary py-1.5 px-2.5 text-xs font-black uppercase"
              >
                CLEAR
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Files Table */}
      <div className="bg-white border-3 border-black shadow-[4px_4px_0px_#000] overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-100 border-b-2 border-black text-zinc-900 font-pixel text-[10px] uppercase tracking-wider">
              <th className="p-3 w-10">
                <button type="button" onClick={selectAll} className="flex items-center">
                  {selectedFileKeys.size === filteredFiles.length && filteredFiles.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                  ) : (
                    <Square className="w-4 h-4 text-zinc-600" />
                  )}
                </button>
              </th>
              <th className="p-3">File Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Upload Session</th>
              <th className="p-3">Size</th>
              <th className="p-3">Metadata</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-zinc-500 font-bold uppercase">
                  No files match your search criteria.
                </td>
              </tr>
            ) : (
              filteredFiles.map(({ file, session }) => {
                const key = getFileKey(session, file);
                const isSelected = selectedFileKeys.has(key);

                return (
                  <tr
                    key={key}
                    className={`hover:bg-amber-50/40 transition-colors ${
                      isSelected ? 'bg-blue-50/70' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => toggleSelectFile(key)}
                        className="flex items-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-400" />
                        )}
                      </button>
                    </td>

                    {/* File Name */}
                    <td className="p-3 max-w-xs truncate">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(file.category)}
                        <span className="font-bold text-zinc-950 truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="p-3">
                      <span className="bg-zinc-200 px-2 py-0.5 border border-black text-[10px] font-bold uppercase font-mono">
                        {file.category || 'OTHER'}
                      </span>
                    </td>

                    {/* Session ID */}
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => onOpenDetailModal(session)}
                        className="font-mono text-blue-700 hover:underline font-bold text-[11px] inline-flex items-center gap-1"
                        title="View upload session"
                      >
                        <span>{session.uploadId || session.id}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>

                    {/* Size */}
                    <td className="p-3 font-mono font-bold text-zinc-700">
                      {formatFileSize(file.size)}
                    </td>

                    {/* Metadata summary */}
                    <td className="p-3 font-mono text-[11px] text-zinc-600">
                      {file.imageDimensions && (
                        <span>{file.imageDimensions.width}x{file.imageDimensions.height}px</span>
                      )}
                      {file.pageCount && <span>{file.pageCount} Pages</span>}
                      {file.hash && (
                        <span className="ml-1 text-zinc-400" title={`SHA-256: ${file.hash}`}>
                          #hash
                        </span>
                      )}
                      {!file.imageDimensions && !file.pageCount && !file.hash && <span>—</span>}
                    </td>

                    {/* Status */}
                    <td className="p-3">
                      {file.isDownloaded ? (
                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-800 text-[10px] font-black px-1.5 py-0.5">
                          DOWNLOADED
                        </span>
                      ) : (
                        <span className="bg-zinc-100 text-zinc-700 border border-zinc-400 text-[10px] font-black px-1.5 py-0.5">
                          PENDING
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Preview */}
                        <button
                          type="button"
                          onClick={() => setPreviewFile({ file, session })}
                          className="p-1.5 bg-zinc-100 hover:bg-zinc-200 border-2 border-black shadow-[1px_1px_0px_#000]"
                          title="Preview file details"
                        >
                          <Eye className="w-3.5 h-3.5 text-zinc-800" />
                        </button>

                        {/* Direct Download */}
                        <button
                          type="button"
                          onClick={() => handleDownloadSingle(session, file)}
                          className="p-1.5 bg-emerald-100 hover:bg-emerald-200 border-2 border-black text-emerald-900 shadow-[1px_1px_0px_#000]"
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteSingle(session, file)}
                          className="p-1.5 bg-red-100 hover:bg-red-200 border-2 border-black text-red-900 shadow-[1px_1px_0px_#000]"
                          title="Delete file"
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

      {/* File Preview Drawer / Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="mc-card p-6 bg-white border-3 border-black shadow-[8px_8px_0px_#000] max-w-lg w-full animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                {getCategoryIcon(previewFile.file.category)}
                <h3 className="font-pixel text-xs text-zinc-900 uppercase">
                  FILE INSPECTOR
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="p-1 border border-black hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thumbnail preview if image */}
            {previewFile.file.previewUrl && (
              <div className="bg-zinc-100 p-2 border-2 border-black flex items-center justify-center max-h-60 overflow-hidden">
                <img
                  src={previewFile.file.previewUrl}
                  alt={previewFile.file.name}
                  referrerPolicy="no-referrer"
                  className="max-h-56 object-contain"
                />
              </div>
            )}

            {/* Details */}
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2 bg-zinc-50 border border-black break-all">
                <span className="font-bold text-zinc-500 block text-[10px] uppercase">File Name</span>
                <span className="font-bold text-zinc-900">{previewFile.file.name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-zinc-50 border border-black">
                  <span className="font-bold text-zinc-500 block text-[10px] uppercase">File Size</span>
                  <span className="font-bold text-zinc-900">{formatFileSize(previewFile.file.size)}</span>
                </div>
                <div className="p-2 bg-zinc-50 border border-black">
                  <span className="font-bold text-zinc-500 block text-[10px] uppercase">Category</span>
                  <span className="font-bold text-zinc-900">{previewFile.file.category || 'OTHER'}</span>
                </div>
              </div>

              {previewFile.file.imageDimensions && (
                <div className="p-2 bg-zinc-50 border border-black">
                  <span className="font-bold text-zinc-500 block text-[10px] uppercase">Resolution</span>
                  <span className="font-bold text-zinc-900">
                    {previewFile.file.imageDimensions.width} x {previewFile.file.imageDimensions.height} px
                  </span>
                </div>
              )}

              {previewFile.file.pageCount && (
                <div className="p-2 bg-zinc-50 border border-black">
                  <span className="font-bold text-zinc-500 block text-[10px] uppercase">PDF Pages</span>
                  <span className="font-bold text-zinc-900">{previewFile.file.pageCount} Pages</span>
                </div>
              )}

              {previewFile.file.hash && (
                <div className="p-2 bg-zinc-50 border border-black break-all">
                  <span className="font-bold text-zinc-500 block text-[10px] uppercase">SHA-256 Checksum</span>
                  <span className="text-[11px] text-zinc-700">{previewFile.file.hash}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t-2 border-black">
              <button
                type="button"
                onClick={() => handleDownloadSingle(previewFile.session, previewFile.file)}
                className="mc-btn-success py-2 px-4 text-xs font-black uppercase flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>DOWNLOAD FILE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
