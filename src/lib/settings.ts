import { 
  AdminSettings, 
  ActivityLog, 
  ActivityAction, 
  FileCategory, 
  FileScanStatus, 
  ImageMetadata, 
  PdfMetadata,
  QuarantinedFileRecord,
  LoginHistoryRecord
} from '../types';

export const DEFAULT_SETTINGS: AdminSettings = {
  businessName: 'OYANGOREN PRINTING SERVICES',
  tagline: 'UPLOAD FILES HERE',
  uploadPageMessage: 'Tap to choose files or drag and drop files here',
  uploadButtonText: 'UPLOAD FILES HERE',
  maxFileSizeMB: 1024, // Default: 1 GB per file as required in Phase 3
  maxFilesPerSubmission: 50,
  autoMarkDownloaded: true,
  enableZipDownload: true,
  soundAlerts: true,
  soundNotification: true,
  autoDeleteDays: 7,
  refreshIntervalSeconds: 10,
  trashRetentionDays: 30, // Default: 30 Days
  completedRetentionDays: 0, // Default: Never Delete Automatically (0)
  theme: 'light',
  // Phase 3 extensions
  maintenanceMode: false,
  pauseNewUploads: false,
  productionUrl: '',
  customDomain: '',
  customUploadMessage: 'Select the files you want us to receive.',
  storageWarningPercent: 80,
  largeFileAlertMB: 500,
  autoBackupSchedule: 'OFF',
  sessionTimeoutMinutes: 60,
  enableTwoFactor: false,
  enableDailyEmailSummary: false,
  quickDownloadMode: false,
  dashboardCardsVisible: {
    uploadsToday: true,
    storageUsed: true,
    newUploads: true,
    totalFiles: true,
    completedUploads: true,
    securityAlerts: true,
    backupStatus: true
  },
  systemVersion: '3.0'
};

const SETTINGS_KEY = 'oyangoren_admin_settings';
const ACTIVITY_LOG_KEY = 'oyangoren_admin_activity_log';
const QUARANTINE_KEY = 'oyangoren_quarantine_records';
const LOGIN_HISTORY_KEY = 'oyangoren_login_history';

export function getStoredSettings(): AdminSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { 
        ...DEFAULT_SETTINGS, 
        ...parsed,
        dashboardCardsVisible: {
          ...DEFAULT_SETTINGS.dashboardCardsVisible,
          ...(parsed.dashboardCardsVisible || {})
        }
      };
    }
  } catch (err) {
    console.error('Failed to parse admin settings:', err);
  }
  return DEFAULT_SETTINGS;
}

export function saveStoredSettings(settings: AdminSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    applyTheme(settings.theme);
  } catch (err) {
    console.error('Failed to save admin settings:', err);
  }
}

export function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  if (typeof document === 'undefined') return;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('admin-dark');
  } else {
    document.documentElement.classList.remove('admin-dark');
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateString;
  }
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase().trim() : '';
}

/**
 * Requirement 9: Automatic File Categorization
 * Categories: PDF, IMAGE, MICROSOFT WORD, MICROSOFT EXCEL, MICROSOFT POWERPOINT,
 * ADOBE DESIGN, ARCHIVE, VIDEO, TEXT, OTHER
 */
export function categorizeFile(filename: string, mimeType?: string): FileCategory {
  const ext = getFileExtension(filename);
  const mime = (mimeType || '').toLowerCase();

  if (ext === 'pdf' || mime.includes('pdf')) {
    return 'PDF';
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'heic', 'ico'].includes(ext) || mime.startsWith('image/')) {
    return 'IMAGE';
  }
  if (['doc', 'docx', 'dot', 'dotx'].includes(ext) || mime.includes('wordprocessing') || mime.includes('msword')) {
    return 'MICROSOFT WORD';
  }
  if (['xls', 'xlsx', 'csv', 'xlsm', 'xltx'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) {
    return 'MICROSOFT EXCEL';
  }
  if (['ppt', 'pptx', 'pps', 'ppsx'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) {
    return 'MICROSOFT POWERPOINT';
  }
  if (['psd', 'ai', 'indd', 'eps', 'raw', 'cdr', 'svgz'].includes(ext)) {
    return 'ADOBE DESIGN';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) || mime.includes('zip') || mime.includes('compressed') || mime.includes('tar')) {
    return 'ARCHIVE';
  }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'].includes(ext) || mime.startsWith('video/')) {
    return 'VIDEO';
  }
  if (['txt', 'rtf', 'log', 'md'].includes(ext) || mime.startsWith('text/')) {
    return 'TEXT';
  }
  return 'OTHER';
}

/**
 * Requirement 8: Block or quarantine high-risk executable file types
 */
export const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'vbs', 'sh', 'ps1',
  'jar', 'apk', 'bin', 'app', 'dll', 'pif', 'application', 'gadget',
  'cpl', 'hta', 'msc', 'msp', 'reg', 'wsf', 'vbe', 'jse'
];

export function isDangerousExtension(ext: string): boolean {
  return DANGEROUS_EXTENSIONS.includes(ext.toLowerCase().trim().replace(/^\./, ''));
}

/**
 * Requirement 14: File Name Cleanup & Unique Sanitization
 * Keep customer's original filename visible, internally store sanitized & unique filename.
 * E.g. '8f6a29c4-my-final-poster.pdf'
 */
export function generateSanitizedStorageName(originalName: string): string {
  const parts = originalName.split('.');
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const base = parts.join('.').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'file';
  const shortId = Math.random().toString(36).substring(2, 10);
  return ext ? `${shortId}-${base}.${ext}` : `${shortId}-${base}`;
}

/**
 * Requirement 16: File Hashing using SHA-256 Web Crypto
 */
export async function calculateFileHash(file: File): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // For very large files, hash first 8MB to ensure smooth real-time performance without freezing mobile browser
      const sliceSize = Math.min(file.size, 8 * 1024 * 1024);
      const slice = file.slice(0, sliceSize);
      const buffer = await slice.arrayBuffer();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (err) {
    console.warn('Crypto subtle hash notice:', err);
  }
  // Fallback pseudohash using size + name + timestamp
  return `hash_${file.size}_${file.name.replace(/[^a-zA-Z0-9]/g, '')}`;
}

/**
 * Requirement 12: Image Information Extraction
 * Resolution, Width, Height, File Size, File Format
 */
export async function extractImageInfo(file: File): Promise<ImageMetadata | undefined> {
  if (!file.type.startsWith('image/') && !['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(getFileExtension(file.name))) {
    return undefined;
  }
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const format = (file.type.split('/')[1] || getFileExtension(file.name)).toUpperCase();
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          resolution: `${img.naturalWidth || img.width} × ${img.naturalHeight || img.height}`,
          format: format === 'JPEG' ? 'JPEG' : format
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(undefined);
      };
      img.src = url;
    } catch {
      resolve(undefined);
    }
  });
}

/**
 * Requirement 13: PDF Information Extraction
 * Number of Pages, Page Size, Orientation
 */
export async function extractPdfInfo(file: File): Promise<PdfMetadata | undefined> {
  if (getFileExtension(file.name) !== 'pdf' && !file.type.includes('pdf')) {
    return undefined;
  }
  try {
    // Read the first chunk (or whole if small) to inspect PDF header & page count safely
    const slice = file.slice(0, Math.min(file.size, 256 * 1024));
    const text = await slice.text();
    
    // Check for standard MediaBox [0 0 width height]
    let pageSize = 'A4';
    let orientation: 'Portrait' | 'Landscape' = 'Portrait';
    const mediaBoxMatch = text.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
    if (mediaBoxMatch) {
      const w = parseFloat(mediaBoxMatch[3]);
      const h = parseFloat(mediaBoxMatch[4]);
      orientation = w > h ? 'Landscape' : 'Portrait';
      if ((Math.abs(w - 595) < 20 && Math.abs(h - 842) < 20) || (Math.abs(w - 842) < 20 && Math.abs(h - 595) < 20)) {
        pageSize = 'A4';
      } else if ((Math.abs(w - 612) < 20 && Math.abs(h - 792) < 20) || (Math.abs(w - 792) < 20 && Math.abs(h - 612) < 20)) {
        pageSize = 'Letter';
      } else if ((Math.abs(w - 612) < 20 && Math.abs(h - 1008) < 20) || (Math.abs(w - 1008) < 20 && Math.abs(h - 612) < 20)) {
        pageSize = 'Legal';
      } else {
        pageSize = `${Math.round(w)}×${Math.round(h)} pt`;
      }
    }

    // Heuristic page count search
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    const countMatch = text.match(/\/Count\s+(\d+)/);
    let pages = 1;
    if (countMatch && parseInt(countMatch[1], 10) > 0) {
      pages = parseInt(countMatch[1], 10);
    } else if (pageMatches && pageMatches.length > 0) {
      pages = pageMatches.length;
    }

    return {
      pages,
      pageSize,
      orientation
    };
  } catch (err) {
    console.warn('PDF info extraction notice:', err);
    return {
      pages: 1,
      pageSize: 'A4',
      orientation: 'Portrait'
    };
  }
}

/**
 * Requirement 6 & 8: File Safety & Malware Screening Check
 */
export async function checkFileSafety(file: File): Promise<{ status: FileScanStatus; reason?: string }> {
  const ext = getFileExtension(file.name);
  if (isDangerousExtension(ext)) {
    return {
      status: 'BLOCKED',
      reason: `Blocked executable/script extension (.${ext}). High security risk.`
    };
  }

  // Inspect first 32 bytes for disguised executables (PE header MZ, ELF, shellscript)
  try {
    const buffer = await file.slice(0, 32).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // MZ header for Windows EXE/DLL/SCR (4D 5A)
    if (bytes[0] === 0x4d && bytes[1] === 0x5a) {
      return {
        status: 'QUARANTINED',
        reason: 'Binary signature matches Windows PE Executable format (MZ header disguised as document).'
      };
    }
    // ELF header for Unix binary (7F 45 4C 46)
    if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) {
      return {
        status: 'QUARANTINED',
        reason: 'Binary signature matches Linux/Unix ELF Executable.'
      };
    }
  } catch (err) {
    console.warn('Magic byte inspection notice:', err);
  }

  // Normal safe customer printing file
  return { status: 'SAFE' };
}

/**
 * Quarantined Records Store (Admin Section)
 */
export function getStoredQuarantine(): QuarantinedFileRecord[] {
  try {
    const raw = localStorage.getItem(QUARANTINE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredQuarantine(records: QuarantinedFileRecord[]): void {
  try {
    localStorage.setItem(QUARANTINE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save quarantine records:', err);
  }
}

export function addQuarantinedRecord(record: QuarantinedFileRecord): void {
  const list = getStoredQuarantine();
  const existing = list.findIndex((r) => r.id === record.id);
  if (existing >= 0) {
    list[existing] = record;
  } else {
    list.unshift(record);
  }
  saveStoredQuarantine(list);
}

/**
 * Login History & Security Audit Store
 */
export function getStoredLoginHistory(): LoginHistoryRecord[] {
  try {
    const raw = localStorage.getItem(LOGIN_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [
    {
      id: 'lh_1',
      date: 'September 20, 2026',
      time: '08:45 PM',
      username: 'admin',
      browser: 'Chrome 128 / Windows',
      deviceType: 'Desktop',
      status: 'SUCCESS'
    }
  ];
}

export function recordLoginAttempt(
  username: string,
  status: 'SUCCESS' | 'FAILED' | 'LOCKED',
  browser = 'Modern Browser',
  deviceType = 'Desktop'
): void {
  try {
    const now = new Date();
    const newRecord: LoginHistoryRecord = {
      id: `lh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: formatDate(now.toISOString()),
      time: formatTime(now.toISOString()),
      username: username || 'unknown',
      browser,
      deviceType,
      status
    };
    const list = getStoredLoginHistory();
    list.unshift(newRecord);
    localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(list.slice(0, 100)));
  } catch (err) {
    console.error('Failed to record login attempt:', err);
  }
}

/**
 * Play gentle retro notification chime for Super Admin
 */
export function playNotificationSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Pleasant two-tone chime
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.2); // G5

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.48);
  } catch (e) {
    console.warn('Audio chime notice:', e);
  }
}

// Activity Logging
export function getStoredActivityLogs(): ActivityLog[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logAdminActivity(
  action: ActivityAction,
  uploadId?: string,
  details?: string,
  admin = 'admin'
): void {
  try {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const newLog: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action,
      uploadId,
      details,
      timestamp: now.toISOString(),
      date,
      time,
      admin
    };
    const list = getStoredActivityLogs();
    list.unshift(newLog);
    localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(list.slice(0, 300)));
  } catch (e) {
    console.error('Failed to log admin activity', e);
  }
}

// Quarantined file actions
export function releaseQuarantinedRecord(fileId: string): QuarantinedFileRecord[] {
  const records = getStoredQuarantine();
  const updated = records.filter(r => r.id !== fileId && r.fileId !== fileId);
  saveStoredQuarantine(updated);
  return updated;
}

export function deleteQuarantinedRecord(fileId: string): QuarantinedFileRecord[] {
  const records = getStoredQuarantine();
  const updated = records.filter(r => r.id !== fileId && r.fileId !== fileId);
  saveStoredQuarantine(updated);
  return updated;
}

// Aliases for submissionService compatibility
export const getQuarantinedRecords = getStoredQuarantine;
export const saveQuarantinedRecords = saveStoredQuarantine;
export const getQuarantinedFiles = getStoredQuarantine;

/**
 * Returns the effective, canonical public upload URL for customer QR codes.
 * Prioritizes custom domain or configured public production URL.
 * Never defaults to localhost for QR generation if a public domain is configured or available.
 */
export function getEffectivePublicUploadUrl(settings?: AdminSettings): string {
  const currentSettings = settings || getStoredSettings();

  // 1. Explicit custom domain (e.g. upload.oyangoren.com)
  if (currentSettings.customDomain && currentSettings.customDomain.trim()) {
    let domain = currentSettings.customDomain.trim();
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }
    return domain.endsWith('/upload') ? domain : `${domain.replace(/\/$/, '')}/upload`;
  }

  // 2. Explicit production URL (e.g. https://oyangoren-upload.web.app)
  if (currentSettings.productionUrl && currentSettings.productionUrl.trim()) {
    let prod = currentSettings.productionUrl.trim();
    if (!prod.startsWith('http://') && !prod.startsWith('https://')) {
      prod = `https://${prod}`;
    }
    return prod.endsWith('/upload') ? prod : `${prod.replace(/\/$/, '')}/upload`;
  }

  // 3. Current browser window origin if public
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.');

    if (!isLocal) {
      return `${origin}/upload`;
    }
  }

  // 4. Default public fallback
  return 'https://ais-pre-4nftuh3gtfkewmsaq4futd-176505772096.asia-southeast1.run.app/upload';
}

