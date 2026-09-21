import React from 'react';
import { X, CheckCircle, Shield, Database, QrCode, Globe, HardDrive, Key } from 'lucide-react';

export const SetupGuideModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl border-3 border-black shadow-[8px_8px_0px_#000] relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#0f172a] text-white p-4 border-b-3 border-black flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#2563EB] text-[#FFD43B] flex items-center justify-center font-bold text-xs border border-black">
              ★
            </div>
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-white">
              Oyangoren Printing Services — Production Setup Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-red-600 border border-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto text-xs space-y-6 text-zinc-800">
          {/* Section 1 */}
          <div className="mc-card p-4 bg-zinc-50 border-2 border-black">
            <div className="flex items-center gap-2 text-blue-700 font-extrabold text-sm uppercase mb-2">
              <Key className="w-4 h-4" />
              <span>1. How to Connect Firebase & Create the First Super Admin Account</span>
            </div>
            <p className="mb-2">
              The project is already provisioned with Firebase configuration. To manage real administrators:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 font-medium">
              <li>
                Open the <strong>Firebase Console</strong> (<code>https://console.firebase.google.com</code>) under project <code>polar-world-17c1c</code>.
              </li>
              <li>
                Go to <strong>Authentication &gt; Sign-in method</strong> and verify that <strong>Email/Password</strong> provider is enabled.
              </li>
              <li>
                Under <strong>Users</strong> tab, click <strong>Add user</strong> and enter your Super Admin email and a strong password.
              </li>
              <li>
                Alternatively, on the app's admin login screen, you can toggle <em>"First-time setup? Register the root Firebase administrator here"</em> to register directly through the secure SDK.
              </li>
            </ol>
          </div>

          {/* Section 2 */}
          <div className="mc-card p-4 bg-zinc-50 border-2 border-black">
            <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm uppercase mb-2">
              <Database className="w-4 h-4" />
              <span>2. Firestore & Firebase Storage Security Rules</span>
            </div>
            <p className="mb-2 font-medium">
              To ensure customer files remain private and only authorized Super Admins can browse and download files, apply the rules below in the Firebase Console:
            </p>

            <div className="space-y-3">
              <div>
                <span className="font-bold text-zinc-900 block mb-1">Firestore Rules (`firestore.rules`):</span>
                <pre className="bg-zinc-900 text-zinc-100 p-3 overflow-x-auto text-[11px] font-mono border-2 border-black">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /submissions/{submissionId} {
      // Public customers can submit orders with validated fields
      allow create: if request.resource.data.customerName is string
                    && request.resource.data.contactNumber is string;
      
      // Only authenticated Super Admins can list, inspect, update, or delete submissions
      allow read, update, delete: if request.auth != null;
    }
  }
}`}
                </pre>
              </div>

              <div>
                <span className="font-bold text-zinc-900 block mb-1">Firebase Storage Rules (`storage.rules`):</span>
                <pre className="bg-zinc-900 text-zinc-100 p-3 overflow-x-auto text-[11px] font-mono border-2 border-black">
{`rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{submissionId}/{fileName} {
      // Allow customers to upload their print files
      allow create: if request.resource.size < 100 * 1024 * 1024;
      
      // Only authenticated Super Admin staff can read or delete uploaded documents
      allow read, delete: if request.auth != null;
    }
  }
}`}
                </pre>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="mc-card p-4 bg-zinc-50 border-2 border-black">
            <div className="flex items-center gap-2 text-amber-700 font-extrabold text-sm uppercase mb-2">
              <QrCode className="w-4 h-4" />
              <span>3. How to Get the Permanent Public URL & Print the Standalone QR Code</span>
            </div>
            <ol className="list-decimal pl-5 space-y-1.5 font-medium">
              <li>
                Click on the <strong>QR Code</strong> tab in the Super Admin sidebar.
              </li>
              <li>
                The system automatically creates a static QR code bound to your root URL (e.g. <code>https://ais-dev-...run.app/</code> or your custom domain).
              </li>
              <li>
                Click <strong>Download High-Res QR (PNG)</strong> to get a crisp graphic for counter stickers, acrylic stands, or tarpaulins.
              </li>
              <li>
                Click <strong>Print Standee / Poster</strong> to print a customer guide flyer ready for display.
              </li>
              <li>
                Customers scan this ONE static QR code; they never need individual QR codes.
              </li>
            </ol>
          </div>

          {/* Section 4 */}
          <div className="mc-card p-4 bg-zinc-50 border-2 border-black">
            <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-sm uppercase mb-2">
              <Globe className="w-4 h-4" />
              <span>4. How to Test & Deploy the Application</span>
            </div>
            <ul className="list-disc pl-5 space-y-1.5 font-medium">
              <li>
                <strong>Testing Customer Upload:</strong> Fill in the test name, contact number, attach sample PDFs/images, and tap <em>Upload Files</em>. Verify you receive an Upload ID (e.g., <code>OYA-20260921-A8F4</code>).
              </li>
              <li>
                <strong>Testing Admin View:</strong> Log in via the Super Admin portal, check the real-time statistics cards, open the submission details modal, preview documents, and test downloading the bundled ZIP file.
              </li>
              <li>
                <strong>Deployment:</strong> Build static bundles using <code>npm run build</code> and host on Firebase Hosting (<code>firebase deploy --only hosting</code>) or Cloud Run container deployment.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-zinc-100 border-t-2 border-black flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="mc-btn-primary text-xs font-bold px-4 py-2 uppercase"
          >
            I Understand, Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
