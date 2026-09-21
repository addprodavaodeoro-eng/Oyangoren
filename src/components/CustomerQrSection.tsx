import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { 
  Download, 
  Printer, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode as QrCodeIcon,
  Sparkles,
  FileText,
  Globe,
  Wifi,
  Radio,
  Smartphone
} from 'lucide-react';
import { getStoredSettings, getEffectivePublicUploadUrl } from '../lib/settings';
import { PrintableQrPosterModal } from './PrintableQrPosterModal';

export const CustomerQrSection: React.FC = () => {
  const settings = getStoredSettings();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showPosterModal, setShowPosterModal] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Generate canonical public URL for customer upload (never local IP/localhost for production QR)
  const uploadUrl = getEffectivePublicUploadUrl(settings);
  const isLocalHost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.'));

  useEffect(() => {
    QRCode.toDataURL(
      uploadUrl,
      {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      },
      (err, url) => {
        if (err) console.error('Failed to generate QR code', err);
        else setQrDataUrl(url);
      }
    );
  }, [uploadUrl]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(uploadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'oyangoren-customer-upload-qr.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="p-4 bg-blue-50 border-3 border-blue-900 shadow-[4px_4px_0px_#1e3a8a] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-900 font-extrabold text-sm uppercase">
            <QrCodeIcon className="w-5 h-5" />
            <span>Permanent Static QR Code</span>
          </div>
          <p className="text-xs text-blue-800 font-medium mt-1">
            This QR code points to your single permanent customer upload page. Print it once and stick it at your store counter, entrance, or print stations!
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="copy-upload-url-btn"
            type="button"
            onClick={handleCopyUrl}
            className="mc-btn-yellow text-xs font-bold px-3 py-2 flex items-center gap-1.5 uppercase"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-800" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied URL!' : 'COPY LINK'}</span>
          </button>
        </div>
      </div>

      {/* Main QR Card Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Printable Card Area */}
        <div className="md:col-span-7 flex justify-center">
          <div
            ref={printAreaRef}
            className="w-full max-w-sm mc-card p-6 bg-white border-3 border-black shadow-[6px_6px_0px_#000] text-center"
          >
            {/* Header in QR Card */}
            <div className="bg-[#2563EB] text-white p-3 border-2 border-black shadow-[2px_2px_0px_#000] mb-4">
              <span className="font-silkscreen text-[11px] text-[#FFD43B] font-bold block tracking-wider">
                SCAN WITH PHONE CAMERA
              </span>
              <h2 className="font-extrabold text-base sm:text-lg uppercase tracking-tight mt-0.5">
                {settings.businessName}
              </h2>
              <div className="inline-block bg-[#FFD43B] text-black font-extrabold text-[11px] px-2 py-0.5 border border-black uppercase mt-1">
                UPLOAD FILES HERE
              </div>
            </div>

            {/* Rendered QR Image with Pixel Border */}
            <div className="p-3 bg-white border-3 border-black shadow-[inset_2px_2px_0px_rgba(0,0,0,0.2)] inline-block mx-auto mb-3">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Customer Upload QR Code"
                  className="w-64 h-64 object-contain mx-auto"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-zinc-100 text-zinc-400 text-xs font-bold">
                  Generating QR...
                </div>
              )}
            </div>

            {/* Simple User Directions */}
            <div className="text-left bg-zinc-50 border-2 border-zinc-800 p-2.5 text-xs text-zinc-800 font-semibold space-y-1 mb-4">
              <p className="flex items-center gap-1.5">
                <span className="w-4 h-4 bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                <span>Open your smartphone camera</span>
              </p>
              <p className="flex items-center gap-1.5">
                <span className="w-4 h-4 bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Scan this QR code & tap the link</span>
              </p>
              <p className="flex items-center gap-1.5">
                <span className="w-4 h-4 bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                <span>Select & upload your documents or images to print!</span>
              </p>
            </div>

            <p className="text-[10px] text-zinc-500 font-medium">
              Permanent QR Code Station • Oyangoren Printing Services
            </p>
          </div>
        </div>

        {/* Action Controls & Instructions */}
        <div className="md:col-span-5 space-y-4">
          <div className="mc-card p-5 bg-white border-3 border-black shadow-[4px_4px_0px_#000]">
            <h3 className="text-sm font-extrabold uppercase text-zinc-900 mb-3 border-b-2 border-dashed border-zinc-300 pb-2">
              QR Code Actions
            </h3>

            <div className="space-y-3">
              {/* Printable A4 Poster Button */}
              <button
                id="open-a4-poster-btn"
                type="button"
                onClick={() => setShowPosterModal(true)}
                className="w-full mc-btn-yellow py-3 px-4 text-xs font-black uppercase flex items-center justify-center gap-2 border-2 border-black shadow-[3px_3px_0px_#000]"
              >
                <FileText className="w-4 h-4" />
                <span>PRINTABLE A4 STORE POSTER</span>
              </button>

              <button
                id="download-qr-png-btn"
                type="button"
                onClick={handleDownloadPng}
                className="w-full mc-btn-success py-2.5 px-4 text-xs font-extrabold uppercase flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>DOWNLOAD QR (PNG)</span>
              </button>

              <button
                id="print-qr-standee-btn"
                type="button"
                onClick={handlePrint}
                className="w-full mc-btn-primary py-2.5 px-4 text-xs font-extrabold uppercase flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>PRINT QR</span>
              </button>

              <button
                type="button"
                onClick={handleCopyUrl}
                className="w-full mc-btn-secondary py-2.5 px-4 text-xs font-extrabold uppercase flex items-center justify-center gap-2 text-center"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-800" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'LINK COPIED!' : 'COPY LINK'}</span>
              </button>

              <a
                href={uploadUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full mc-btn-secondary py-2.5 px-4 text-xs font-extrabold uppercase flex items-center justify-center gap-2 text-center"
              >
                <ExternalLink className="w-4 h-4" />
                <span>OPEN UPLOAD PAGE</span>
              </a>
            </div>
          </div>

          {/* Quick Specifications & Cross-Network Capability */}
          <div className="mc-card p-4 bg-zinc-50 border-2 border-black text-xs text-zinc-700 space-y-3 shadow-[2px_2px_0px_#000]">
            <div className="font-extrabold text-zinc-900 uppercase flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>Public Cloud QR Specifications</span>
            </div>
            
            <p className="font-medium">
              • <strong>Public HTTPS URL:</strong> <code className="bg-zinc-200 px-1 py-0.5 text-blue-900 font-bold break-all">{uploadUrl}</code>
            </p>
            
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-[11px] text-emerald-950 font-medium space-y-1">
              <div className="font-bold flex items-center gap-1 text-emerald-900">
                <Smartphone className="w-3.5 h-3.5" />
                <span>ANY INTERNET CONNECTION READY</span>
              </div>
              <p>Customers can scan and upload from <strong>Mobile Data (4G/5G)</strong>, <strong>Home Wi-Fi</strong>, or <strong>Hotspots</strong>. No store Wi-Fi connection required.</p>
            </div>

            {isLocalHost && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 text-[11px] text-amber-950 font-medium space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-900">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Cross-Network Ready</span>
                </div>
                <p>Localhost detected: This QR code uses the public HTTPS cloud link so that external phone scans work seamlessly across different networks.</p>
              </div>
            )}

            <p className="font-medium text-[11px] text-zinc-600">
              • <strong>Error Correction:</strong> Level H (Highest readability)<br />
              • <strong>Permanence:</strong> Permanent static URL — does not expire across updates.
            </p>
          </div>
        </div>
      </div>

      {/* A4 Poster Modal */}
      {showPosterModal && (
        <PrintableQrPosterModal
          qrDataUrl={qrDataUrl}
          onClose={() => setShowPosterModal(false)}
        />
      )}
    </div>
  );
};
