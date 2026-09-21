import React from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  Presentation, 
  Archive, 
  FileCode, 
  File as FileGeneric
} from 'lucide-react';
import { UploadStatus } from '../types';

export const StatusBadge: React.FC<{ status: UploadStatus | string; size?: 'sm' | 'md' }> = ({
  status,
  size = 'md'
}) => {
  const normStatus = (status || 'NEW').toUpperCase();

  const configs: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
    NEW: {
      label: 'NEW',
      bg: 'bg-[#FFD43B]',
      text: 'text-black',
      border: 'border-black',
      dot: 'bg-red-600 animate-ping'
    },
    OPENED: {
      label: 'OPENED',
      bg: 'bg-orange-100',
      text: 'text-orange-950',
      border: 'border-black',
      dot: 'bg-orange-600'
    },
    DOWNLOADED: {
      label: 'DOWNLOADED',
      bg: 'bg-[#2563EB]',
      text: 'text-white',
      border: 'border-black',
      dot: 'bg-white'
    },
    COMPLETED: {
      label: 'COMPLETED',
      bg: 'bg-[#16a34a]',
      text: 'text-white',
      border: 'border-black',
      dot: 'bg-white'
    },
    ARCHIVED: {
      label: 'ARCHIVED',
      bg: 'bg-zinc-200',
      text: 'text-zinc-800',
      border: 'border-zinc-700',
      dot: 'bg-zinc-500'
    },
    // Fallbacks for previous data
    PENDING: {
      label: 'NEW',
      bg: 'bg-[#FFD43B]',
      text: 'text-black',
      border: 'border-black',
      dot: 'bg-red-600 animate-ping'
    },
    PROCESSING: {
      label: 'DOWNLOADED',
      bg: 'bg-[#2563EB]',
      text: 'text-white',
      border: 'border-black',
      dot: 'bg-white'
    }
  };

  const c = configs[normStatus] || configs.NEW;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-black tracking-wider uppercase border-2 shadow-[2px_2px_0px_#000] font-pixel ${c.bg} ${c.text} ${c.border} ${padding}`}
    >
      <span className="relative flex h-2 w-2 mr-1.5">
        {c.label === 'NEW' && (
          <span className="animate-ping absolute inline-flex h-full w-full bg-red-500 opacity-75"></span>
        )}
        <span className={`relative inline-flex h-2 w-2 ${c.label === 'NEW' ? 'bg-red-600' : 'bg-current opacity-80'}`}></span>
      </span>
      <span>{c.label}</span>
    </span>
  );
};

export const FileIconComponent: React.FC<{ type: string; className?: string }> = ({
  type,
  className = 'w-5 h-5'
}) => {
  const t = (type || '').toLowerCase();

  if (t.includes('pdf')) {
    return <FileText className={`${className} text-red-600`} />;
  }
  if (t.includes('image') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'heic', 'tiff', 'bmp'].includes(t)) {
    return <ImageIcon className={`${className} text-blue-600`} />;
  }
  if (t.includes('sheet') || t.includes('excel') || ['xls', 'xlsx', 'csv'].includes(t)) {
    return <FileSpreadsheet className={`${className} text-emerald-600`} />;
  }
  if (t.includes('presentation') || t.includes('powerpoint') || ['ppt', 'pptx'].includes(t)) {
    return <Presentation className={`${className} text-orange-600`} />;
  }
  if (t.includes('zip') || t.includes('compressed') || t.includes('tar') || t.includes('rar') || ['zip', 'rar'].includes(t)) {
    return <Archive className={`${className} text-amber-600`} />;
  }
  if (t.includes('word') || ['doc', 'docx', 'txt'].includes(t)) {
    return <FileText className={`${className} text-indigo-600`} />;
  }
  if (['psd', 'ai', 'eps'].includes(t)) {
    return <FileCode className={`${className} text-purple-600`} />;
  }

  return <FileGeneric className={`${className} text-zinc-600`} />;
};
