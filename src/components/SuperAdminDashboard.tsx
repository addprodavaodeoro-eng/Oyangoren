import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  FolderUp, 
  QrCode, 
  Settings, 
  LogOut, 
  ExternalLink, 
  Menu, 
  X, 
  BookOpen, 
  HardDrive, 
  Trash2, 
  Bell, 
  Check, 
  CheckCheck,
  ChevronRight,
  Layers,
  Clock,
  Calendar,
  AlertCircle,
  Files,
  DownloadCloud,
  ShieldCheck,
  Activity,
  DatabaseBackup,
  ShieldAlert
} from 'lucide-react';
import { UploadSession } from '../types';
import { useAuth } from '../lib/AuthContext';
import { DashboardStats } from './DashboardStats';
import { SubmissionsTable } from './SubmissionsTable';
import { CustomerQrSection } from './CustomerQrSection';
import { AdminSettingsSection } from './AdminSettingsSection';
import { StorageDashboard } from './StorageDashboard';
import { TrashSection } from './TrashSection';
import { SubmissionDetailModal } from './SubmissionDetailModal';
import { SetupGuideModal } from './SetupGuideModal';
import { FileManagerSection } from './FileManagerSection';
import { BulkDownloadCenter } from './BulkDownloadCenter';
import { SecurityAdminCenter } from './SecurityAdminCenter';
import { SystemHealthSection } from './SystemHealthSection';
import { BackupRestoreSection } from './BackupRestoreSection';
import { QuarantineSection } from './QuarantineSection';
import { 
  getStoredSettings, 
  playNotificationSound, 
  formatFileSize 
} from '../lib/settings';
import { 
  runAutomaticRetentionCleanup, 
  updateSubmissionStatus,
  getQuarantinedFiles,
  subscribeToSubmissionsWithDeletions
} from '../lib/submissionService';

interface SuperAdminDashboardProps {
  submissions: UploadSession[];
  onOpenCustomerView: () => void;
  onLogout?: () => void;
  onSubmissionUpdated: (updated: UploadSession) => void;
  onSubmissionDeleted: (id: string) => void;
}

export type AdminTab = 
  | 'dashboard' 
  | 'uploads' 
  | 'files'
  | 'bulk'
  | 'storage' 
  | 'security'
  | 'health'
  | 'backup'
  | 'quarantine'
  | 'qr' 
  | 'trash' 
  | 'settings';

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  submissions: initialSubmissions,
  onOpenCustomerView,
  onLogout,
  onSubmissionUpdated,
  onSubmissionDeleted
}) => {
  const { adminUser, logout } = useAuth();
  const [localSubmissions, setLocalSubmissions] = useState<UploadSession[]>(initialSubmissions);

  // Sync with prop updates
  useEffect(() => {
    setLocalSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  // Real-time Firestore deletion & updates listener
  useEffect(() => {
    const unsubscribe = subscribeToSubmissionsWithDeletions({
      onListUpdate: (updatedList) => {
        setLocalSubmissions(updatedList);
      },
      onDocDeleted: (deletedId) => {
        setLocalSubmissions((prev) => prev.filter((s) => s.id !== deletedId));
        onSubmissionDeleted(deletedId);
        setSelectedSubmission((prev) => (prev?.id === deletedId ? null : prev));
      },
      onDocModified: (modifiedDoc) => {
        setLocalSubmissions((prev) =>
          prev.map((s) => (s.id === modifiedDoc.id ? modifiedDoc : s))
        );
        onSubmissionUpdated(modifiedDoc);
        setSelectedSubmission((prev) => (prev?.id === modifiedDoc.id ? modifiedDoc : prev));
      }
    });

    return () => unsubscribe();
  }, [onSubmissionDeleted, onSubmissionUpdated]);

  const handleLocalSubmissionDeleted = (id: string) => {
    setLocalSubmissions((prev) => prev.filter((s) => s.id !== id));
    onSubmissionDeleted(id);
    if (selectedSubmission?.id === id) {
      setSelectedSubmission(null);
    }
  };

  const handleLocalSubmissionUpdated = (updated: UploadSession) => {
    setLocalSubmissions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
    onSubmissionUpdated(updated);
    if (selectedSubmission?.id === updated.id) {
      setSelectedSubmission(updated);
    }
  };

  // Derive initial tab from URL path
  const getInitialTab = (): AdminTab => {
    if (typeof window === 'undefined') return 'dashboard';
    const path = window.location.pathname.replace('/admin', '').replace(/^\//, '');
    if (path === 'uploads') return 'uploads';
    if (path === 'files') return 'files';
    if (path === 'bulk') return 'bulk';
    if (path === 'storage') return 'storage';
    if (path === 'security' || path === 'users') return 'security';
    if (path === 'health') return 'health';
    if (path === 'backup') return 'backup';
    if (path === 'quarantine') return 'quarantine';
    if (path === 'qr') return 'qr';
    if (path === 'trash') return 'trash';
    if (path === 'settings') return 'settings';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(getInitialTab);
  const [selectedSubmission, setSelectedSubmission] = useState<UploadSession | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Sync tab with browser URL history
  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      const newPath = tab === 'dashboard' ? '/admin/dashboard' : `/admin/${tab}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    }
  };

  // Sync when browser back/forward buttons are pressed
  useEffect(() => {
    const handlePop = () => {
      setActiveTab(getInitialTab());
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Quarantine count
  const [quarantineCount, setQuarantineCount] = useState<number>(() => getQuarantinedFiles().length);

  // Notifications state
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [latestToast, setLatestToast] = useState<UploadSession | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set(localSubmissions.map((s) => s.id)));
  const isInitialMount = useRef(true);

  // Auto-retention cleanup on mount
  useEffect(() => {
    try {
      runAutomaticRetentionCleanup(localSubmissions);
    } catch (err) {
      console.warn('Retention cleanup notice:', err);
    }
  }, [localSubmissions]);

  // Listen for newly arrived submissions in real time
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      localSubmissions.forEach((s) => knownIdsRef.current.add(s.id));
      return;
    }

    const newSubmissions = localSubmissions.filter((s) => !knownIdsRef.current.has(s.id) && !s.isTrash);
    if (newSubmissions.length > 0) {
      const newest = newSubmissions[0];
      // Update known IDs
      newSubmissions.forEach((s) => knownIdsRef.current.add(s.id));

      // Check sound settings & play chime
      const settings = getStoredSettings();
      if (settings.soundNotification !== false) {
        playNotificationSound();
      }

      // Display floating realtime banner toast
      setLatestToast(newest);
      const timer = setTimeout(() => {
        setLatestToast((prev) => (prev?.id === newest.id ? null : prev));
      }, 9000);
      return () => clearTimeout(timer);
    }
  }, [localSubmissions]);

  // Derived counts
  const activeSubmissions = localSubmissions.filter((s) => !s.isTrash);
  const trashedSubmissions = localSubmissions.filter((s) => s.isTrash);
  const newSubmissions = activeSubmissions.filter((s) => (s.status || 'NEW').toUpperCase() === 'NEW');
  const newCount = newSubmissions.length;

  const handleLogout = async () => {
    try {
      await logout();
      if (onLogout) {
        onLogout();
      } else {
        onOpenCustomerView();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleMarkAsRead = async (session: UploadSession) => {
    await updateSubmissionStatus(session.id, 'OPENED');
    handleLocalSubmissionUpdated({ ...session, status: 'OPENED', isNew: false });
  };

  const handleMarkAllAsRead = async () => {
    for (const session of newSubmissions) {
      await updateSubmissionStatus(session.id, 'OPENED');
      handleLocalSubmissionUpdated({ ...session, status: 'OPENED', isNew: false });
    }
  };

  const handleOpenSubmissionFromNotification = (session: UploadSession) => {
    setNotificationsOpen(false);
    setLatestToast(null);
    setSelectedSubmission(session);
  };

  const navItems = [
    {
      id: 'tab-dashboard',
      tab: 'dashboard' as AdminTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'tab-uploads',
      tab: 'uploads' as AdminTab,
      label: 'Upload Sessions',
      icon: FolderUp,
      badge: newCount > 0 ? `${newCount} NEW` : null
    },
    {
      id: 'tab-files',
      tab: 'files' as AdminTab,
      label: 'File Manager',
      icon: Files,
      badge: null
    },
    {
      id: 'tab-bulk',
      tab: 'bulk' as AdminTab,
      label: 'Bulk Downloads',
      icon: DownloadCloud,
      badge: null
    },
    {
      id: 'tab-storage',
      tab: 'storage' as AdminTab,
      label: 'Storage Analytics',
      icon: HardDrive,
      badge: null
    },
    {
      id: 'tab-security',
      tab: 'security' as AdminTab,
      label: 'Security & Admins',
      icon: ShieldCheck,
      badge: null
    },
    {
      id: 'tab-health',
      tab: 'health' as AdminTab,
      label: 'System Health',
      icon: Activity,
      badge: null
    },
    {
      id: 'tab-backup',
      tab: 'backup' as AdminTab,
      label: 'Backup & Restore',
      icon: DatabaseBackup,
      badge: null
    },
    {
      id: 'tab-quarantine',
      tab: 'quarantine' as AdminTab,
      label: 'Quarantine',
      icon: ShieldAlert,
      badge: quarantineCount > 0 ? `${quarantineCount}` : null
    },
    {
      id: 'tab-qr',
      tab: 'qr' as AdminTab,
      label: 'Permanent QR Code',
      icon: QrCode,
      badge: null
    },
    {
      id: 'tab-trash',
      tab: 'trash' as AdminTab,
      label: 'Trash & Retention',
      icon: Trash2,
      badge: trashedSubmissions.length > 0 ? `${trashedSubmissions.length}` : null
    },
    {
      id: 'tab-settings',
      tab: 'settings' as AdminTab,
      label: 'Portal Settings',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col md:flex-row text-zinc-900 font-sans">
      {/* Real-time Floating Notification Banner */}
      {latestToast && (
        <div className="fixed top-4 right-4 z-60 max-w-sm w-full mc-card p-4 bg-[#FFD43B] text-black border-3 border-black shadow-[6px_6px_0px_#000] animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping inline-block"></span>
              <span className="font-pixel text-xs font-black uppercase text-black">
                NEW FILE UPLOAD!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLatestToast(null)}
              className="text-black hover:bg-black/10 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2 text-xs font-mono space-y-0.5">
            <div><strong>Upload ID:</strong> {latestToast.uploadId}</div>
            <div><strong>Files:</strong> {latestToast.fileCount} items</div>
            <div><strong>Total Size:</strong> {formatFileSize(latestToast.totalSize)}</div>
            <div><strong>Time:</strong> {latestToast.time}</div>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => handleOpenSubmissionFromNotification(latestToast)}
              className="mc-btn-primary py-1.5 px-3 text-xs font-black uppercase shadow-[2px_2px_0px_#000]"
            >
              OPEN UPLOAD
            </button>
          </div>
        </div>
      )}

      {/* Mobile Top App Bar */}
      <div className="md:hidden bg-[#0f172a] text-white p-3.5 border-b-3 border-black flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#2563EB] border border-black shadow-[1px_1px_0px_#000] flex items-center justify-center font-bold text-xs text-[#FFD43B]">
            OP
          </div>
          <div>
            <div className="font-extrabold text-xs uppercase tracking-wider text-white">
              OYANGOREN ADMIN
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">
              {newCount} New Sessions
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification bell on mobile */}
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-1.5 bg-zinc-800 border border-zinc-700 text-white relative"
          >
            <Bell className="w-4 h-4" />
            {newCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {newCount}
              </span>
            )}
          </button>

          <button
            id="mobile-menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 bg-zinc-800 border border-zinc-700 text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Left Sidebar on Desktop / Drawer on Mobile */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-full md:h-screen w-64 bg-[#0f172a] text-white border-r-3 border-black flex flex-col justify-between transition-transform duration-200 ease-in-out shrink-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="overflow-y-auto">
          {/* Brand block in sidebar */}
          <div className="p-4 border-b-2 border-zinc-800">
            <div className="bg-[#2563EB] text-white p-2.5 border-2 border-black shadow-[3px_3px_0px_#000] mb-2">
              <span className="font-pixel text-[10px] text-[#FFD43B] font-bold block">
                ★ SUPER ADMIN ★
              </span>
              <div className="font-black text-sm uppercase tracking-tight">
                OYANGOREN
              </div>
              <div className="text-[11px] text-blue-200 font-semibold uppercase">
                Printing Services
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-mono text-zinc-300">
                Admin: <strong className="text-white">{adminUser?.username || 'admin'}</strong>
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.id}
                  id={item.id}
                  onClick={() => {
                    handleSelectTab(item.tab);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 font-bold text-xs uppercase tracking-wider transition-all border-2 ${
                    isActive
                      ? 'bg-[#2563EB] text-white border-black shadow-[3px_3px_0px_#000]'
                      : 'border-transparent text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== null && (
                    <span className="bg-[#FFD43B] text-black font-extrabold text-[10px] px-1.5 py-0.2 border border-black shadow-[1px_1px_0px_#000] shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-3 border-t-2 border-zinc-800 space-y-2 shrink-0 bg-[#0f172a]">
          {/* Setup Guide Link */}
          <button
            id="open-setup-guide-btn"
            type="button"
            onClick={() => {
              setShowSetupGuide(true);
              setMobileMenuOpen(false);
            }}
            className="w-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 py-1.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#FFD43B]" />
            <span>Setup & Deployment Guide</span>
          </button>

          {/* View Customer Page */}
          <button
            id="sidebar-view-customer-page-btn"
            type="button"
            onClick={onOpenCustomerView}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 py-1.5 px-3 text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Customer Upload Page</span>
          </button>

          {/* Logout */}
          <button
            id="sidebar-logout-btn"
            type="button"
            onClick={handleLogout}
            className="w-full mc-btn-danger py-1.5 px-3 text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/* Top Header */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-zinc-300">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black uppercase text-zinc-950 tracking-tight">
                {activeTab === 'dashboard' && 'Super Admin Console'}
                {activeTab === 'uploads' && 'Upload Sessions'}
                {activeTab === 'files' && 'Global File Manager & Search'}
                {activeTab === 'bulk' && 'Bulk Download & Data Export Center'}
                {activeTab === 'storage' && 'Storage & Quota Analytics'}
                {activeTab === 'security' && 'Admin Accounts & Access Security'}
                {activeTab === 'health' && 'System Health & Diagnostics'}
                {activeTab === 'backup' && 'System Backup & Disaster Recovery'}
                {activeTab === 'quarantine' && 'File Quarantine & Threat Isolation'}
                {activeTab === 'qr' && 'Permanent Customer Upload QR'}
                {activeTab === 'trash' && 'Trash & Auto Retention'}
                {activeTab === 'settings' && 'Portal Settings & Rules'}
              </h1>

              {newCount > 0 && activeTab === 'dashboard' && (
                <span className="bg-[#FFD43B] text-black border border-black font-extrabold text-[11px] px-2 py-0.5 shadow-[1px_1px_0px_#000] uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
                  {newCount} New Sessions
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-600 font-medium mt-1">
              Secure counter management system for receiving, previewing, and printing customer files.
            </p>
          </div>

          <div className="flex items-center gap-2.5 relative">
            {/* Desktop Notification Bell with Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="mc-btn-secondary p-2 flex items-center gap-1.5 text-xs font-bold uppercase relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4 text-zinc-800" />
                <span>Alerts</span>
                {newCount > 0 && (
                  <span className="bg-red-600 text-white font-mono font-bold text-[10px] px-1.5 py-0.2 border border-black">
                    {newCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Menu */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border-3 border-black shadow-[6px_6px_0px_#000] z-50 p-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-black mb-2">
                    <span className="font-pixel text-xs font-black uppercase text-zinc-950 flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-blue-600" />
                      Incoming Uploads ({newCount})
                    </span>
                    {newCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] font-bold text-blue-700 hover:underline uppercase flex items-center gap-1"
                      >
                        <CheckCheck className="w-3 h-3" />
                        Mark All Read
                      </button>
                    )}
                  </div>

                  {newSubmissions.length === 0 ? (
                    <div className="text-center py-6 text-zinc-500 text-xs">
                      <Check className="w-6 h-6 mx-auto text-emerald-600 mb-1" />
                      <p className="font-bold">All caught up!</p>
                      <p className="text-[11px]">No new unread uploads.</p>
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-2">
                      {newSubmissions.map((sub) => (
                        <div
                          key={sub.id}
                          className="p-2.5 bg-zinc-50 border border-black text-xs space-y-1 hover:bg-blue-50/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-zinc-900">{sub.uploadId}</span>
                            <span className="text-[10px] text-zinc-500">{sub.time}</span>
                          </div>

                          <div className="text-[11px] text-zinc-600">
                            {sub.fileCount} files • {formatFileSize(sub.totalSize)}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleMarkAsRead(sub)}
                              className="text-[10px] text-zinc-600 hover:text-black font-bold uppercase"
                            >
                              Mark Read
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenSubmissionFromNotification(sub)}
                              className="mc-btn-primary py-0.5 px-2 text-[10px] font-black uppercase"
                            >
                              Open Upload
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSetupGuide(true)}
              className="mc-btn-yellow text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 uppercase"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Deployment</span> Guide
            </button>
          </div>
        </header>

        {/* Tab 1: Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <DashboardStats submissions={localSubmissions} />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-900 flex items-center gap-2">
                  <span>Recent Upload Sessions</span>
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                </h2>
                <button
                  onClick={() => handleSelectTab('uploads')}
                  className="text-xs font-bold text-blue-600 hover:underline uppercase"
                >
                  View All Sessions ({activeSubmissions.length}) →
                </button>
              </div>

              <SubmissionsTable
                submissions={localSubmissions}
                onSelectSubmission={(sub) => setSelectedSubmission(sub)}
                onSubmissionUpdated={handleLocalSubmissionUpdated}
                onSubmissionDeleted={handleLocalSubmissionDeleted}
                onRefreshData={() => {}}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Uploads Management */}
        {activeTab === 'uploads' && (
          <div className="space-y-4">
            <SubmissionsTable
              submissions={localSubmissions}
              onSelectSubmission={(sub) => setSelectedSubmission(sub)}
              onSubmissionUpdated={handleLocalSubmissionUpdated}
              onSubmissionDeleted={handleLocalSubmissionDeleted}
              onRefreshData={() => {}}
            />
          </div>
        )}

        {/* Tab 3: Global File Manager */}
        {activeTab === 'files' && (
          <FileManagerSection
            submissions={localSubmissions}
            onSubmissionUpdated={handleLocalSubmissionUpdated}
            onOpenDetailModal={(sub: UploadSession) => setSelectedSubmission(sub)}
          />
        )}

        {/* Tab 4: Bulk Download & Data Export */}
        {activeTab === 'bulk' && (
          <BulkDownloadCenter 
            submissions={localSubmissions} 
            onSubmissionUpdated={handleLocalSubmissionUpdated}
          />
        )}

        {/* Tab 5: Storage Analytics */}
        {activeTab === 'storage' && (
          <StorageDashboard submissions={localSubmissions} />
        )}

        {/* Tab 6: Security & Admins */}
        {activeTab === 'security' && (
          <SecurityAdminCenter />
        )}

        {/* Tab 7: System Health & Diagnostics */}
        {activeTab === 'health' && (
          <SystemHealthSection submissions={localSubmissions} />
        )}

        {/* Tab 8: System Backup & Disaster Recovery */}
        {activeTab === 'backup' && (
          <BackupRestoreSection
            submissions={localSubmissions}
            onReloadRequested={() => {
              window.location.reload();
            }}
          />
        )}

        {/* Tab 9: File Quarantine */}
        {activeTab === 'quarantine' && (
          <QuarantineSection
            onFileRestored={() => {
              setQuarantineCount(getQuarantinedFiles().length);
            }}
          />
        )}

        {/* Tab 10: QR Code Section */}
        {activeTab === 'qr' && <CustomerQrSection />}

        {/* Tab 11: Trash & Retention */}
        {activeTab === 'trash' && (
          <TrashSection
            submissions={localSubmissions}
            onSubmissionRestored={(id) => {
              const target = localSubmissions.find((s) => s.id === id);
              if (target) {
                handleLocalSubmissionUpdated({ ...target, isTrash: false, status: 'OPENED' });
              }
            }}
            onSubmissionDeletedPermanently={(id) => handleLocalSubmissionDeleted(id)}
          />
        )}

        {/* Tab 12: Settings Section */}
        {activeTab === 'settings' && <AdminSettingsSection />}
      </main>

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onSubmissionUpdated={(updated) => {
            handleLocalSubmissionUpdated(updated);
          }}
          onSubmissionDeleted={(id) => {
            handleLocalSubmissionDeleted(id);
          }}
        />
      )}

      {/* Setup Guide Modal */}
      {showSetupGuide && (
        <SetupGuideModal onClose={() => setShowSetupGuide(false)} />
      )}
    </div>
  );
};
