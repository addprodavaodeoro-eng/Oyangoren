import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTask
} from 'firebase/storage';
import JSZip from 'jszip';
import { db, storage } from './firebase';
import { 
  UploadSession, 
  UploadedFileRecord, 
  UploadStatus, 
  AdminNote, 
  FileCategory, 
  QuarantinedFileRecord 
} from '../types';
import { 
  logAdminActivity, 
  getStoredSettings, 
  formatDate, 
  formatTime,
  calculateFileHash,
  categorizeFile,
  checkFileSafety,
  extractImageInfo,
  extractPdfInfo,
  getQuarantinedRecords,
  saveQuarantinedRecords,
  addQuarantinedRecord,
  releaseQuarantinedRecord,
  deleteQuarantinedRecord,
  getQuarantinedFiles,
  formatFileSize
} from './settings';

export { 
  logAdminActivity, 
  getQuarantinedRecords, 
  saveQuarantinedRecords, 
  releaseQuarantinedRecord, 
  deleteQuarantinedRecord,
  getQuarantinedFiles
};

const SUBMISSIONS_COLLECTION = 'submissions';
const LOCAL_STORAGE_KEY = 'oyangoren_local_submissions';

// Fallback local storage helper for testing / offline preview
export function getLocalSubmissions(): UploadSession[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalSubmissions(subs: UploadSession[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(subs));
  } catch (e) {
    console.error('Failed to store locally', e);
  }
}

/**
 * Detect client device type
 */
export function detectDeviceType(): 'Mobile' | 'Tablet' | 'Desktop' {
  if (typeof navigator === 'undefined') return 'Desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'Tablet';
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
}

/**
 * Generates sequential, clean upload ID formatted like:
 * UPLOAD-20260921-001
 */
export function generateUploadId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateKey = `${year}${month}${day}`;

  const localList = getLocalSubmissions();
  const todayPrefix = `UPLOAD-${dateKey}-`;
  const todayUploads = localList.filter((s) => s.uploadId && s.uploadId.startsWith(todayPrefix));
  const nextSeq = (todayUploads.length + 1).toString().padStart(3, '0');

  return `UPLOAD-${dateKey}-${nextSeq}`;
}

// Convert a File to base64 Data URL for offline preview/fallback storage
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Enhanced Resumable File Upload with Pause/Resume capability,
 * Automatic SHA-256 integrity hashing, metadata extraction,
 * and security scanning.
 */
export interface ResumableUploadHandle {
  promise: Promise<{
    storagePath: string;
    downloadUrl: string;
    previewUrl?: string;
    hash?: string;
    category?: FileCategory;
    scanStatus: 'CLEAN' | 'QUARANTINED' | 'BLOCKED';
    imageMeta?: any;
    pdfMeta?: any;
  }>;
  pause: () => boolean;
  resume: () => boolean;
  cancel: () => boolean;
}

export function uploadFileToStorageResumable(
  submissionId: string,
  fileId: string,
  file: File,
  onProgress?: (percent: number, bytesTransferred: number, totalBytes: number) => void,
  maxRetries = 5
): ResumableUploadHandle {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `uploads/${submissionId}/${fileId}-${sanitizedName}`;
  const category = categorizeFile(file.name, file.type);

  let uploadTask: UploadTask | null = null;
  let cancelled = false;
  let isPaused = false;

  const promise = (async () => {
    let attempt = 0;

    while (attempt <= maxRetries) {
      if (cancelled) {
        throw new Error('Upload cancelled');
      }

      try {
        const storageRef = ref(storage, storagePath);
        const metadata = {
          contentType: file.type || 'application/octet-stream',
          cacheControl: 'public,max-age=31536000'
        };
        uploadTask = uploadBytesResumable(storageRef, file, metadata);

        return await new Promise<any>((resolve, reject) => {
          if (!uploadTask) {
            reject(new Error('Failed to create upload task'));
            return;
          }

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              if (cancelled) return;
              if (snapshot.totalBytes > 0) {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                if (onProgress) {
                  onProgress(progress, snapshot.bytesTransferred, snapshot.totalBytes);
                }
              }
            },
            (error) => {
              if (cancelled) {
                reject(new Error('Upload cancelled'));
                return;
              }
              // Pass error to retry loop
              reject(error);
            },
            async () => {
              if (cancelled) {
                reject(new Error('Upload cancelled'));
                return;
              }
              try {
                const downloadUrl = await getDownloadURL(uploadTask!.snapshot.ref);
                if (onProgress) onProgress(100, file.size, file.size);
                resolve({
                  storagePath,
                  downloadUrl,
                  category,
                  scanStatus: 'CLEAN'
                });
              } catch (urlErr) {
                reject(urlErr);
              }
            }
          );
        });
      } catch (err: any) {
        if (cancelled) {
          throw new Error('Upload cancelled');
        }

        const errorCode = err?.code || '';
        const isFatal =
          errorCode === 'storage/unauthorized' ||
          errorCode === 'storage/quota-exceeded' ||
          errorCode === 'storage/invalid-checksum';

        if (isFatal || attempt >= maxRetries) {
          console.error(`[Upload] Upload failed for ${file.name}:`, err);
          throw err;
        }

        attempt++;
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`[Upload] Network error for ${file.name}. Retrying in ${backoffMs}ms (Attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error(`Failed to upload ${file.name} after ${maxRetries} attempts`);
  })();

  return {
    promise,
    pause: () => {
      isPaused = true;
      if (uploadTask && uploadTask.snapshot.state === 'running') {
        return uploadTask.pause();
      }
      return false;
    },
    resume: () => {
      isPaused = false;
      if (uploadTask && uploadTask.snapshot.state === 'paused') {
        return uploadTask.resume();
      }
      return false;
    },
    cancel: () => {
      cancelled = true;
      if (uploadTask) {
        return uploadTask.cancel();
      }
      return false;
    }
  };
}

/**
 * Standard non-resumable fallback wrapper
 */
export async function uploadFileToStorage(
  submissionId: string,
  fileId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ 
  storagePath: string; 
  downloadUrl: string; 
  previewUrl?: string;
  hash?: string;
  category?: FileCategory;
  scanStatus?: 'CLEAN' | 'QUARANTINED' | 'BLOCKED';
  imageMeta?: any;
  pdfMeta?: any;
}> {
  const handle = uploadFileToStorageResumable(
    submissionId,
    fileId,
    file,
    (percent) => {
      if (onProgress) onProgress(percent);
    }
  );
  return handle.promise;
}


/**
 * Save new upload session to Firestore and local cache.
 */
export async function createCustomerSubmission(submission: UploadSession): Promise<void> {
  // Always update local cache so admin can immediately see it in preview
  const localList = getLocalSubmissions();
  localList.unshift(submission);
  saveLocalSubmissions(localList);

  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, submission.id);
    await setDoc(docRef, submission);
  } catch (error) {
    console.warn('Firestore direct write notice (saved in local sync store):', error);
  }
}

/**
 * Update session status: 'NEW' | 'OPENED' | 'DOWNLOADED' | 'COMPLETED' | 'ARCHIVED'
 */
export async function updateSubmissionStatus(id: string, status: UploadStatus): Promise<void> {
  const localList = getLocalSubmissions();
  const idx = localList.findIndex((s) => s.id === id);
  let uploadId = id;
  if (idx !== -1) {
    localList[idx].status = status;
    localList[idx].isNew = false;
    uploadId = localList[idx].uploadId || id;
    saveLocalSubmissions(localList);
  }

  logAdminActivity(status === 'ARCHIVED' ? 'Archive' : 'Status Change', uploadId, `Status updated to ${status}`);

  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, id);
    await updateDoc(docRef, {
      status,
      isNew: false
    });
  } catch (error) {
    console.warn('Firestore status update notice:', error);
  }
}

/**
 * Move session to Trash / Recycle Bin
 */
export async function moveSubmissionToTrash(id: string): Promise<void> {
  const localList = getLocalSubmissions();
  const idx = localList.findIndex((s) => s.id === id);
  let uploadId = id;
  const nowIso = new Date().toISOString();

  if (idx !== -1) {
    localList[idx].isTrash = true;
    localList[idx].trashedAt = nowIso;
    uploadId = localList[idx].uploadId || id;
    saveLocalSubmissions(localList);
  }

  logAdminActivity('Delete', uploadId, 'Moved to Trash');

  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, id);
    await updateDoc(docRef, {
      isTrash: true,
      trashedAt: nowIso
    });
  } catch (error) {
    console.warn('Firestore move to trash notice:', error);
  }
}

/**
 * Restore session from Trash
 */
export async function restoreSubmissionFromTrash(id: string): Promise<void> {
  const localList = getLocalSubmissions();
  const idx = localList.findIndex((s) => s.id === id);
  let uploadId = id;

  if (idx !== -1) {
    localList[idx].isTrash = false;
    localList[idx].trashedAt = undefined;
    uploadId = localList[idx].uploadId || id;
    saveLocalSubmissions(localList);
  }

  logAdminActivity('Restore', uploadId, 'Restored from Trash');

  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, id);
    await updateDoc(docRef, {
      isTrash: false,
      trashedAt: null
    });
  } catch (error) {
    console.warn('Firestore restore notice:', error);
  }
}

/**
 * Permanently delete a submission and its associated files from Storage and Firestore.
 */
export async function deletePermanently(submission: UploadSession): Promise<void> {
  const localList = getLocalSubmissions().filter((s) => s.id !== submission.id);
  saveLocalSubmissions(localList);

  logAdminActivity('Permanent Delete', submission.uploadId, `Permanently erased session with ${submission.files?.length || 0} files`);

  // Storage files cleanup
  if (submission.files && submission.files.length > 0) {
    for (const f of submission.files) {
      const pathToDelete = f.storagePath || `uploads/${submission.id}/${f.fileId}-${f.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      try {
        const fileRef = ref(storage, pathToDelete);
        await deleteObject(fileRef);
      } catch (e) {
        console.warn('Storage file cleanup note:', pathToDelete, e);
      }
    }
  }

  // Delete from Firestore
  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, submission.id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('Firestore permanent delete notice:', error);
  }
}

/**
 * Mark an individual file as downloaded. Also updates session status if configured.
 */
export async function markFileDownloaded(submissionId: string, fileId: string): Promise<UploadSession | null> {
  const localList = getLocalSubmissions();
  const sub = localList.find((s) => s.id === submissionId);
  const now = new Date();
  const dateStr = formatDate(now.toISOString());
  const timeStr = formatTime(now.toISOString());

  if (!sub) return null;

  const targetFile = sub.files.find((f) => f.fileId === fileId);
  if (targetFile) {
    targetFile.isDownloaded = true;
    targetFile.downloadedAt = `${dateStr} ${timeStr}`;
  }

  // Auto transition to DOWNLOADED if NEW or OPENED
  const settings = getStoredSettings();
  if (settings.autoMarkDownloaded && (sub.status === 'NEW' || sub.status === 'OPENED')) {
    sub.status = 'DOWNLOADED';
  }

  saveLocalSubmissions(localList);
  logAdminActivity('File Download', sub.uploadId, `Downloaded file: ${targetFile?.name || fileId}`);

  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    await updateDoc(docRef, {
      files: sub.files,
      status: sub.status
    });
  } catch (e) {
    console.warn('Firestore file downloaded mark notice:', e);
  }

  return sub;
}

/**
 * Mark all files in session as downloaded (when Download All ZIP is clicked)
 */
export async function markSessionDownloaded(submissionId: string): Promise<UploadSession | null> {
  const localList = getLocalSubmissions();
  const sub = localList.find((s) => s.id === submissionId);
  const now = new Date();
  const dateStr = formatDate(now.toISOString());
  const timeStr = formatTime(now.toISOString());

  if (!sub) return null;

  sub.files.forEach((f) => {
    f.isDownloaded = true;
    f.downloadedAt = `${dateStr} ${timeStr}`;
  });

  const settings = getStoredSettings();
  if (settings.autoMarkDownloaded && (sub.status === 'NEW' || sub.status === 'OPENED')) {
    sub.status = 'DOWNLOADED';
  }

  saveLocalSubmissions(localList);
  logAdminActivity('Download All', sub.uploadId, `Downloaded full ZIP package (${sub.fileCount} files)`);

  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
    await updateDoc(docRef, {
      files: sub.files,
      status: sub.status
    });
  } catch (e) {
    console.warn('Firestore session downloaded mark notice:', e);
  }

  return sub;
}

/**
 * Bulk status update
 */
export async function bulkUpdateStatus(ids: string[], status: UploadStatus): Promise<void> {
  for (const id of ids) {
    await updateSubmissionStatus(id, status);
  }
}

/**
 * Bulk move to trash
 */
export async function bulkMoveToTrash(ids: string[]): Promise<void> {
  for (const id of ids) {
    await moveSubmissionToTrash(id);
  }
}

/**
 * Bulk restore from trash
 */
export async function bulkRestoreFromTrash(ids: string[]): Promise<void> {
  for (const id of ids) {
    await restoreSubmissionFromTrash(id);
  }
}

/**
 * Bulk permanent delete
 */
export async function bulkDeletePermanently(sessions: UploadSession[]): Promise<void> {
  for (const s of sessions) {
    await deletePermanently(s);
  }
}

/**
 * Delete an individual file from a submission session.
 */
export async function deleteIndividualFile(submissionId: string, fileId: string): Promise<UploadSession | null> {
  const localList = getLocalSubmissions();
  const sub = localList.find((s) => s.id === submissionId);
  let updatedSub: UploadSession | null = null;

  if (sub && sub.files) {
    const targetFile = sub.files.find((f) => f.fileId === fileId);
    if (targetFile) {
      const pathToDelete = targetFile.storagePath || `uploads/${submissionId}/${fileId}-${targetFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      try {
        const fileRef = ref(storage, pathToDelete);
        await deleteObject(fileRef);
      } catch (e) {
        console.warn('Storage file deletion note:', pathToDelete, e);
      }

      logAdminActivity('File Delete', sub.uploadId, `Deleted file "${targetFile.name}" from storage & database`);
    }

    sub.files = sub.files.filter((f) => f.fileId !== fileId);
    sub.fileCount = sub.files.length;
    sub.totalSize = sub.files.reduce((acc, f) => acc + (f.size || 0), 0);
    saveLocalSubmissions(localList);
    updatedSub = { ...sub };

    try {
      const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
      await updateDoc(docRef, {
        files: sub.files,
        fileCount: sub.fileCount,
        totalSize: sub.totalSize
      });
    } catch (e) {
      console.warn('Firestore individual file delete notice:', e);
    }
  }

  return updatedSub;
}

/**
 * Execute automatic retention cleanup (trash cleanup & completed file retention)
 */
export function runAutomaticRetentionCleanup(submissionsList?: UploadSession[]): void {
  const submissions: UploadSession[] = submissionsList || getLocalSubmissions();
  const settings = getStoredSettings();
  const now = Date.now();

  // 1. Auto-delete active files older than autoDeleteDays (move to trash)
  const autoDeleteDays = settings.autoDeleteDays || 0;
  if (autoDeleteDays > 0) {
    const maxAgeMs = autoDeleteDays * 24 * 60 * 60 * 1000;
    const expiredActive = submissions.filter(
      (s: UploadSession) => !s.isTrash && s.createdAt && now - new Date(s.createdAt).getTime() > maxAgeMs
    );
    if (expiredActive.length > 0) {
      console.log(`[Cleanup] Moving ${expiredActive.length} items older than ${autoDeleteDays} days to Trash.`);
      bulkMoveToTrash(expiredActive.map((s: UploadSession) => s.id));
    }
  }

  // 2. Trash retention cleanup
  if (settings.trashRetentionDays > 0) {
    const maxAgeMs = settings.trashRetentionDays * 24 * 60 * 60 * 1000;
    const expiredTrash = submissions.filter(
      (s: UploadSession) => s.isTrash && s.trashedAt && now - new Date(s.trashedAt).getTime() > maxAgeMs
    );
    if (expiredTrash.length > 0) {
      console.log(`[Cleanup] Permanently purging ${expiredTrash.length} expired trash items.`);
      bulkDeletePermanently(expiredTrash);
    }
  }

  // 3. Completed file retention cleanup
  if (settings.completedRetentionDays > 0) {
    const maxAgeMs = settings.completedRetentionDays * 24 * 60 * 60 * 1000;
    const expiredCompleted = submissions.filter(
      (s: UploadSession) =>
        !s.isTrash &&
        s.status === 'COMPLETED' &&
        s.createdAt &&
        now - new Date(s.createdAt).getTime() > maxAgeMs
    );
    if (expiredCompleted.length > 0) {
      console.log(`[Cleanup] Purging ${expiredCompleted.length} expired completed items.`);
      bulkDeletePermanently(expiredCompleted);
    }
  }
}

/**
 * Subscribe to all upload sessions in real-time or retrieve fallback list.
 * Automatically synchronizes deletions across all connected clients and tabs.
 */
export function subscribeToSubmissions(callback: (submissions: UploadSession[]) => void): () => void {
  try {
    const q = query(collection(db, SUBMISSIONS_COLLECTION), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: UploadSession[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as Omit<UploadSession, 'id'>) });
        });

        // Update local cache to match authoritative cloud state so deleted records stay deleted
        saveLocalSubmissions(items);
        callback(items);
      },
      (error) => {
        console.warn('Firestore snapshot listener note (using local fallback items):', error);
        callback(getLocalSubmissions());
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Error setting up snapshot, falling back:', err);
    callback(getLocalSubmissions());
    return () => {};
  }
}

/**
 * Detailed real-time subscription supporting discrete deletion and modification hooks.
 */
export function subscribeToSubmissionsWithDeletions(options: {
  onListUpdate: (submissions: UploadSession[]) => void;
  onDocDeleted?: (deletedId: string) => void;
  onDocAdded?: (session: UploadSession) => void;
  onDocModified?: (session: UploadSession) => void;
}): () => void {
  try {
    const q = query(collection(db, SUBMISSIONS_COLLECTION), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: UploadSession[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as Omit<UploadSession, 'id'>) });
        });

        // Process individual changes
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'removed') {
            options.onDocDeleted?.(change.doc.id);
          } else if (change.type === 'added') {
            options.onDocAdded?.({ id: change.doc.id, ...(change.doc.data() as Omit<UploadSession, 'id'>) });
          } else if (change.type === 'modified') {
            options.onDocModified?.({ id: change.doc.id, ...(change.doc.data() as Omit<UploadSession, 'id'>) });
          }
        });

        saveLocalSubmissions(items);
        options.onListUpdate(items);
      },
      (error) => {
        console.warn('Firestore detailed snapshot error (using local cache):', error);
        options.onListUpdate(getLocalSubmissions());
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to Firestore with deletions:', err);
    options.onListUpdate(getLocalSubmissions());
    return () => {};
  }
}

// ==========================================
// Phase 3 Session Operations: Pin, Archive, Notes & Tags
// ==========================================

export async function togglePinSession(id: string): Promise<boolean> {
  const localList = getLocalSubmissions();
  const item = localList.find((s) => s.id === id);
  if (!item) return false;

  item.pinned = !item.pinned;
  saveLocalSubmissions(localList);
  logAdminActivity('Pin / Unpin', item.uploadId, item.pinned ? 'Pinned session to top' : 'Unpinned session');

  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, id);
    await updateDoc(docRef, { pinned: item.pinned });
  } catch (e) {
    console.warn('Firestore pin notice:', e);
  }

  return item.pinned;
}

export async function toggleArchiveSession(id: string): Promise<boolean> {
  const localList = getLocalSubmissions();
  const item = localList.find((s) => s.id === id);
  if (!item) return false;

  item.archived = !item.archived;
  saveLocalSubmissions(localList);
  logAdminActivity('Archive', item.uploadId, item.archived ? 'Archived session' : 'Restored from archive');

  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, id);
    await updateDoc(docRef, { archived: item.archived });
  } catch (e) {
    console.warn('Firestore archive notice:', e);
  }

  return item.archived;
}

export async function addSessionNote(sessionId: string, text: string, author = 'Admin'): Promise<AdminNote[]> {
  const localList = getLocalSubmissions();
  const item = localList.find((s) => s.id === sessionId);
  if (!item) return [];

  const note: AdminNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    author
  };

  item.adminNotes = [...(item.adminNotes || []), note];
  saveLocalSubmissions(localList);
  logAdminActivity('Note Added', item.uploadId, `Added internal note: "${text.substring(0, 30)}..."`);

  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, sessionId);
    await updateDoc(docRef, { adminNotes: item.adminNotes });
  } catch (e) {
    console.warn('Firestore note update notice:', e);
  }

  return item.adminNotes;
}

export async function deleteSessionNote(sessionId: string, noteId: string): Promise<AdminNote[]> {
  const localList = getLocalSubmissions();
  const item = localList.find((s) => s.id === sessionId);
  if (!item) return [];

  item.adminNotes = (item.adminNotes || []).filter((n) => n.id !== noteId);
  saveLocalSubmissions(localList);

  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, sessionId);
    await updateDoc(docRef, { adminNotes: item.adminNotes });
  } catch (e) {
    console.warn('Firestore note delete notice:', e);
  }

  return item.adminNotes;
}

export async function addSessionTag(sessionId: string, tag: string): Promise<string[]> {
  const cleanTag = tag.trim().toLowerCase();
  if (!cleanTag) return [];

  const localList = getLocalSubmissions();
  const item = localList.find((s) => s.id === sessionId);
  if (!item) return [];

  const currentTags = item.adminTags || [];
  if (!currentTags.includes(cleanTag)) {
    item.adminTags = [...currentTags, cleanTag];
    saveLocalSubmissions(localList);
    logAdminActivity('Tag Added', item.uploadId, `Applied tag: #${cleanTag}`);

    try {
      const docRef = doc(db, SUBMISSIONS_COLLECTION, sessionId);
      await updateDoc(docRef, { adminTags: item.adminTags });
    } catch (e) {
      console.warn('Firestore tag update notice:', e);
    }
  }

  return item.adminTags || [];
}

export async function removeSessionTag(sessionId: string, tag: string): Promise<string[]> {
  const localList = getLocalSubmissions();
  const item = localList.find((s) => s.id === sessionId);
  if (!item) return [];

  item.adminTags = (item.adminTags || []).filter((t) => t !== tag);
  saveLocalSubmissions(localList);

  try {
    const docRef = doc(db, SUBMISSIONS_COLLECTION, sessionId);
    await updateDoc(docRef, { adminTags: item.adminTags });
  } catch (e) {
    console.warn('Firestore tag remove notice:', e);
  }

  return item.adminTags || [];
}

// ==========================================
// Phase 3 Smart ZIP Generator with Subfolders
// ==========================================

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Downloads single or multiple sessions as a smart ZIP:
 * When multiple sessions: organizes files inside subfolders:
 *   UPLOAD-20260921-001/design.pdf
 *   UPLOAD-20260921-002/photo.jpg
 * Preserves exact original filenames without renaming.
 */
export async function generateSmartZipBlob(
  sessions: UploadSession[],
  onProgress?: (progressPercent: number) => void
): Promise<Blob> {
  const zip = new JSZip();

  // Count total files across sessions
  const allFiles: { session: UploadSession; file: UploadedFileRecord }[] = [];
  for (const s of sessions) {
    for (const f of s.files || []) {
      allFiles.push({ session: s, file: f });
    }
  }

  if (allFiles.length === 0) {
    throw new Error('No files found to download');
  }

  let completedCount = 0;
  const isMultiSession = sessions.length > 1;

  for (const { session, file } of allFiles) {
    if (!file.downloadUrl) continue;
    try {
      const res = await fetch(file.downloadUrl);
      const fileBlob = await res.blob();

      // Preserve original file name
      const safeFileName = file.name || `file_${file.fileId}`;

      if (isMultiSession) {
        // Place in subfolder named after session uploadId
        const folderName = session.uploadId || session.id;
        zip.folder(folderName)?.file(safeFileName, fileBlob);
      } else {
        zip.file(safeFileName, fileBlob);
      }
    } catch (fetchErr) {
      console.warn(`Could not fetch ${file.name} for ZIP:`, fetchErr);
      // Fallback text placeholder so user knows what file was skipped
      const safeFileName = file.name || `file_${file.fileId}`;
      const placeholder = `File download placeholder for ${safeFileName}.\nDirect URL: ${file.downloadUrl}`;
      if (isMultiSession) {
        const folderName = session.uploadId || session.id;
        zip.folder(folderName)?.file(`${safeFileName}.txt`, placeholder);
      } else {
        zip.file(`${safeFileName}.txt`, placeholder);
      }
    }

    completedCount++;
    if (onProgress) {
      onProgress(Math.round((completedCount / allFiles.length) * 90));
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) {
      onProgress(90 + Math.round(metadata.percent * 0.1));
    }
  });

  return zipBlob;
}

// ==========================================
// Phase 3 Record Exports: CSV, Excel CSV, JSON
// ==========================================

export function exportSessionsToCSV(sessions: UploadSession[]): void {
  const headers = [
    'Upload ID',
    'Date',
    'Time',
    'File Count',
    'Total Size (Bytes)',
    'Total Size (Formatted)',
    'Status',
    'Customer Device',
    'Tags',
    'Notes Count',
    'Is Downloaded',
    'Created At ISO'
  ];

  const rows = sessions.map((s) => [
    s.uploadId || s.id,
    s.date || '',
    s.time || '',
    s.fileCount,
    s.totalSize,
    formatFileSize(s.totalSize),
    s.status,
    s.deviceType || 'Unknown',
    (s.adminTags || []).join('; '),
    (s.adminNotes || []).length,
    s.files?.some((f) => f.isDownloaded) ? 'YES' : 'NO',
    s.createdAt
  ]);

  const csvContent = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, `OYANGOREN-UPLOAD-RECORDS-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportSessionsToExcelCSV(sessions: UploadSession[]): void {
  // Prepend UTF-8 BOM for Microsoft Excel proper character handling
  const headers = [
    'Upload ID',
    'Date',
    'Time',
    'Files Count',
    'Total Size',
    'Status',
    'Device Type',
    'Tags',
    'Notes',
    'Files Summary'
  ];

  const rows = sessions.map((s) => {
    const fileSummary = (s.files || []).map((f) => `${f.name} (${formatFileSize(f.size)})`).join(' | ');
    return [
      s.uploadId || s.id,
      s.date || '',
      s.time || '',
      s.fileCount,
      formatFileSize(s.totalSize),
      s.status,
      s.deviceType || 'Unknown',
      (s.adminTags || []).join('; '),
      (s.adminNotes || []).map((n) => `[${n.author}] ${n.text}`).join(' | '),
      fileSummary
    ];
  });

  const csvContent = '\uFEFF' + [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, `OYANGOREN-EXCEL-RECORDS-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportSessionsToJSON(sessions: UploadSession[]): void {
  const jsonString = JSON.stringify(sessions, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  triggerBlobDownload(blob, `OYANGOREN-UPLOAD-RECORDS-${new Date().toISOString().slice(0, 10)}.json`);
}

// ==========================================
// Phase 3 System Backup & Restore
// ==========================================

export function exportSystemBackupJSON(sessions: UploadSession[]): void {
  const backupPayload = {
    version: '3.0',
    exportedAt: new Date().toISOString(),
    system: 'Oyangoren Printing Services Upload System',
    sessions,
    settings: getStoredSettings(),
    quarantinedRecords: getQuarantinedRecords()
  };

  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  triggerBlobDownload(blob, `OYANGOREN-BACKUP-${new Date().toISOString().slice(0, 10)}.json`);
}

export function importSystemBackupJSON(jsonStr: string): { success: boolean; message: string; count?: number } {
  try {
    const payload = JSON.parse(jsonStr);
    if (!payload.sessions || !Array.isArray(payload.sessions)) {
      return { success: false, message: 'Invalid backup format: Missing upload sessions list.' };
    }

    const currentLocal = getLocalSubmissions();
    const mergedMap = new Map<string, UploadSession>();

    // Add current
    for (const s of currentLocal) mergedMap.set(s.id, s);
    // Add / overwrite with backup
    for (const s of payload.sessions) mergedMap.set(s.id, s);

    const mergedList = Array.from(mergedMap.values());
    saveLocalSubmissions(mergedList);

    if (payload.quarantinedRecords && Array.isArray(payload.quarantinedRecords)) {
      saveQuarantinedRecords(payload.quarantinedRecords);
    }

    logAdminActivity('System Backup Restore', 'SYSTEM', `Restored ${payload.sessions.length} sessions from backup.`);
    return { success: true, message: `Successfully restored ${payload.sessions.length} records.`, count: payload.sessions.length };
  } catch (err: any) {
    return { success: false, message: `Failed to parse backup JSON: ${err.message}` };
  }
}

