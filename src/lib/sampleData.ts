import { UploadSession } from '../types';

export const INITIAL_SAMPLE_SUBMISSIONS: UploadSession[] = [
  {
    id: 'sub_demo_001',
    uploadId: 'UPLOAD-20260921-001',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    date: 'September 21, 2026',
    time: '10:42 AM',
    fileCount: 5,
    totalSize: 25690112, // ~24.5 MB
    status: 'NEW',
    isNew: true,
    files: [
      {
        fileId: 'f001_1',
        name: 'Flyer_Poster_Design_Front.pdf',
        type: 'PDF',
        size: 8420000,
        storagePath: 'uploads/UPLOAD-20260921-001/Flyer_Poster_Design_Front.pdf',
        uploadedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        uploadDate: 'September 21, 2026',
        uploadTime: '10:42 AM',
        downloadUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        fileId: 'f001_2',
        name: 'Company_ID_Badge_HighRes.png',
        type: 'PNG',
        size: 4210000,
        storagePath: 'uploads/UPLOAD-20260921-001/Company_ID_Badge_HighRes.png',
        uploadedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        uploadDate: 'September 21, 2026',
        uploadTime: '10:42 AM',
        previewUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        downloadUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80'
      },
      {
        fileId: 'f001_3',
        name: 'Brochure_Trifold_Spread.docx',
        type: 'DOCX',
        size: 3840000,
        storagePath: 'uploads/UPLOAD-20260921-001/Brochure_Trifold_Spread.docx',
        uploadedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        uploadDate: 'September 21, 2026',
        uploadTime: '10:42 AM'
      },
      {
        fileId: 'f001_4',
        name: 'Sticker_DieCut_Layout.ai',
        type: 'AI',
        size: 6120000,
        storagePath: 'uploads/UPLOAD-20260921-001/Sticker_DieCut_Layout.ai',
        uploadedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        uploadDate: 'September 21, 2026',
        uploadTime: '10:42 AM'
      },
      {
        fileId: 'f001_5',
        name: 'Tarpaulin_Banner_7x3ft.jpg',
        type: 'JPG',
        size: 3100112,
        storagePath: 'uploads/UPLOAD-20260921-001/Tarpaulin_Banner_7x3ft.jpg',
        uploadedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        uploadDate: 'September 21, 2026',
        uploadTime: '10:42 AM',
        previewUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80',
        downloadUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=800&q=80'
      }
    ]
  },
  {
    id: 'sub_demo_002',
    uploadId: 'UPLOAD-20260921-002',
    createdAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    date: 'September 21, 2026',
    time: '9:25 AM',
    fileCount: 2,
    totalSize: 12400000,
    status: 'DOWNLOADED',
    files: [
      {
        fileId: 'f002_1',
        name: 'Architectural_Floor_Plan_A3.pdf',
        type: 'PDF',
        size: 9400000,
        storagePath: 'uploads/UPLOAD-20260921-002/Architectural_Floor_Plan_A3.pdf',
        uploadedAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
        uploadDate: 'September 21, 2026',
        uploadTime: '9:25 AM',
        downloadUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        fileId: 'f002_2',
        name: 'Materials_Cost_Estimate.xlsx',
        type: 'XLSX',
        size: 3000000,
        storagePath: 'uploads/UPLOAD-20260921-002/Materials_Cost_Estimate.xlsx',
        uploadedAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
        uploadDate: 'September 21, 2026',
        uploadTime: '9:25 AM'
      }
    ]
  },
  {
    id: 'sub_demo_003',
    uploadId: 'UPLOAD-20260920-003',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    date: 'September 20, 2026',
    time: '4:15 PM',
    fileCount: 3,
    totalSize: 18200000,
    status: 'COMPLETED',
    files: [
      {
        fileId: 'f003_1',
        name: 'Certificate_Templates_Gold.pdf',
        type: 'PDF',
        size: 7200000,
        storagePath: 'uploads/UPLOAD-20260920-003/Certificate_Templates_Gold.pdf',
        uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        uploadDate: 'September 20, 2026',
        uploadTime: '4:15 PM'
      },
      {
        fileId: 'f003_2',
        name: 'Event_Backdrop_Stage.psd',
        type: 'PSD',
        size: 9800000,
        storagePath: 'uploads/UPLOAD-20260920-003/Event_Backdrop_Stage.psd',
        uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        uploadDate: 'September 20, 2026',
        uploadTime: '4:15 PM'
      },
      {
        fileId: 'f003_3',
        name: 'Guest_List_Roster.txt',
        type: 'TXT',
        size: 1200000,
        storagePath: 'uploads/UPLOAD-20260920-003/Guest_List_Roster.txt',
        uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        uploadDate: 'September 20, 2026',
        uploadTime: '4:15 PM'
      }
    ]
  }
];
