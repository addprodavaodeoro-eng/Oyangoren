import React from 'react';
import { CheckCircle2, UploadCloud, Check } from 'lucide-react';
import { UploadSession } from '../types';

interface SuccessViewProps {
  submission: UploadSession;
  onUploadMore: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({
  submission,
  onUploadMore
}) => {
  return (
    <div className="min-h-screen mc-pixel-bg py-10 px-4 flex flex-col justify-center items-center">
      <div className="max-w-md w-full mc-card p-6 sm:p-8 text-center bg-white border-3 border-black shadow-[8px_8px_0px_#000] animate-in fade-in zoom-in-95 duration-200">
        {/* Blocky Green Check Icon */}
        <div className="mx-auto w-16 h-16 bg-[#16a34a] border-3 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-white" />
        </div>

        <div className="inline-block bg-[#16a34a] text-white px-3 py-1 border-2 border-black shadow-[2px_2px_0px_#000] text-[11px] font-black uppercase tracking-widest mb-3 font-pixel">
          RECEIVED
        </div>

        {/* Primary Header */}
        <h1 className="text-2xl sm:text-3xl font-black uppercase text-zinc-950 tracking-tight leading-tight">
          UPLOAD SUCCESSFUL!
        </h1>

        {/* Explicit confirmation text requested */}
        <p className="mt-3 text-sm sm:text-base text-zinc-700 font-bold leading-relaxed">
          Your files have been received by{' '}
          <span className="text-[#2563EB]">Oyangoren Printing Services</span>.
        </p>

        {/* Summary pill */}
        <div className="my-5 p-3 bg-zinc-100 border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-mono font-bold text-zinc-800 flex items-center justify-center gap-2">
          <span>{submission.fileCount} {submission.fileCount === 1 ? 'FILE' : 'FILES'} UPLOADED</span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            id="upload-more-files-btn"
            type="button"
            onClick={onUploadMore}
            className="w-full mc-btn-primary py-3 px-6 text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 border-3 border-black shadow-[4px_4px_0px_#000]"
          >
            <UploadCloud className="w-4 h-4" />
            <span>UPLOAD MORE FILES</span>
          </button>

          <button
            id="upload-done-btn"
            type="button"
            onClick={onUploadMore}
            className="w-full mc-btn-secondary py-2.5 px-6 text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 border-2 border-black shadow-[2px_2px_0px_#000]"
          >
            <Check className="w-4 h-4" />
            <span>DONE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
