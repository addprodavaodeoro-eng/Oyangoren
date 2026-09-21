import React, { useRef } from 'react';
import { Printer, Download, X, Sparkles, CheckCircle2 } from 'lucide-react';

interface PrintableQrPosterModalProps {
  qrDataUrl: string;
  onClose: () => void;
}

export const PrintableQrPosterModal: React.FC<PrintableQrPosterModalProps> = ({
  qrDataUrl,
  onClose
}) => {
  const posterRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPng = () => {
    // Generate clean canvas of poster
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 1200, 1600);

    // Thick Minecraft-style border
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(30, 30, 1140, 1540);

    // Header block
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(60, 60, 1080, 200);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.strokeRect(60, 60, 1080, 200);

    // Header Title
    ctx.fillStyle = '#FFD43B';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★ OFFICIAL PRINT PORTAL ★', 600, 120);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 48px sans-serif';
    ctx.fillText('OYANGOREN PRINTING SERVICES', 600, 180);

    ctx.fillStyle = '#000000';
    ctx.font = '900 52px sans-serif';
    ctx.fillText('SCAN TO UPLOAD', 600, 330);

    // Load and draw QR code
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 360, 370, 480, 480);
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(355, 365, 490, 490);

      // Button banner
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(250, 890, 700, 90);
      ctx.strokeRect(250, 890, 700, 90);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 38px sans-serif';
      ctx.fillText('UPLOAD FILES HERE', 600, 950);

      // Instructions box
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(200, 1030, 800, 380);
      ctx.strokeRect(200, 1030, 800, 380);

      ctx.fillStyle = '#000000';
      ctx.font = '900 30px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('HOW TO PRINT YOUR FILES:', 240, 1080);

      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('1. Scan QR Code using camera', 240, 1140);
      ctx.fillText('2. Tap "Upload Files Here"', 240, 1200);
      ctx.fillText('3. Select your files from phone', 240, 1260);
      ctx.fillText('4. Tap "Upload"', 240, 1320);
      ctx.fillText('5. Done! Files received instantly', 240, 1380);

      // Footer
      ctx.fillStyle = '#FFD43B';
      ctx.fillRect(60, 1450, 1080, 90);
      ctx.strokeRect(60, 1450, 1080, 90);
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = '900 34px sans-serif';
      ctx.fillText('FAST • EASY • NO USB NEEDED', 600, 1510);

      // Download
      const link = document.createElement('a');
      link.download = 'oyangoren-printing-a4-poster.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = qrDataUrl;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border-3 border-black shadow-[10px_10px_0px_#000] max-w-3xl w-full p-4 sm:p-6 my-auto">
        {/* Top Controls Bar */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-xs text-blue-700 font-bold uppercase">
              ★ PRINTABLE A4 STORE POSTER ★
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="mc-btn-primary py-1.5 px-3 text-xs font-black uppercase flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PRINT / SAVE AS PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              className="mc-btn-yellow py-1.5 px-3 text-xs font-black uppercase flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD PNG</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-zinc-200 hover:bg-zinc-300 border-2 border-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Poster Preview Frame (Styled A4 Ratio) */}
        <div className="flex justify-center bg-zinc-100 p-4 border-2 border-black overflow-x-auto">
          <div
            ref={posterRef}
            id="printable-a4-poster"
            className="w-[480px] bg-white border-4 border-black p-6 shadow-[6px_6px_0px_#000] text-center flex flex-col justify-between"
          >
            {/* Blue Brand Banner */}
            <div className="bg-[#2563EB] text-white p-4 border-3 border-black shadow-[3px_3px_0px_#000] mb-4">
              <span className="font-pixel text-[10px] text-[#FFD43B] font-bold block mb-1">
                ★ OFFICIAL UPLOAD STATION ★
              </span>
              <h2 className="font-black text-xl sm:text-2xl uppercase tracking-tight">
                OYANGOREN
              </h2>
              <div className="text-xs uppercase font-extrabold text-blue-100 tracking-wider">
                Printing Services
              </div>
            </div>

            {/* SCAN TO UPLOAD Heading */}
            <div className="my-2">
              <h3 className="font-pixel text-lg sm:text-xl font-black text-zinc-950 uppercase tracking-tight">
                SCAN TO UPLOAD
              </h3>
              <p className="text-xs text-zinc-600 font-bold uppercase mt-1">
                Point your phone camera at the QR code below
              </p>
            </div>

            {/* Large QR Code */}
            <div className="my-3 inline-block mx-auto bg-white p-3 border-4 border-black shadow-[4px_4px_0px_#000]">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Customer Upload QR Code"
                  className="w-56 h-56 mx-auto block"
                />
              ) : (
                <div className="w-56 h-56 bg-zinc-200 animate-pulse flex items-center justify-center font-pixel text-xs">
                  GENERATING QR...
                </div>
              )}
            </div>

            {/* Green Action Box */}
            <div className="my-3">
              <div className="inline-block bg-[#16a34a] text-white border-3 border-black font-black text-sm uppercase px-6 py-2.5 shadow-[3px_3px_0px_#000]">
                UPLOAD FILES HERE
              </div>
            </div>

            {/* Simple Step-by-Step Instructions */}
            <div className="bg-amber-50/80 border-3 border-black p-4 text-left shadow-[3px_3px_0px_#000] my-2">
              <div className="font-pixel text-[11px] font-bold text-zinc-950 uppercase mb-2">
                SIMPLE INSTRUCTIONS:
              </div>
              <ol className="text-xs font-bold text-zinc-800 space-y-1.5 list-decimal list-inside">
                <li>Scan QR Code</li>
                <li>Tap "Upload Files Here"</li>
                <li>Select your files</li>
                <li>Tap "Upload"</li>
                <li>Done! Files received immediately</li>
              </ol>
            </div>

            {/* Yellow Footer */}
            <div className="mt-4 bg-[#FFD43B] text-black border-3 border-black py-2.5 px-4 font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_#000]">
              FAST • EASY • NO USB NEEDED
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
