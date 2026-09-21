import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Eye, 
  FileText, 
  Calendar, 
  Clock, 
  Trash2, 
  AlertTriangle, 
  Archive, 
  CheckCircle2,
  Layers,
  Check,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Smartphone,
  Laptop,
  Pin,
  Tag,
  MessageSquare,
  Printer,
  Plus,
  Hash,
  FileCheck
} from 'lucide-react';
import JSZip from 'jszip';
import { UploadSession, UploadStatus, UploadedFileRecord, AdminNote } from '../types';
import { formatFileSize, formatDate, formatTime } from '../lib/settings';
import { 
  updateSubmissionStatus, 
  deleteIndividualFile, 
  moveSubmissionToTrash,
  deletePermanently,
  markFileDownloaded,
  markSessionDownloaded,
  togglePinSession,
  toggleArchiveSession,
  addSessionNote,
  deleteSessionNote,
  addSessionTag,
  removeSessionTag
} from '../lib/submissionService';
import { StatusBadge, FileIconComponent } from './StatusBadge';
import QRCode from 'qrcode';

interface SubmissionDetailModalProps {
  submission: UploadSession;
  onClose: () => void;
  onSubmissionUpdated: (updated: UploadSession) => void;
  onSubmissionDeleted: (id: string) => void;
}

export const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({
  submission,
  onClose,
  onSubmissionUpdated,
  onSubmissionDeleted
}) => {
  const [currentSub, setCurrentSub] = useState<UploadSession>(submission);
  const [previewFile, setPreviewFile] = useState<UploadedFileRecord | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [ticketQrUrl, setTicketQrUrl] = useState<string>('');

  // Phase 3 Internal Notes & Tags
  const [newNoteText, setNewNoteText] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Generate QR for ticket
  useEffect(() => {
    if (currentSub?.uploadId) {
      QRCode.toDataURL(
        currentSub.uploadId,
        { width: 128, margin: 1 },
        (err, url) => {
          if (!err && url) setTicketQrUrl(url);
        }
      );
    }
  }, [currentSub?.uploadId]);

  // Modal confirmation states
  const [showTrashSessionModal, setShowTrashSessionModal] = useState(false);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<UploadedFileRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Automatically transition status from NEW to OPENED on open
  useEffect(() => {
    if ((currentSub.status || 'NEW').toUpperCase() === 'NEW') {
      handleStatusChange('OPENED');
    }
  }, []);

  const handleStatusChange = async (newStatus: UploadStatus) => {
    try {
      await updateSubmissionStatus(currentSub.id, newStatus);
      const updated: UploadSession = {
        ...currentSub,
        status: newStatus,
        isNew: false
      };
      setCurrentSub(updated);
      onSubmissionUpdated(updated);
    } catch (err) {
      console.error('Failed to change status:', err);
    }
  };

  const handleTogglePin = async () => {
    const isPinned = await togglePinSession(currentSub.id);
    const updated = { ...currentSub, pinned: isPinned };
    setCurrentSub(updated);
    onSubmissionUpdated(updated);
  };

  const handleToggleArchive = async () => {
    const isArchived = await toggleArchiveSession(currentSub.id);
    const updated = { ...currentSub, archived: isArchived };
    setCurrentSub(updated);
    onSubmissionUpdated(updated);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const notes = await addSessionNote(currentSub.id, newNoteText.trim());
    const updated = { ...currentSub, adminNotes: notes };
    setCurrentSub(updated);
    onSubmissionUpdated(updated);
    setNewNoteText('');
  };

  const handleDeleteNote = async (noteId: string) => {
    const notes = await deleteSessionNote(currentSub.id, noteId);
    const updated = { ...currentSub, adminNotes: notes };
    setCurrentSub(updated);
    onSubmissionUpdated(updated);
  };

  const handleAddTag = async (tag: string) => {
    if (!tag.trim()) return;
    const tags = await addSessionTag(currentSub.id, tag.trim());
    const updated = { ...currentSub, adminTags: tags };
    setCurrentSub(updated);
    onSubmissionUpdated(updated);
    setNewTagText('');
  };

  const handleRemoveTag = async (tag: string) => {
    const tags = await removeSessionTag(currentSub.id, tag);
    const updated = { ...currentSub, adminTags: tags };
    setCurrentSub(updated);
    onSubmissionUpdated(updated);
  };

  // Download single file and mark as downloaded
  const handleDownloadFile = async (file: UploadedFileRecord) => {
    setDownloadingFileId(file.fileId);
    try {
      const url = file.downloadUrl || file.previewUrl;
      if (url) {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } else {
        const blob = new Blob([`Oyangoren Printing - File: ${file.name}`], { type: 'text/plain' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = file.name;
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }

      // Mark file downloaded in database
      const updatedSession = await markFileDownloaded(currentSub.id, file.fileId);
      if (updatedSession) {
        setCurrentSub(updatedSession);
        onSubmissionUpdated(updatedSession);
      }
    } catch (err) {
      console.error('Download error:', err);
      if (file.downloadUrl) {
        window.open(file.downloadUrl, '_blank');
      }
    } finally {
      setDownloadingFileId(null);
    }
  };

  // Download all files as a single ZIP file
  const handleDownloadAllAsZip = async () => {
    if (!currentSub.files || currentSub.files.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();

      for (const file of currentSub.files) {
        const fileUrl = file.downloadUrl || file.previewUrl;
        if (fileUrl) {
          try {
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            zip.file(file.name, blob);
          } catch {
            zip.file(file.name, `File: ${file.name}\nSize: ${file.size}\nURL: ${fileUrl}`);
          }
        } else {
          zip.file(file.name, `File: ${file.name}\nSize: ${file.size}`);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${currentSub.uploadId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      // Mark all files & session as downloaded
      const updated = await markSessionDownloaded(currentSub.id);
      if (updated) {
        setCurrentSub(updated);
        onSubmissionUpdated(updated);
      }
    } catch (err) {
      console.error('Error creating ZIP archive:', err);
    } finally {
      setIsZipping(false);
    }
  };

  // Delete individual file
  const handleConfirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setIsProcessing(true);
    try {
      const updated = await deleteIndividualFile(currentSub.id, fileToDelete.fileId);
      if (updated) {
        setCurrentSub(updated);
        onSubmissionUpdated(updated);
      }
      setFileToDelete(null);
    } catch (err) {
      console.error('Error deleting individual file:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Move entire session to Trash
  const handleConfirmMoveToTrash = async () => {
    setIsProcessing(true);
    try {
      await moveSubmissionToTrash(currentSub.id);
      onSubmissionDeleted(currentSub.id);
      onClose();
    } catch (err) {
      console.error('Error moving session to trash:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Permanently delete session and all files from Firestore and Cloud Storage
  const handleConfirmPermanentDelete = async () => {
    setIsProcessing(true);
    try {
      await deletePermanently(currentSub);
      onSubmissionDeleted(currentSub.id);
      onClose();
    } catch (err) {
      console.error('Error permanently deleting session:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceiptWindow = () => {
    window.print();
  };

  // Zoom handlers for image preview
  const handleZoomIn = () => setZoomScale((prev) => Math.min(3, prev + 0.25));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(0.5, prev - 0.25));
  const handleResetZoom = () => setZoomScale(1);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 flex items-center justify-center p-3 sm:p-6 backdrop-blur-xs animate-in fade-in">
      <div className="relative max-w-4xl w-full mc-card bg-white border-3 border-black shadow-[10px_10px_0px_#000] max-h-[92vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="p-4 sm:p-5 border-b-3 border-black bg-zinc-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-9 h-9 bg-[#2563EB] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center">
              <Layers className="w-5 h-5 text-[#FFD43B]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-pixel text-base sm:text-lg font-black text-zinc-950">
                  {currentSub.uploadId}
                </h2>
                <StatusBadge status={currentSub.status} size="sm" />
                {currentSub.pinned && (
                  <span className="bg-amber-400 text-black px-1.5 py-0.2 border border-black font-pixel text-[8px] uppercase">
                    PINNED
                  </span>
                )}
                {currentSub.archived && (
                  <span className="bg-zinc-400 text-black px-1.5 py-0.2 border border-black font-pixel text-[8px] uppercase">
                    ARCHIVED
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-600 font-medium">
                Uploaded {currentSub.date} at {currentSub.time}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Pin Toggle */}
            <button
              type="button"
              onClick={handleTogglePin}
              className={`p-1.5 border-2 border-black shadow-[1px_1px_0px_#000] ${
                currentSub.pinned ? 'bg-amber-400 text-black' : 'bg-white hover:bg-zinc-100 text-zinc-700'
              }`}
              title={currentSub.pinned ? 'Unpin session' : 'Pin session to top'}
            >
              <Pin className="w-4 h-4" />
            </button>

            {/* Archive Toggle */}
            <button
              type="button"
              onClick={handleToggleArchive}
              className={`p-1.5 border-2 border-black shadow-[1px_1px_0px_#000] ${
                currentSub.archived ? 'bg-zinc-700 text-white' : 'bg-white hover:bg-zinc-100 text-zinc-700'
              }`}
              title={currentSub.archived ? 'Unarchive session' : 'Archive session'}
            >
              <Archive className="w-4 h-4" />
            </button>

            {/* Print Slip / Receipt */}
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="p-1.5 bg-white hover:bg-zinc-100 border-2 border-black text-zinc-800 shadow-[1px_1px_0px_#000]"
              title="Print Customer Job Receipt"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              id="close-detail-modal-btn"
              type="button"
              onClick={onClose}
              className="p-1.5 bg-zinc-200 hover:bg-zinc-300 border-2 border-black text-zinc-800 transition-colors shadow-[2px_2px_0px_#000]"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Session Overview Card */}
          <div className="p-4 bg-[#f8fafc] border-2 border-black shadow-[3px_3px_0px_#000] grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <span className="block text-[10px] font-bold text-zinc-500 uppercase">Upload ID</span>
              <span className="font-mono font-bold text-zinc-900">{currentSub.uploadId}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-zinc-500 uppercase">Date & Time</span>
              <span className="font-medium text-zinc-900">{currentSub.date} • {currentSub.time}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-zinc-500 uppercase">Total Files</span>
              <span className="font-bold text-blue-700">{currentSub.fileCount} Files</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-zinc-500 uppercase">Total Size</span>
              <span className="font-mono font-bold text-emerald-700">{formatFileSize(currentSub.totalSize)}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-zinc-500 uppercase">Device Type</span>
              <span className="font-bold text-zinc-800 flex items-center gap-1">
                {currentSub.deviceType === 'Mobile' ? (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Mobile</span>
                  </>
                ) : (
                  <>
                    <Laptop className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Desktop</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Tags Section */}
          <div className="p-3 bg-zinc-50 border-2 border-black space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[10px] uppercase text-zinc-900 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                SESSION TAGS
              </span>
              <div className="flex gap-1">
                {['urgent', 'tarpaulin', 'stickers', 'ready', 'paid'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddTag(preset)}
                    className="text-[9px] font-bold uppercase bg-white hover:bg-zinc-200 border border-black px-1.5 py-0.5 text-zinc-700"
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(currentSub.adminTags || []).map((t) => (
                <span
                  key={t}
                  className="bg-blue-100 text-blue-900 border border-blue-800 text-[10px] font-mono font-bold px-2 py-0.5 flex items-center gap-1"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-red-700 font-black ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddTag(newTagText);
                }}
                className="inline-flex"
              >
                <input
                  type="text"
                  value={newTagText}
                  onChange={(e) => setNewTagText(e.target.value)}
                  placeholder="+ tag..."
                  className="p-1 text-[10px] border border-black font-mono w-24 bg-white"
                />
              </form>
            </div>
          </div>

          {/* Status Control Panel */}
          <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-black uppercase text-zinc-900 tracking-wide block mb-1">
                OPERATIONAL STATUS
              </span>
              <p className="text-[11px] text-zinc-500">
                Update workflow stage as files are opened, downloaded, printed, or archived.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleStatusChange('NEW')}
                className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-black transition-all ${
                  (currentSub.status || '').toUpperCase() === 'NEW'
                    ? 'bg-[#FFD43B] text-black shadow-[2px_2px_0px_#000]'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                NEW
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('OPENED')}
                className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-black transition-all ${
                  (currentSub.status || '').toUpperCase() === 'OPENED'
                    ? 'bg-orange-200 text-orange-950 shadow-[2px_2px_0px_#000]'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                OPENED
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('DOWNLOADED')}
                className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-black transition-all ${
                  (currentSub.status || '').toUpperCase() === 'DOWNLOADED'
                    ? 'bg-[#2563EB] text-white shadow-[2px_2px_0px_#000]'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                DOWNLOADED
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('COMPLETED')}
                className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-black transition-all flex items-center gap-1 ${
                  (currentSub.status || '').toUpperCase() === 'COMPLETED'
                    ? 'bg-[#16a34a] text-white shadow-[2px_2px_0px_#000]'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>COMPLETED</span>
              </button>

              <button
                type="button"
                onClick={() => handleStatusChange('ARCHIVED')}
                className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-black transition-all flex items-center gap-1 ${
                  (currentSub.status || '').toUpperCase() === 'ARCHIVED'
                    ? 'bg-zinc-400 text-zinc-950 shadow-[2px_2px_0px_#000]'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>ARCHIVE</span>
              </button>
            </div>
          </div>

          {/* Uploaded Files Section with Phase 3 Metadata */}
          <div>
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="font-pixel text-xs sm:text-sm font-black uppercase text-zinc-900">
                  UPLOADED FILES ({currentSub.files?.length || 0})
                </h3>
              </div>

              {/* DOWNLOAD ALL Button */}
              {currentSub.files && currentSub.files.length > 0 && (
                <button
                  id="download-all-zip-btn"
                  type="button"
                  disabled={isZipping}
                  onClick={handleDownloadAllAsZip}
                  className="mc-btn-success px-3 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{isZipping ? 'CREATING ZIP...' : 'DOWNLOAD ALL (ZIP)'}</span>
                </button>
              )}
            </div>

            {/* Files List */}
            {(!currentSub.files || currentSub.files.length === 0) ? (
              <p className="text-xs text-zinc-500 italic p-4 text-center border-2 border-dashed border-zinc-300">
                No files remaining in this session.
              </p>
            ) : (
              <div className="space-y-2.5">
                {currentSub.files.map((file) => (
                  <div
                    key={file.fileId}
                    className="p-3.5 bg-zinc-50 border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    {/* File Meta */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                        <FileIconComponent type={file.type || file.name} className="w-5 h-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-black text-zinc-950 truncate font-mono" title={file.name}>
                            {file.name}
                          </p>

                          {/* Downloaded indicator badge */}
                          {file.isDownloaded && (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-700 text-[10px] font-black px-1.5 py-0.2 uppercase flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>DOWNLOADED</span>
                            </span>
                          )}

                          {/* Category Badge */}
                          {file.category && (
                            <span className="bg-zinc-200 text-zinc-800 border border-zinc-400 text-[9px] font-black px-1.5 py-0.2 uppercase">
                              {file.category}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-zinc-600 mt-0.5">
                          <span className="bg-zinc-200 px-1.5 py-0.5 border border-zinc-400 font-bold uppercase text-[10px]">
                            {file.type || 'FILE'}
                          </span>
                          <span className="font-mono font-semibold">{formatFileSize(file.size)}</span>
                          
                          {/* Resolution if available */}
                          {file.imageDimensions && (
                            <span className="font-mono text-purple-700 font-bold">
                              • {file.imageDimensions.width}×{file.imageDimensions.height}px
                            </span>
                          )}

                          {/* Page count if available */}
                          {file.pageCount && (
                            <span className="font-mono text-red-700 font-bold">
                              • {file.pageCount} Pages
                            </span>
                          )}

                          {/* Checksum Hash if available */}
                          {file.hash && (
                            <span className="font-mono text-[10px] text-zinc-400" title={`SHA-256: ${file.hash}`}>
                              • #{file.hash.slice(0, 8)}...
                            </span>
                          )}
                        </div>

                        {file.downloadedAt && (
                          <div className="text-[10px] text-emerald-700 font-bold uppercase mt-1">
                            Retrieved: {formatDate(file.downloadedAt)} at {formatTime(file.downloadedAt)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* File Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-200 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFile(file);
                          setZoomScale(1);
                        }}
                        className="mc-btn-secondary px-2.5 py-1.5 text-xs font-black uppercase flex items-center gap-1 shadow-[1px_1px_0px_#000]"
                        title="Preview file"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>PREVIEW</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadFile(file)}
                        disabled={downloadingFileId === file.fileId}
                        className="mc-btn-primary px-2.5 py-1.5 text-xs font-black uppercase flex items-center gap-1 shadow-[1px_1px_0px_#000]"
                        title="Download file"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{downloadingFileId === file.fileId ? '...' : 'DOWNLOAD'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFileToDelete(file)}
                        className="p-1.5 bg-red-100 hover:bg-red-200 border-2 border-black text-red-700 shadow-[1px_1px_0px_#000] transition-colors"
                        title="Delete file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Internal Staff Notes Section */}
          <div className="p-4 bg-zinc-50 border-2 border-black space-y-3 shadow-[2px_2px_0px_#000]">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-300">
              <MessageSquare className="w-4 h-4 text-zinc-700" />
              <h4 className="font-pixel text-xs font-black uppercase text-zinc-900">
                INTERNAL STAFF NOTES (NOT VISIBLE TO CUSTOMER)
              </h4>
            </div>

            {/* Note form */}
            <form onSubmit={handleAddNote} className="flex gap-2">
              <input
                type="text"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Add counter notes, printing details, customer instructions..."
                className="flex-1 p-2 border-2 border-black text-xs font-bold bg-white"
              />
              <button
                type="submit"
                className="mc-btn-primary py-2 px-3 text-xs font-black uppercase flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD NOTE</span>
              </button>
            </form>

            {/* Notes list */}
            {(!currentSub.adminNotes || currentSub.adminNotes.length === 0) ? (
              <p className="text-[11px] text-zinc-500 italic">No notes added for this job session.</p>
            ) : (
              <div className="space-y-1.5">
                {currentSub.adminNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-2.5 bg-white border border-black text-xs flex items-start justify-between gap-2 shadow-[1px_1px_0px_#000]"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mb-0.5">
                        <strong className="text-blue-700 font-bold">{note.author}</strong>
                        <span>•</span>
                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-zinc-900 font-bold">{note.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-zinc-400 hover:text-red-700 text-xs font-black p-0.5"
                      title="Delete note"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 border-t-3 border-black bg-zinc-100 flex items-center justify-between shrink-0 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTrashSessionModal(true)}
              className="p-2 bg-amber-100 hover:bg-amber-200 border-2 border-black text-amber-900 text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
            >
              <Trash2 className="w-4 h-4 text-amber-700" />
              <span>MOVE TO TRASH</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPermanentDeleteModal(true)}
              className="p-2 bg-red-100 hover:bg-red-200 border-2 border-black text-red-700 text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>PERMANENT DELETE</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mc-btn-secondary px-5 py-2 text-xs font-extrabold uppercase shadow-[2px_2px_0px_#000]"
          >
            CLOSE
          </button>
        </div>
      </div>

      {/* Printable Job Slip / Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-70 bg-black/80 flex items-center justify-center p-4">
          <div className="mc-card p-6 bg-white border-3 border-black shadow-[8px_8px_0px_#000] max-w-md w-full space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b-2 border-black">
              <h3 className="font-pixel text-xs text-zinc-900 uppercase">
                COUNTER JOB TICKET / RECEIPT
              </h3>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="p-1 border border-black hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Content Block */}
            <div id="print-job-receipt" className="border-2 border-dashed border-black p-4 font-mono text-xs space-y-3 bg-zinc-50">
              <div className="text-center border-b border-black pb-2">
                <div className="font-pixel text-xs font-bold">OYANGOREN PRINTING SERVICES</div>
                <div className="text-[10px] text-zinc-600">CUSTOMER UPLOAD JOB SLIP</div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div><strong>UPLOAD ID:</strong> {currentSub.uploadId}</div>
                  <div><strong>DATE:</strong> {currentSub.date}</div>
                  <div><strong>TIME:</strong> {currentSub.time}</div>
                  <div><strong>DEVICE:</strong> {currentSub.deviceType || 'Counter QR'}</div>
                </div>
                <div className="bg-white p-1 border border-black">
                  {ticketQrUrl ? (
                    <img src={ticketQrUrl} alt={currentSub.uploadId} className="w-16 h-16" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-16 h-16 bg-zinc-200 flex items-center justify-center text-[8px]">QR</div>
                  )}
                </div>
              </div>

              <div className="border-t border-b border-black py-2 space-y-1">
                <div className="font-bold">FILES ({currentSub.fileCount}):</div>
                {currentSub.files?.map((f, i) => (
                  <div key={f.fileId} className="text-[11px] truncate flex justify-between">
                    <span>{i + 1}. {f.name}</span>
                    <span>{formatFileSize(f.size)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between font-bold">
                <span>TOTAL SIZE:</span>
                <span>{formatFileSize(currentSub.totalSize)}</span>
              </div>

              {currentSub.adminNotes && currentSub.adminNotes.length > 0 && (
                <div className="border-t border-black pt-1 text-[10px]">
                  <strong>STAFF NOTES:</strong>
                  <div>{currentSub.adminNotes.map((n) => n.text).join(' | ')}</div>
                </div>
              )}

              <div className="pt-4 border-t border-black text-[10px] flex justify-between text-zinc-600">
                <span>Staff Initials: __________</span>
                <span>Claim Slip</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handlePrintReceiptWindow}
                className="mc-btn-primary py-2 px-4 text-xs font-black uppercase flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PRINT JOB TICKET</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal with Zoom & Fullscreen Controls */}
      {previewFile && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
          <div className={`relative max-w-4xl w-full mc-card bg-white border-3 border-black shadow-[8px_8px_0px_#000] p-4 flex flex-col ${isFullscreen ? 'h-full max-h-none' : 'max-h-[92vh]'}`}>
            {/* Preview Header & Zoom Controls */}
            <div className="flex flex-wrap items-center justify-between border-b-2 border-black pb-3 mb-3 gap-2">
              <div className="min-w-0 flex-1 pr-2">
                <h4 className="font-mono text-sm font-bold truncate text-zinc-900">{previewFile.name}</h4>
                <p className="text-[11px] text-zinc-500 font-medium">
                  {previewFile.type} • {formatFileSize(previewFile.size)}
                  {previewFile.imageDimensions && ` • ${previewFile.imageDimensions.width}x${previewFile.imageDimensions.height}px`}
                </p>
              </div>

              {/* Zoom & Action Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 bg-zinc-100 hover:bg-zinc-200 border-2 border-black text-zinc-800"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 bg-zinc-100 hover:bg-zinc-200 border-2 border-black text-zinc-800"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1.5 bg-zinc-100 hover:bg-zinc-200 border-2 border-black text-zinc-800 text-[11px] font-bold"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 bg-zinc-100 hover:bg-zinc-200 border-2 border-black text-zinc-800"
                  title="Toggle Fullscreen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 bg-zinc-200 hover:bg-zinc-300 border-2 border-black text-zinc-800 ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Canvas Area */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-zinc-100 border-2 border-black min-h-[350px]">
              {previewFile.previewUrl || previewFile.downloadUrl ? (
                previewFile.type.includes('IMAGE') || ['JPG', 'JPEG', 'PNG', 'WEBP', 'GIF', 'SVG'].some((ext) => previewFile.name.toUpperCase().endsWith(ext)) ? (
                  <div className="overflow-auto max-h-[70vh] flex items-center justify-center">
                    <img
                      src={previewFile.previewUrl || previewFile.downloadUrl}
                      alt={previewFile.name}
                      style={{ transform: `scale(${zoomScale})`, transformOrigin: 'center center' }}
                      className="max-h-[65vh] max-w-full object-contain border border-black shadow transition-transform duration-100"
                    />
                  </div>
                ) : previewFile.name.toUpperCase().endsWith('.PDF') ? (
                  <iframe
                    src={previewFile.downloadUrl || previewFile.previewUrl}
                    title={previewFile.name}
                    className="w-full h-[65vh] border border-black"
                  />
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <FileIconComponent type={previewFile.type} className="w-16 h-16 mx-auto text-zinc-500" />
                    <div>
                      <p className="text-sm font-bold text-zinc-800 font-mono">{previewFile.name}</p>
                      <p className="text-xs text-zinc-500 font-semibold uppercase mt-0.5">
                        {previewFile.type} • {formatFileSize(previewFile.size)}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-zinc-600 max-w-xs mx-auto">
                      Office files (.docx, .xlsx, .pptx) are ready to download and print directly.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(previewFile)}
                      className="mc-btn-primary px-4 py-2 text-xs font-black uppercase inline-flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>DOWNLOAD ORIGINAL FILE</span>
                    </button>
                  </div>
                )
              ) : (
                <div className="text-center p-6">
                  <p className="text-xs font-bold text-zinc-600">No preview available.</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleDownloadFile(previewFile)}
                className="mc-btn-primary px-4 py-2 text-xs font-black uppercase flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>DOWNLOAD FILE</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="mc-btn-secondary px-4 py-2 text-xs font-bold uppercase"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete File Confirmation */}
      {fileToDelete && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full mc-card bg-white border-3 border-black shadow-[6px_6px_0px_#000] p-5 text-center">
            <AlertTriangle className="w-10 h-10 text-red-600 mx-auto mb-3" />
            <h4 className="font-pixel text-sm font-black uppercase text-zinc-950 mb-1">
              Delete File?
            </h4>
            <p className="text-xs text-zinc-600 mb-4 font-mono truncate">
              "{fileToDelete.name}"
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="mc-btn-secondary px-4 py-2 text-xs font-bold uppercase"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmDeleteFile}
                className="p-2 bg-red-600 text-white border-2 border-black text-xs font-black uppercase"
              >
                {isProcessing ? 'DELETING...' : 'CONFIRM DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Session to Trash Confirmation */}
      {showTrashSessionModal && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="max-w-md w-full mc-card bg-white border-3 border-black shadow-[6px_6px_0px_#000] p-5 text-center">
            <Trash2 className="w-10 h-10 text-red-600 mx-auto mb-3" />
            <h4 className="font-pixel text-sm font-black uppercase text-zinc-950 mb-1">
              Move to Trash?
            </h4>
            <p className="text-xs text-zinc-600 mb-4">
              Session <strong className="font-mono">{currentSub.uploadId}</strong> will be moved to the Trash. You can restore it or permanently delete it later.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setShowTrashSessionModal(false)}
                className="mc-btn-secondary px-4 py-2 text-xs font-bold uppercase"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmMoveToTrash}
                className="p-2 bg-red-600 text-white border-2 border-black text-xs font-black uppercase"
              >
                {isProcessing ? 'MOVING...' : 'YES, MOVE TO TRASH'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Session Confirmation */}
      {showPermanentDeleteModal && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4">
          <div className="max-w-md w-full mc-card bg-white border-3 border-black shadow-[8px_8px_0px_#000] p-5 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto" />
            <h4 className="font-pixel text-sm font-black uppercase text-red-600">
              PERMANENTLY ERASE SESSION?
            </h4>
            <p className="text-xs text-zinc-700 leading-relaxed font-medium">
              This will permanently delete session <strong className="font-mono">{currentSub.uploadId}</strong> and all <strong className="font-mono">{currentSub.fileCount} file(s)</strong> directly from Firebase Cloud Storage and Firestore database.
            </p>
            <div className="p-2 bg-red-50 border border-red-300 text-[11px] text-red-800 font-bold">
              ⚠️ WARNING: This action is irreversible. Files cannot be recovered after deletion.
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setShowPermanentDeleteModal(false)}
                className="mc-btn-secondary px-4 py-2 text-xs font-bold uppercase"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmPermanentDelete}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_#000]"
              >
                {isProcessing ? 'ERASING...' : 'ERASE PERMANENTLY'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
