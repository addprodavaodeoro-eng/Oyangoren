import React, { useMemo } from 'react';
import { 
  FolderUp, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Files, 
  HardDrive 
} from 'lucide-react';
import { UploadSession } from '../types';
import { formatFileSize } from '../lib/settings';

interface DashboardStatsProps {
  submissions: UploadSession[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ submissions }) => {
  const stats = useMemo(() => {
    // Only count active (non-trash)
    const active = submissions.filter((s) => !s.isTrash);
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    let uploadsToday = 0;
    let newUploads = 0;
    let filesToday = 0;
    let totalFiles = 0;
    let totalBytes = 0;
    let completedCount = 0;

    for (const sub of active) {
      const isToday = sub.date === todayStr || (() => {
        try {
          return new Date(sub.createdAt).toDateString() === now.toDateString();
        } catch {
          return false;
        }
      })();

      const status = (sub.status || 'NEW').toUpperCase();

      if (isToday) {
        uploadsToday++;
        filesToday += sub.fileCount || (sub.files ? sub.files.length : 0);
      }

      if (status === 'NEW') {
        newUploads++;
      } else if (status === 'COMPLETED') {
        completedCount++;
      }

      totalFiles += sub.fileCount || (sub.files ? sub.files.length : 0);
      totalBytes += sub.totalSize || 0;
    }

    return {
      uploadsToday,
      newUploads,
      filesToday,
      totalFiles,
      storageUsed: formatFileSize(totalBytes),
      completed: completedCount
    };
  }, [submissions]);

  const cards = [
    {
      id: 'stat-uploads-today',
      label: 'UPLOADS TODAY',
      value: stats.uploadsToday,
      icon: Calendar,
      bg: 'bg-blue-50',
      border: 'border-blue-900',
      accent: 'text-blue-700',
      badge: "Today's sessions"
    },
    {
      id: 'stat-new-uploads',
      label: 'NEW UPLOADS',
      value: stats.newUploads,
      icon: Clock,
      bg: 'bg-[#FFD43B]/25',
      border: 'border-black',
      accent: 'text-amber-900',
      badge: stats.newUploads > 0 ? 'Requires attention' : 'All caught up'
    },
    {
      id: 'stat-files-today',
      label: 'FILES TODAY',
      value: stats.filesToday,
      icon: FolderUp,
      bg: 'bg-emerald-50',
      border: 'border-emerald-900',
      accent: 'text-emerald-700',
      badge: 'Files received today'
    },
    {
      id: 'stat-total-files',
      label: 'TOTAL FILES',
      value: stats.totalFiles,
      icon: Files,
      bg: 'bg-purple-50',
      border: 'border-purple-900',
      accent: 'text-purple-700',
      badge: 'All-time active files'
    },
    {
      id: 'stat-storage-used',
      label: 'STORAGE USED',
      value: stats.storageUsed,
      icon: HardDrive,
      bg: 'bg-zinc-50',
      border: 'border-black',
      accent: 'text-zinc-800',
      badge: 'Active storage volume'
    },
    {
      id: 'stat-completed',
      label: 'COMPLETED',
      value: stats.completed,
      icon: CheckCircle2,
      bg: 'bg-emerald-50',
      border: 'border-emerald-900',
      accent: 'text-emerald-700',
      badge: 'Jobs printed & finished'
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.id}
            className={`mc-card p-3 sm:p-4 ${c.bg} border-2 ${c.border} shadow-[3px_3px_0px_#000] flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="font-pixel text-[9px] uppercase tracking-wider text-zinc-700 font-bold truncate">
                {c.label}
              </span>
              <Icon className={`w-3.5 h-3.5 ${c.accent} shrink-0`} />
            </div>

            <div className="flex items-baseline justify-between">
              <span className="font-mono text-lg sm:text-xl font-black text-zinc-950">
                {c.value}
              </span>
            </div>

            <span className="text-[10px] text-zinc-500 font-semibold mt-1 truncate">
              {c.badge}
            </span>
          </div>
        );
      })}
    </div>
  );
};
