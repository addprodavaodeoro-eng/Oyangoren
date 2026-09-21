import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  UploadCloud, 
  Trash2, 
  AlertCircle, 
  File as FileIcon, 
  CheckCircle2, 
  ShieldCheck,
  Plus,
  WifiOff,
  AlertTriangle,
  RotateCcw,
  Wrench,
  Zap,
  Pause,
  Clock,
  HardDrive
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  formatFileSize, 
  getStoredSettings, 
  isDangerousExtension,
  categorizeFile
} from '../lib/settings';
import { 
  uploadFileToStorageResumable,
  createCustomerSubmission,
  generateUploadId,
  detectDeviceType,
  ResumableUploadHandle
} from '../lib/submissionService';
import { UploadFileItem, UploadSession, UploadedFileRecord } from '../types';

interface CustomerUploadViewProps {
  onSuccess: (submission: UploadSession) => void;
  onOpenAdminLogin: () => void;
}

interface DuplicatePrompt {
  file: File;
  name: string;
}

// Concurrency queue limited to 3-5 simultaneous uploads (3 for mobile, 5 for desktop)
function getOptimalConcurrency(): number {
  const isMobile = detectDeviceType() === 'Mobile';
  return isMobile ? 3 : 5;
}

const QUEUE_STORAGE_KEY = 'customer_upload_queue_persisted_v1';

function getFriendlyUploadErrorMessage(err: any): string {
  if (!err) return 'Network connection error during upload.';
  const code = err?.code || '';
  if (code === 'storage/unauthorized') {
    return 'Permission denied: Cloud storage security rules restricted write access.';
  }
  if (code === 'storage/quota-exceeded') {
    return 'Cloud storage quota exceeded. Please contact admin.';
  }
  if (code === 'storage/canceled') {
    return 'Upload was cancelled.';
  }
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/unknown') {
    return 'Network connection interrupted. Check connection & tap RETRY.';
  }
  if (code === 'storage/invalid-checksum') {
    return 'File integrity check failed. Please tap RETRY.';
  }
  if (typeof err?.message === 'string') {
    if (err.message.includes('cancelled') || err.message.includes('canceled')) return 'Upload was cancelled.';
    if (err.message.includes('offline') || err.message.includes('Network Error')) return 'Network offline. Tap RETRY when connected.';
    return err.message;
  }
  return 'Upload failed due to a network error. Tap RETRY to resume.';
}

interface PersistedQueueItem {
  id: string;
  name: string;
  size: number;
  type: string;
  extension: string;
  progress: number;
  status: string;
  downloadUrl?: string;
  storagePath?: string;
  error?: string;
}

function saveQueueToLocalStorage(files: UploadFileItem[]) {
  try {
    const serializable: PersistedQueueItem[] = files.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      extension: f.extension,
      progress: f.progress,
      status: f.status,
      downloadUrl: f.downloadUrl,
      storagePath: f.storagePath,
      error: f.error
    }));
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(serializable));
  } catch (err) {
    console.warn('Failed to persist upload queue to localStorage:', err);
  }
}

function clearQueueFromLocalStorage() {
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch {}
}

export const CustomerUploadView: React.FC<CustomerUploadViewProps> = ({
  onSuccess,
  onOpenAdminLogin
}) => {
  const [files, setFiles] = useState<UploadFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [transferSpeedText, setTransferSpeedText] = useState<string>('');
  const [speedMetrics, setSpeedMetrics] = useState<{
    speed: string;
    eta: string;
    remaining: string;
  } | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt | null>(null);
  const [pendingDuplicatesQueue, setPendingDuplicatesQueue] = useState<File[]>([]);

  // Refs for high-speed tracking without stalling React state
  const activeHandlesRef = useRef<Map<string, ResumableUploadHandle>>(new Map());
  const bytesMapRef = useRef<Map<string, number>>(new Map());
  const totalBytesRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<boolean>(false);
  const wakeLockRef = useRef<any>(null);
  // 2-second moving window buffer for smooth, accurate real-time MB/s transfer speed & time remaining
  const speedSamplesRef = useRef<Array<{ time: number; bytes: number }>>([]);
  const fileUpdateThrottleRef = useRef<Map<string, number>>(new Map());
  const uiThrottleTimerRef = useRef<number | null>(null);

  const settings = getStoredSettings();

  // Screen Wake Lock API to prevent phone screen from sleeping during upload
  const acquireWakeLock = async () => {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch {
        // Silently ignore if not supported or permission denied
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
    }
  };

  // Prevent accidental tab closing while uploading
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = 'Upload in progress. Leaving will interrupt your transfer.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading]);

  // Automatically persist upload queue metadata to localStorage
  useEffect(() => {
    if (files.length > 0) {
      saveQueueToLocalStorage(files);
    } else {
      clearQueueFromLocalStorage();
    }
  }, [files]);

  // Monitor network connection for automatic pause & resume
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isUploading && isPaused) {
        activeHandlesRef.current.forEach((handle) => handle.resume());
        setIsPaused(false);
      } else if (isUploading) {
        activeHandlesRef.current.forEach((handle) => handle.resume());
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (isUploading) {
        activeHandlesRef.current.forEach((handle) => handle.pause());
        setIsPaused(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isUploading, isPaused]);

  // Cleanup timers & wake lock on unmount
  useEffect(() => {
    return () => {
      if (uiThrottleTimerRef.current) {
        window.clearTimeout(uiThrottleTimerRef.current);
      }
      releaseWakeLock();
    };
  }, []);

  const openFilePicker = () => {
    if (settings.maintenanceMode || settings.pauseNewUploads || isUploading) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFilesAdded = (incomingFiles: FileList | File[]) => {
    setErrorMessage(null);
    const maxFileSize = (settings.maxFileSizeMB || 500) * 1024 * 1024;
    const maxAllowedFiles = settings.maxFilesPerSubmission || 50;

    const acceptedItems: UploadFileItem[] = [];
    const duplicateFiles: File[] = [];

    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i];

      if (files.length + acceptedItems.length >= maxAllowedFiles) {
        setErrorMessage(`Maximum upload limit reached (${maxAllowedFiles} files per upload session).`);
        break;
      }

      if (file.size > maxFileSize) {
        setErrorMessage(`File "${file.name}" exceeds maximum allowed size of ${settings.maxFileSizeMB || 500} MB.`);
        continue;
      }

      const parts = file.name.split('.');
      const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : '';

      if (isDangerousExtension(ext)) {
        setErrorMessage(`Potentially dangerous executable file "${file.name}" was blocked for security.`);
        continue;
      }

      const existingMatch = files.some((f) => f.name.toLowerCase() === file.name.toLowerCase()) ||
        acceptedItems.some((f) => f.name.toLowerCase() === file.name.toLowerCase());

      if (existingMatch) {
        duplicateFiles.push(file);
      } else {
        acceptedItems.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || ext.toUpperCase() || 'FILE',
          extension: ext,
          progress: 0,
          status: 'pending'
        });
      }
    }

    if (acceptedItems.length > 0) {
      setFiles((prev) => [...prev, ...acceptedItems]);
    }

    if (duplicateFiles.length > 0) {
      const first = duplicateFiles[0];
      setPendingDuplicatesQueue(duplicateFiles.slice(1));
      setDuplicatePrompt({ file: first, name: first.name });
    }
  };

  const handleKeepDuplicate = () => {
    if (!duplicatePrompt) return;
    const file = duplicatePrompt.file;
    const parts = file.name.split('.');
    const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : '';

    setFiles((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type || ext.toUpperCase() || 'FILE',
        extension: ext,
        progress: 0,
        status: 'pending'
      }
    ]);

    if (pendingDuplicatesQueue.length > 0) {
      const next = pendingDuplicatesQueue[0];
      setPendingDuplicatesQueue((prev) => prev.slice(1));
      setDuplicatePrompt({ file: next, name: next.name });
    } else {
      setDuplicatePrompt(null);
    }
  };

  const handleRemoveDuplicate = () => {
    if (pendingDuplicatesQueue.length > 0) {
      const next = pendingDuplicatesQueue[0];
      setPendingDuplicatesQueue((prev) => prev.slice(1));
      setDuplicatePrompt({ file: next, name: next.name });
    } else {
      setDuplicatePrompt(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!settings.maintenanceMode && !settings.pauseNewUploads && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (settings.maintenanceMode || settings.pauseNewUploads || isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (id: string) => {
    if (isUploading) return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const totalBytes = useMemo(() => files.reduce((acc, f) => acc + f.size, 0), [files]);
  const failedFiles = useMemo(() => files.filter((f) => f.status === 'error' || f.status === 'failed'), [files]);

  const queueCounts = useMemo(() => {
    let active = 0;
    let pending = 0;
    let completed = 0;
    let failed = 0;
    files.forEach((f) => {
      if (f.status === 'uploading') active++;
      else if (f.status === 'pending' || f.status === 'waiting') pending++;
      else if (f.status === 'completed') completed++;
      else if (f.status === 'error' || f.status === 'failed') failed++;
    });
    return { active, pending, completed, failed };
  }, [files]);

  // Throttled UI Progress & Speed Calculator with 2-second moving window
  const scheduleUIProgressUpdate = useCallback(() => {
    if (uiThrottleTimerRef.current !== null) return;

    uiThrottleTimerRef.current = window.setTimeout(() => {
      uiThrottleTimerRef.current = null;

      let currentTransferredBytes = 0;
      bytesMapRef.current.forEach((bytes) => {
        currentTransferredBytes += bytes;
      });

      const total = totalBytesRef.current || 1;
      const progressPercent = Math.min(99, Math.round((currentTransferredBytes / total) * 100));
      setOverallProgress(progressPercent);

      // 2-second moving window sliding buffer calculation
      const now = performance.now();
      const samples = speedSamplesRef.current;
      samples.push({ time: now, bytes: currentTransferredBytes });

      // Keep samples within a 2000ms (2-second) moving window
      const windowStart = now - 2000;
      while (samples.length > 0 && samples[0].time < windowStart) {
        samples.shift();
      }

      if (samples.length >= 2) {
        const oldest = samples[0];
        const newest = samples[samples.length - 1];
        const timeSpanSec = (newest.time - oldest.time) / 1000;

        if (timeSpanSec > 0.1) {
          const bytesTransferredInWindow = Math.max(0, newest.bytes - oldest.bytes);
          const bps = bytesTransferredInWindow / timeSpanSec; // bytes per second
          const speedInMBps = bps / (1024 * 1024); // speed in MB/s

          const remainingBytes = Math.max(0, total - currentTransferredBytes);
          const estSeconds = bps > 0 ? Math.round(remainingBytes / bps) : 0;

          // Format speed display in MB/s
          const speedFormatted = speedInMBps >= 0.01 
            ? `${speedInMBps.toFixed(2)} MB/s` 
            : `${formatFileSize(bps)}/s`;

          let timeFormatted = '';
          if (estSeconds < 60) {
            timeFormatted = `${estSeconds}s remaining`;
          } else {
            const mins = Math.floor(estSeconds / 60);
            const secs = estSeconds % 60;
            timeFormatted = `${mins}m ${secs}s remaining`;
          }

          setSpeedMetrics({
            speed: speedFormatted,
            eta: timeFormatted,
            remaining: `${formatFileSize(remainingBytes)} left`
          });
          setTransferSpeedText(`Speed: ${speedFormatted} • ETA: ${timeFormatted}`);
        }
      }
    }, 250);
  }, []);

  // START PARALLEL DIRECT-TO-CLOUD UPLOAD
  const handleStartUpload = async () => {
    if (files.length === 0) {
      setErrorMessage('Please select at least one file to upload.');
      return;
    }

    if (settings.maintenanceMode) {
      setErrorMessage('Uploads are temporarily disabled during system maintenance.');
      return;
    }

    if (settings.pauseNewUploads) {
      setErrorMessage('New uploads are temporarily paused by administrator.');
      return;
    }

    setIsUploading(true);
    setIsPaused(false);
    setErrorMessage(null);
    setSpeedMetrics(null);
    setTransferSpeedText('Starting direct upload...');
    uploadAbortRef.current = false;
    activeHandlesRef.current.clear();
    speedSamplesRef.current = [{ time: performance.now(), bytes: 0 }];

    await acquireWakeLock();

    const submissionDocId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const uploadId = generateUploadId(); // Format: UPLOAD-YYYYMMDD-001

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Populate initial state maps
    totalBytesRef.current = totalBytes;
    const completedRecordsMap = new Map<string, UploadedFileRecord>();

    // Seed completed records for already uploaded files (when retrying failed files)
    files.forEach((f) => {
      if (f.status === 'completed' && f.downloadUrl) {
        bytesMapRef.current.set(f.id, f.size);
        completedRecordsMap.set(f.id, {
          fileId: f.id,
          name: f.name,
          type: f.name.split('.').pop()?.toUpperCase() || 'FILE',
          size: f.size,
          storagePath: f.storagePath,
          downloadUrl: f.downloadUrl,
          uploadedAt: new Date().toISOString(),
          uploadDate: formattedDate,
          uploadTime: formattedTime,
          category: categorizeFile(f.name, f.type)
        });
      } else {
        bytesMapRef.current.set(f.id, 0);
      }
    });

    setCompletedCount(completedRecordsMap.size);

    // Queue of files that need uploading, prioritized by file size (files < 1MB first, then sorted ascending)
    const ONE_MB = 1024 * 1024;
    const queueToUpload = files
      .filter((f) => f.status !== 'completed' || !f.downloadUrl)
      .sort((a, b) => {
        const aIsSmall = a.size < ONE_MB;
        const bIsSmall = b.size < ONE_MB;
        if (aIsSmall && !bIsSmall) return -1;
        if (!aIsSmall && bIsSmall) return 1;
        return a.size - b.size;
      });
    const concurrency = getOptimalConcurrency();

    let queueIndex = 0;
    let hasFailures = false;

    // Worker function for parallel slots
    const runUploadSlot = async () => {
      while (queueIndex < queueToUpload.length && !uploadAbortRef.current) {
        const item = queueToUpload[queueIndex];
        queueIndex++;

        // Update item UI state to uploading
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: 'uploading', progress: f.progress || 1, error: undefined } : f))
        );

        try {
          // Direct resumable Firebase Storage upload (no pre-upload hashing or memory duplication!)
          const handle = uploadFileToStorageResumable(
            uploadId,
            item.id,
            item.file,
            (filePercent, bytesTransferred) => {
              bytesMapRef.current.set(item.id, bytesTransferred);
              scheduleUIProgressUpdate();

              // Throttle DOM state updates for individual file percentages to once every 250ms to save CPU
              const now = performance.now();
              const lastUpdate = fileUpdateThrottleRef.current.get(item.id) || 0;
              if (now - lastUpdate >= 250 || filePercent === 100) {
                fileUpdateThrottleRef.current.set(item.id, now);
                setFiles((prev) =>
                  prev.map((f) => {
                    if (f.id === item.id) {
                      if (f.progress === filePercent) return f;
                      return { ...f, progress: filePercent };
                    }
                    return f;
                  })
                );
              }
            }
          );

          activeHandlesRef.current.set(item.id, handle);
          const uploadResult = await handle.promise;
          activeHandlesRef.current.delete(item.id);

          bytesMapRef.current.set(item.id, item.size);

          const extension = item.name.split('.').pop()?.toUpperCase() || 'FILE';
          const record: UploadedFileRecord = {
            fileId: item.id,
            name: item.name,
            type: extension,
            size: item.size,
            storagePath: uploadResult.storagePath,
            downloadUrl: uploadResult.downloadUrl,
            category: uploadResult.category,
            scanStatus: uploadResult.scanStatus,
            uploadedAt: new Date().toISOString(),
            uploadDate: formattedDate,
            uploadTime: formattedTime
          };

          completedRecordsMap.set(item.id, record);
          setCompletedCount(completedRecordsMap.size);

          // Mark item completed in state
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? {
                    ...f,
                    status: 'completed',
                    progress: 100,
                    downloadUrl: uploadResult.downloadUrl,
                    storagePath: uploadResult.storagePath
                  }
                : f
            )
          );
        } catch (fileErr: any) {
          activeHandlesRef.current.delete(item.id);
          hasFailures = true;
          const friendlyMsg = getFriendlyUploadErrorMessage(fileErr);
          console.error(`Upload error for ${item.name}:`, fileErr);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? { ...f, status: 'error', error: friendlyMsg }
                : f
            )
          );
        }
      }
    };

    // Launch parallel slots
    const workers = Array.from({ length: Math.min(concurrency, queueToUpload.length) }, () =>
      runUploadSlot()
    );

    await Promise.all(workers);

    releaseWakeLock();
    setIsUploading(false);

    // If all files completed successfully
    if (!hasFailures && completedRecordsMap.size === files.length) {
      setOverallProgress(100);
      setTransferSpeedText('Upload completed!');

      const uploadedRecords = Array.from(completedRecordsMap.values());
      const sessionRecord: UploadSession = {
        id: submissionDocId,
        uploadId,
        createdAt: now.toISOString(),
        date: formattedDate,
        time: formattedTime,
        fileCount: uploadedRecords.length,
        totalSize: uploadedRecords.reduce((acc, f) => acc + f.size, 0),
        status: 'NEW',
        isNew: true,
        deviceType: detectDeviceType(),
        files: uploadedRecords
      };

      // Save lightweight session metadata to Firestore once
      await createCustomerSubmission(sessionRecord);

      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch {}

      clearQueueFromLocalStorage();
      onSuccess(sessionRecord);
    } else {
      // Some files failed: Show clear notification to allow retrying just the failed files
      const failedCount = files.length - completedRecordsMap.size;
      setErrorMessage(
        `${completedRecordsMap.size} of ${files.length} files transferred successfully. ${failedCount} file(s) encountered network errors. You can tap "RETRY FAILED" below.`
      );
    }
  };

  const handleRetryAllFailed = () => {
    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'failed' || f.status === 'error'
          ? { ...f, status: 'pending', error: undefined, progress: 0 }
          : f
      )
    );
    handleStartUpload();
  };

  const handleRetrySingleFile = (id: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: 'pending', error: undefined, progress: 0 } : f
      )
    );
    handleStartUpload();
  };

  return (
    <div className="min-h-screen mc-pixel-bg py-8 px-4 flex flex-col justify-between items-center">
      {/* Hidden file input supporting ANY file type and multiple selections */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesAdded(e.target.files);
          }
        }}
      />

      {/* Main Container */}
      <div className="max-w-xl w-full">
        {/* Maintenance Mode Notice */}
        {settings.maintenanceMode && (
          <div className="mb-4 p-4 bg-amber-500 border-3 border-black text-black shadow-[4px_4px_0px_#000] flex items-center gap-3">
            <Wrench className="w-6 h-6 shrink-0" />
            <div>
              <div className="font-pixel text-xs font-black uppercase">SYSTEM MAINTENANCE IN PROGRESS</div>
              <div className="text-xs font-bold mt-0.5">Uploads are temporarily unavailable. Please check back shortly.</div>
            </div>
          </div>
        )}

        {/* Paused Uploads Notice */}
        {!settings.maintenanceMode && settings.pauseNewUploads && (
          <div className="mb-4 p-4 bg-amber-400 border-3 border-black text-black shadow-[4px_4px_0px_#000] flex items-center gap-3">
            <Pause className="w-6 h-6 shrink-0" />
            <div>
              <div className="font-pixel text-xs font-black uppercase">NEW UPLOADS PAUSED</div>
              <div className="text-xs font-bold mt-0.5">Upload intake is temporarily paused by staff. We will be back online in a moment!</div>
            </div>
          </div>
        )}

        {/* Offline notification banner */}
        {!isOnline && (
          <div className="mb-4 p-3.5 bg-amber-500 border-3 border-black text-black shadow-[4px_4px_0px_#000] flex items-center gap-2.5 text-xs font-black uppercase animate-bounce">
            <WifiOff className="w-5 h-5 shrink-0" />
            <span>CONNECTION LOST • Upload paused. Waiting for internet...</span>
          </div>
        )}

        {/* Header Branding */}
        <header className="text-center mb-6">
          <div className="inline-block bg-[#2563EB] text-white px-3 py-1 border-3 border-black shadow-[3px_3px_0px_#000] mb-2 font-pixel text-[11px] tracking-wider text-[#FFD43B]">
            ★ HIGH-SPEED PRINTING PORTAL ★
          </div>
          <h1 className="font-pixel text-xl sm:text-2xl text-zinc-950 tracking-tight leading-tight">
            OYANGOREN
          </h1>
          <div className="font-pixel text-xs sm:text-sm text-blue-700 font-bold uppercase tracking-wider mt-1">
            PRINTING SERVICES
          </div>

          {settings.customUploadMessage && (
            <p className="mt-2 text-xs font-bold text-zinc-700 bg-white/80 p-2 border-2 border-black inline-block shadow-[2px_2px_0px_#000]">
              {settings.customUploadMessage}
            </p>
          )}
        </header>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3.5 bg-red-100 border-3 border-red-900 text-red-900 shadow-[3px_3px_0px_#991b1b] flex items-start gap-2.5 text-xs font-bold animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-700 mt-0.5" />
            <div className="flex-1">{errorMessage}</div>
          </div>
        )}

        {/* Duplicate File Prompt Modal */}
        {duplicatePrompt && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="mc-card p-6 bg-white border-3 border-black shadow-[8px_8px_0px_#000] max-w-sm w-full animate-in zoom-in-95">
              <div className="flex items-center gap-2 text-amber-900 font-pixel text-xs mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>POSSIBLE DUPLICATE FILE</span>
              </div>
              <p className="text-xs font-bold text-zinc-800 mb-2">
                A file with this name is already in your upload list:
              </p>
              <p className="text-xs font-mono text-zinc-600 bg-zinc-100 p-2 border border-black break-all mb-4">
                {duplicatePrompt.name}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleKeepDuplicate}
                  className="mc-btn-primary py-2 px-3 text-xs font-black uppercase text-center"
                >
                  KEEP BOTH
                </button>
                <button
                  type="button"
                  onClick={handleRemoveDuplicate}
                  className="mc-btn-secondary py-2 px-3 text-xs font-black uppercase text-center"
                >
                  REMOVE DUPLICATE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Upload Card */}
        <div className="mc-card p-5 sm:p-7 bg-white border-3 border-black shadow-[8px_8px_0px_#000]">
          {/* Big Tap Area / Block-Style Upload Box */}
          <div
            id="dropzone-area"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFilePicker}
            className={`cursor-pointer transition-all duration-150 p-6 sm:p-8 text-center border-3 ${
              settings.maintenanceMode || settings.pauseNewUploads || isUploading
                ? 'border-zinc-400 bg-zinc-100 cursor-not-allowed opacity-75'
                : isDragging
                ? 'border-[#2563EB] bg-blue-50 scale-[1.01]'
                : 'border-black border-dashed bg-[#f8fafc] hover:bg-amber-50/50'
            } shadow-[4px_4px_0px_#000]`}
          >
            <div className="mx-auto w-16 h-16 bg-[#2563EB] border-3 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center mb-4">
              <UploadCloud className="w-8 h-8 text-[#FFD43B]" />
            </div>

            <div className={`inline-block mc-btn-primary px-5 py-3 text-sm sm:text-base font-black tracking-wide uppercase border-3 border-black shadow-[4px_4px_0px_#000] mb-3 ${
              settings.maintenanceMode || settings.pauseNewUploads || isUploading ? 'opacity-50 pointer-events-none' : ''
            }`}>
              {isDragging ? 'DROP FILES HERE' : 'UPLOAD FILES HERE'}
            </div>

            <p className="text-xs sm:text-sm font-bold text-zinc-800 uppercase tracking-wide">
              {settings.maintenanceMode ? 'System Under Maintenance' : settings.pauseNewUploads ? 'Uploads Paused' : isUploading ? 'Upload Active...' : 'Tap to choose files'}
            </p>
            <span className="text-[11px] text-zinc-500 font-semibold block mt-1 uppercase tracking-wider">
              Direct-to-cloud resumable transfer • up to {settings.maxFileSizeMB || 500} MB
            </span>

            <div className="mt-4 pt-3 border-t-2 border-dashed border-zinc-200 flex flex-wrap justify-center gap-1.5 text-[10px] font-bold text-zinc-600 uppercase">
              <span className="bg-zinc-200 px-2 py-0.5 border border-black">PDF</span>
              <span className="bg-zinc-200 px-2 py-0.5 border border-black">DOCX</span>
              <span className="bg-zinc-200 px-2 py-0.5 border border-black">IMAGES</span>
              <span className="bg-zinc-200 px-2 py-0.5 border border-black">PSD / AI</span>
              <span className="bg-zinc-200 px-2 py-0.5 border border-black">ZIP</span>
              <span className="bg-zinc-200 px-2 py-0.5 border border-black">ANY FILE</span>
            </div>
          </div>

          {/* Selected Files Section (Upload Queue) */}
          {files.length > 0 && (
            <div className="mt-6">
              {/* Header with Queue Status Bar */}
              <div className="border-b-2 border-black pb-2 mb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-pixel text-[11px] uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-blue-600" />
                    <span>UPLOAD QUEUE ({files.length} {files.length === 1 ? 'FILE' : 'FILES'})</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-600">
                    Total: {formatFileSize(totalBytes)}
                  </span>
                </div>

                {/* Queue Status Indicator Badges */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono font-bold">
                  <span className="text-zinc-500 font-sans text-[10px] font-bold uppercase tracking-wider mr-1">
                    Queue Status:
                  </span>
                  <span className={`px-2 py-0.5 border border-black flex items-center gap-1 ${
                    queueCounts.active > 0 
                      ? 'bg-blue-100 text-blue-900 border-blue-900 shadow-[1px_1px_0px_#1e3a8a]' 
                      : 'bg-zinc-100 text-zinc-600'
                  }`}>
                    {queueCounts.active > 0 && <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping"></span>}
                    <span>Active: {queueCounts.active}</span>
                  </span>

                  <span className={`px-2 py-0.5 border border-black ${
                    queueCounts.pending > 0 && isUploading
                      ? 'bg-amber-100 text-amber-900 border-amber-800'
                      : 'bg-zinc-100 text-zinc-700 border-zinc-800'
                  }`}>
                    Pending: {queueCounts.pending}
                  </span>

                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-800">
                    Completed: {queueCounts.completed}
                  </span>

                  {queueCounts.failed > 0 && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-900 border border-red-800 font-black">
                      Failed: {queueCounts.failed}
                    </span>
                  )}
                </div>
              </div>

              {/* List of files with Queue Status */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {files.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3 bg-zinc-50 border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-blue-100 border-2 border-black flex items-center justify-center shrink-0">
                          <FileIcon className="w-4 h-4 text-blue-700" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-zinc-900 truncate" title={item.name}>
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono mt-0.5">
                            <span>{formatFileSize(item.size)}</span>
                            
                            {/* Status Badges */}
                            {(item.status === 'waiting' || item.status === 'pending') && (
                              <span className="bg-zinc-200 text-zinc-800 text-[9px] font-black uppercase px-1.5 py-0.2 border border-black">
                                {isUploading ? 'WAITING FOR SLOT' : 'QUEUED'}
                              </span>
                            )}
                            {item.status === 'uploading' && (
                              <span className="bg-blue-200 text-blue-900 text-[9px] font-black uppercase px-1.5 py-0.2 border border-black flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping"></span>
                                {item.progress && item.progress > 0 ? `UPLOADING • ${item.progress}%` : 'PREPARING UPLOAD...'}
                              </span>
                            )}
                            {item.status === 'completed' && (
                              <span className="bg-emerald-200 text-emerald-900 text-[9px] font-black uppercase px-1.5 py-0.2 border border-black flex items-center gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5" /> 100% COMPLETE
                              </span>
                            )}
                            {(item.status === 'failed' || item.status === 'error') && (
                              <span className="bg-red-200 text-red-900 text-[9px] font-black uppercase px-1.5 py-0.2 border border-black">
                                FAILED
                              </span>
                            )}
                          </div>
                          {item.error && (item.status === 'failed' || item.status === 'error') && (
                            <p className="text-[10px] font-bold text-red-700 font-mono mt-1 break-words bg-red-100 p-1 border border-red-300">
                              ⚠️ {item.error}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {(item.status === 'failed' || item.status === 'error') && !isUploading && (
                          <button
                            type="button"
                            onClick={() => handleRetrySingleFile(item.id)}
                            className="p-1 bg-amber-100 hover:bg-amber-200 border-2 border-black text-amber-900 shadow-[1px_1px_0px_#000] text-[10px] font-black uppercase flex items-center gap-0.5"
                            title="Retry file"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span className="hidden sm:inline">RETRY</span>
                          </button>
                        )}

                        {!isUploading ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(item.id)}
                            className="p-1.5 bg-red-100 hover:bg-red-200 border-2 border-black text-red-700 hover:text-red-900 transition-colors shadow-[1px_1px_0px_#000] flex items-center gap-1 text-[10px] font-black uppercase"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">REMOVE</span>
                          </button>
                        ) : (
                          <span className="text-xs font-mono font-bold text-zinc-500">
                            #{index + 1}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Individual File Progress Bar during upload or completion */}
                    {isUploading && (item.status === 'uploading' || item.status === 'completed') && (
                      <div className="w-full mt-0.5">
                        <div className="w-full h-2 bg-zinc-200 border border-black p-[1px] overflow-hidden">
                          <div
                            className={`h-full transition-all duration-150 ${
                              item.status === 'completed' ? 'bg-emerald-600' : 'bg-blue-600'
                            }`}
                            style={{ width: `${item.status === 'completed' ? 100 : Math.max(1, item.progress || 0)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Retry All Failed Button (if any failed) */}
              {failedFiles.length > 0 && !isUploading && (
                <div className="mt-3 p-3 bg-red-50 border-2 border-red-800 flex items-center justify-between gap-2 shadow-[2px_2px_0px_#991b1b]">
                  <div className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>{failedFiles.length} file(s) failed to transfer</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetryAllFailed}
                    className="mc-btn-primary py-1 px-3 text-xs font-black uppercase flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>RETRY FAILED</span>
                  </button>
                </div>
              )}

              {/* Add more files button */}
              {!isUploading && !settings.maintenanceMode && !settings.pauseNewUploads && (
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="mt-3 w-full py-2 px-3 border-2 border-black border-dashed bg-zinc-100 hover:bg-zinc-200 text-xs font-bold uppercase tracking-wider text-zinc-800 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add More Files</span>
                </button>
              )}

              {/* Overall Progress Bar & Transfer Speed (when uploading) */}
              {isUploading && (
                <div className="mt-5 p-4 bg-blue-50 border-3 border-black shadow-[3px_3px_0px_#000] animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-950 uppercase mb-2">
                    <span className="font-pixel text-[10px]">
                      UPLOADING • {completedCount} OF {files.length} COMPLETED
                    </span>
                    <span className="font-mono text-xs">{overallProgress}%</span>
                  </div>

                  {/* Live Queue Status Detail Bar */}
                  <div className="mb-2.5 p-2 bg-white border border-black flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono font-bold text-zinc-800 shadow-[1px_1px_0px_#000]">
                    <span className="flex items-center gap-1.5 text-blue-700">
                      <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping shrink-0"></span>
                      <span>ACTIVE: {queueCounts.active}</span>
                    </span>
                    <span className="text-amber-800">
                      WAITING IN QUEUE: {queueCounts.pending}
                    </span>
                    <span className="text-emerald-700">
                      DONE: {queueCounts.completed}/{files.length}
                    </span>
                  </div>

                  {/* Pixel progress bar */}
                  <div className="w-full h-4 bg-zinc-200 border-2 border-black p-0.5 shadow-inner">
                    <div
                      className="h-full bg-[#16a34a] border-r-2 border-black transition-all duration-150"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>

                  {/* Real-time transfer throughput & ETA metrics grid */}
                  {speedMetrics ? (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono font-bold text-zinc-900">
                      <div className="bg-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col items-center text-center">
                        <span className="text-[9px] font-sans text-blue-800 font-black uppercase tracking-wider flex items-center gap-1">
                          <Zap className="w-3 h-3 text-blue-600 shrink-0" />
                          Transfer Speed
                        </span>
                        <span className="text-xs text-blue-950 font-black mt-0.5">{speedMetrics.speed}</span>
                      </div>

                      <div className="bg-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col items-center text-center">
                        <span className="text-[9px] font-sans text-emerald-800 font-black uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                          ETA
                        </span>
                        <span className="text-xs text-emerald-950 font-black mt-0.5">{speedMetrics.eta}</span>
                      </div>

                      <div className="bg-white p-2 border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col items-center text-center col-span-2 sm:col-span-1">
                        <span className="text-[9px] font-sans text-purple-800 font-black uppercase tracking-wider flex items-center gap-1">
                          <HardDrive className="w-3 h-3 text-purple-600 shrink-0" />
                          Remaining
                        </span>
                        <span className="text-xs text-purple-950 font-black mt-0.5">{speedMetrics.remaining}</span>
                      </div>
                    </div>
                  ) : transferSpeedText ? (
                    <div className="mt-2 text-[11px] font-mono font-bold text-blue-900 text-center flex items-center justify-center gap-1.5">
                      <Zap className="w-3 h-3 text-blue-700 shrink-0" />
                      <span>{transferSpeedText}</span>
                    </div>
                  ) : null}

                  <p className="text-[10px] text-zinc-500 font-semibold mt-2 text-center uppercase tracking-wider">
                    ⚡ DIRECT RESUMABLE CLOUD PIPELINE ACTIVE • DO NOT CLOSE TAB
                  </p>
                </div>
              )}

              {/* Main UPLOAD Button */}
              <button
                id="main-upload-btn"
                type="button"
                disabled={isUploading || files.length === 0 || settings.maintenanceMode || settings.pauseNewUploads}
                onClick={handleStartUpload}
                className={`mt-5 w-full mc-btn-success py-3.5 px-6 text-sm sm:text-base font-black tracking-wider uppercase flex items-center justify-center gap-2 border-3 border-black shadow-[4px_4px_0px_#000] ${
                  settings.maintenanceMode || settings.pauseNewUploads || isUploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent"></span>
                    <span>UPLOADING IN PROGRESS ({overallProgress}%)...</span>
                  </span>
                ) : (
                  <span>UPLOAD ({files.length} {files.length === 1 ? 'FILE' : 'FILES'})</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer info & Admin link */}
        <footer className="mt-6 text-center text-xs text-zinc-500 space-y-2">
          <p className="font-medium">
            Permanent QR Upload Station • Oyangoren Printing Services
          </p>
          <div>
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="text-[11px] text-zinc-500 hover:text-zinc-900 font-bold uppercase tracking-wider inline-flex items-center gap-1 hover:underline transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
              <span>Staff & Super Admin Login</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
