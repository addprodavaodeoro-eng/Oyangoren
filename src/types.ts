export type UploadStatus = 'NEW' | 'OPENED' | 'DOWNLOADED' | 'COMPLETED' | 'ARCHIVED';

export type FileCategory =
  | 'PDF'
  | 'IMAGE'
  | 'MICROSOFT WORD'
  | 'MICROSOFT EXCEL'
  | 'MICROSOFT POWERPOINT'
  | 'ADOBE DESIGN'
  | 'ARCHIVE'
  | 'SPREADSHEET'
  | 'VIDEO'
  | 'TEXT'
  | 'OTHER';

export type FileScanStatus = 'CHECKING' | 'SAFE' | 'CLEAN' | 'BLOCKED' | 'QUARANTINED';

export interface ImageMetadata {
  width: number;
  height: number;
  resolution: string; // e.g. 4032 × 3024
  format: string; // e.g. JPEG, PNG
}

export interface PdfMetadata {
  pages: number;
  pageSize: string; // e.g. A4, Letter
  orientation: 'Portrait' | 'Landscape';
}

export interface UploadedFileRecord {
  fileId: string;
  name: string;
  type: string; // e.g. PDF, PNG, DOCX, ZIP
  size: number; // in bytes
  category?: FileCategory;
  scanStatus?: FileScanStatus;
  quarantineReason?: string;
  sanitizedStorageName?: string;
  fileHash?: string;
  hash?: string;
  imageInfo?: ImageMetadata;
  imageDimensions?: { width: number; height: number };
  imageResolution?: string;
  pdfInfo?: PdfMetadata;
  pageCount?: number;
  isQuarantined?: boolean;
  storagePath?: string;
  downloadUrl?: string;
  previewUrl?: string;
  uploadedAt?: string;
  uploadDate?: string;
  uploadTime?: string;
  isDownloaded?: boolean;
  downloadedAt?: string;
}

export interface AdminNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export type AdminTag =
  | 'URGENT'
  | 'LARGE FORMAT'
  | 'PHOTO'
  | 'DOCUMENT'
  | 'FOR REVIEW'
  | 'REPRINT'
  | 'CUSTOM'
  | string;

export interface UploadSession {
  id: string; // Firestore document ID
  uploadId: string; // System-generated ID: e.g. UPLOAD-20260921-001
  createdAt: string; // ISO 8601
  date: string; // e.g. September 21, 2026
  time: string; // e.g. 10:42 AM
  fileCount: number; // Number of files in session
  totalSize: number; // Total bytes across all files
  status: UploadStatus;
  isNew?: boolean; // Highlight flag for fresh real-time incoming sessions
  isTrash?: boolean; // In trash/recycle bin
  trashedAt?: string;
  isPinned?: boolean; // Starred / Pinned session
  pinned?: boolean;
  isArchived?: boolean; // Dedicated archived partition
  archived?: boolean;
  tags?: AdminTag[]; // Private internal admin tags
  adminTags?: string[];
  notes?: AdminNote[]; // Private internal admin notes
  adminNotes?: AdminNote[];
  hasQuarantine?: boolean;
  deviceType?: 'Mobile' | 'Tablet' | 'Desktop';
  readByAdmin?: boolean;
  files: UploadedFileRecord[];
}

export interface UploadFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  extension: string;
  category?: FileCategory;
  progress: number;
  status: 'waiting' | 'uploading' | 'completed' | 'failed' | 'paused' | 'pending' | 'error';
  error?: string;
  downloadUrl?: string;
  previewUrl?: string;
  storagePath?: string;
  fileHash?: string;
  scanStatus?: FileScanStatus;
  quarantineReason?: string;
  imageInfo?: ImageMetadata;
  pdfInfo?: PdfMetadata;
}

export interface AdminSettings {
  businessName: string;
  tagline: string;
  uploadPageMessage: string;
  uploadButtonText: string;
  maxFileSizeMB: number; // 100, 250, 500, 1024 (1GB default), 2048 (2GB), custom
  maxFilesPerSubmission: number;
  maxStorageLimitGB?: number;
  autoMarkDownloaded: boolean;
  enableZipDownload: boolean;
  soundAlerts: boolean; // Optional new upload sound toggle
  soundNotification?: boolean;
  autoDeleteDays?: number;
  refreshIntervalSeconds?: number;
  trashRetentionDays: number; // 0 for Never, 7, 15, 30, 60
  completedRetentionDays: number; // 0 for Never, 30, 60, 90
  theme: 'light' | 'dark' | 'system';
  // Phase 3 extensions
  maintenanceMode: boolean;
  pauseNewUploads: boolean;
  productionUrl?: string;
  customDomain?: string;
  customUploadMessage: string;
  storageWarningPercent: number; // e.g. 80
  largeFileAlertMB: number; // e.g. 500
  autoBackupSchedule: 'OFF' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  lastBackupDate?: string;
  nextBackupDate?: string;
  sessionTimeoutMinutes: number; // 15, 30, 60 (default), 240, 0 (Never)
  enableTwoFactor: boolean;
  enableDailyEmailSummary: boolean;
  dailyEmailRecipient?: string;
  quickDownloadMode: boolean;
  dashboardCardsVisible: Record<string, boolean>;
  systemVersion: string;
}

export type AdminRole = 
  | 'super_admin' 
  | 'admin' 
  | 'viewer' 
  | 'PRINTING_STAFF' 
  | 'STORE_MANAGER' 
  | 'SUPER_ADMIN' 
  | string;

export interface AdminUser {
  id: string;
  username: string;
  role: AdminRole;
  disabled: boolean;
  status?: 'ACTIVE' | 'DISABLED' | 'LOCKED' | string;
  createdAt: string;
  lastLogin?: string;
  twoFactorEnabled?: boolean;
}

export interface QuarantinedFileRecord {
  id: string;
  uploadId: string;
  sessionId?: string;
  submissionId?: string;
  fileId: string;
  name: string;
  fileName?: string;
  type: string;
  size: number;
  reason: string;
  date: string;
  detectedAt?: string;
  status: 'QUARANTINED' | 'SAFE' | 'DELETED' | string;
  storagePath?: string;
  downloadUrl?: string;
}

export interface LoginHistoryRecord {
  id: string;
  date: string;
  time: string;
  username: string;
  browser: string;
  deviceType: string;
  status: 'SUCCESS' | 'FAILED' | 'LOCKED';
  ip?: string;
}

export interface ActiveAdminSession {
  id?: string;
  token?: string;
  sessionId?: string;
  username: string;
  role: AdminRole;
  deviceType: string;
  browser: string;
  ipAddress?: string;
  userAgent?: string;
  lastActive?: string | number;
  createdAt: number;
  expiresAt: number;
  isCurrent?: boolean;
}

export type AppSettings = AdminSettings;

export type ActivityAction =
  | 'Login'
  | 'Logout'
  | 'Failed Login'
  | 'File Preview'
  | 'File Download'
  | 'Download All'
  | 'Bulk Download'
  | 'Status Change'
  | 'Archive'
  | 'Restore'
  | 'Delete'
  | 'Permanent Delete'
  | 'Settings Change'
  | 'Tag Added'
  | 'Tag Removed'
  | 'Note Added'
  | 'Backup Created'
  | 'Backup Restored'
  | 'Admin Added'
  | 'Admin Removed'
  | 'Role Changed'
  | 'Quarantine Action'
  | string;

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  uploadId?: string;
  details?: string;
  timestamp: string;
  date: string;
  time: string;
  admin: string;
}

export interface NotificationItem {
  id: string;
  uploadId: string;
  sessionId: string;
  fileCount: number;
  totalSize: number;
  time: string;
  timestamp: string;
  isRead: boolean;
}

