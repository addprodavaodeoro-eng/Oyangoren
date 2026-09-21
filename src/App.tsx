import React, { useState, useEffect, useCallback } from 'react';
import { CustomerUploadView } from './components/CustomerUploadView';
import { SuccessView } from './components/SuccessView';
import { AdminLogin } from './components/AdminLogin';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { UploadSession } from './types';
import { subscribeToSubmissions } from './lib/submissionService';
import { INITIAL_SAMPLE_SUBMISSIONS } from './lib/sampleData';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { WifiOff } from 'lucide-react';

type CurrentView = 'customer-upload' | 'customer-success' | 'admin-login' | 'admin-dashboard';

function AppContent() {
  const { isAdmin, loading: authLoading, roleLoading, isOnline } = useAuth();
  const [currentView, setCurrentView] = useState<CurrentView>('customer-upload');
  const [lastSubmission, setLastSubmission] = useState<UploadSession | null>(null);
  const [submissions, setSubmissions] = useState<UploadSession[]>(() => {
    // Seed initial sample sessions into localStorage if empty
    try {
      const local = localStorage.getItem('oyangoren_local_submissions');
      if (!local) {
        localStorage.setItem('oyangoren_local_submissions', JSON.stringify(INITIAL_SAMPLE_SUBMISSIONS));
        return INITIAL_SAMPLE_SUBMISSIONS;
      }
      return JSON.parse(local);
    } catch {
      return INITIAL_SAMPLE_SUBMISSIONS;
    }
  });

  // Navigation handler synchronizing browser history
  const navigateTo = useCallback((path: string, replace = false) => {
    if (typeof window !== 'undefined') {
      if (replace) {
        window.history.replaceState(null, '', path);
      } else {
        window.history.pushState(null, '', path);
      }
    }

    if (path.startsWith('/admin')) {
      if (path === '/admin/login') {
        if (isAdmin) {
          console.log('[Auth] REDIRECTING TO DASHBOARD');
          setCurrentView('admin-dashboard');
        } else {
          setCurrentView('admin-login');
        }
      } else {
        // Any admin dashboard route
        setCurrentView(isAdmin ? 'admin-dashboard' : 'admin-login');
      }
    } else {
      setCurrentView('customer-upload');
    }
  }, [isAdmin]);

  // Handle initial route and browser Back/Forward (popstate)
  useEffect(() => {
    const syncRouteFromLocation = () => {
      if (typeof window === 'undefined') return;
      const pathname = window.location.pathname;

      if (pathname.startsWith('/admin')) {
        // DO NOT redirect while authentication or role verification is still loading!
        if (authLoading || roleLoading) {
          return;
        }

        if (!isAdmin) {
          // If unauthenticated user tries to access /admin or any /admin/* route, redirect them to /admin/login
          if (pathname !== '/admin/login') {
            console.log('[Auth] REDIRECTING TO LOGIN');
            window.history.replaceState(null, '', '/admin/login');
          }
          setCurrentView('admin-login');
        } else {
          // If authenticated Super Admin visits /admin or /admin/login, redirect to /admin/dashboard
          if (pathname === '/admin' || pathname === '/admin/login') {
            console.log('[Auth] REDIRECTING TO DASHBOARD');
            window.history.replaceState(null, '', '/admin/dashboard');
          }
          setCurrentView('admin-dashboard');
        }
      } else {
        setCurrentView('customer-upload');
      }
    };

    syncRouteFromLocation();

    const handlePopState = () => {
      syncRouteFromLocation();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAdmin, authLoading, roleLoading]);

  // Subscribe to real-time Firestore submissions updates
  useEffect(() => {
    const unsubscribe = subscribeToSubmissions((items) => {
      setSubmissions(items);
    });
    return () => unsubscribe();
  }, []);

  const handleUploadSuccess = (session: UploadSession) => {
    setLastSubmission(session);
    setSubmissions((prev) => [session, ...prev.filter((item) => item.id !== session.id)]);
    setCurrentView('customer-success');
  };

  const handleSubmissionUpdated = (updated: UploadSession) => {
    setSubmissions((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const handleSubmissionDeleted = (id: string) => {
    setSubmissions((prev) => prev.filter((item) => item.id !== id));
  };

  // If loading session on an admin path, show authentic loading state without redirecting
  if ((authLoading || roleLoading) && typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return (
      <div className="min-h-screen mc-pixel-bg flex items-center justify-center p-4">
        <div className="mc-card p-6 bg-white border-3 border-black shadow-[6px_6px_0px_#000] text-center max-w-sm w-full animate-in fade-in duration-200">
          <div className="w-12 h-12 bg-[#2563EB] border-3 border-black mx-auto mb-3 flex items-center justify-center font-pixel text-[#FFD43B] text-xl shadow-[3px_3px_0px_#000]">
            ★
          </div>
          <div className="font-pixel text-xs font-black text-zinc-900 mb-1 uppercase tracking-wider">
            VERIFYING SESSION...
          </div>
          <p className="text-[11px] text-zinc-600 font-medium">
            Checking Super Admin cryptographic credentials & persistence.
          </p>
          <div className="mt-4 flex justify-center">
            <span className="animate-spin inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Offline Status Notice (Session Preserved) */}
      {!isOnline && (
        <div className="bg-amber-500 text-black px-4 py-1.5 border-b-2 border-black flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider z-50 sticky top-0 shadow-[0_2px_0_#000]">
          <WifiOff className="w-4 h-4" />
          <span>OFFLINE MODE: Network interrupted. Active session & local records preserved.</span>
        </div>
      )}

      {/* Route: Customer Upload */}
      {currentView === 'customer-upload' && (
        <CustomerUploadView
          onSuccess={handleUploadSuccess}
          onOpenAdminLogin={() => {
            if (isAdmin) {
              navigateTo('/admin/dashboard');
            } else {
              navigateTo('/admin/login');
            }
          }}
        />
      )}

      {/* Route: Upload Success */}
      {currentView === 'customer-success' && lastSubmission && (
        <SuccessView
          submission={lastSubmission}
          onUploadMore={() => navigateTo('/')}
        />
      )}

      {/* Route: Super Admin Login */}
      {currentView === 'admin-login' && (
        <AdminLogin
          onBackToCustomerView={() => navigateTo('/')}
          onLoginSuccess={() => {
            console.log('[Auth] REDIRECTING TO DASHBOARD');
            // After successful login, redirect cleanly to: /admin/dashboard
            navigateTo('/admin/dashboard');
          }}
        />
      )}

      {/* Route: Super Admin Dashboard */}
      {currentView === 'admin-dashboard' && (
        <SuperAdminDashboard
          submissions={submissions}
          onOpenCustomerView={() => navigateTo('/')}
          onLogout={() => {
            console.log('[Auth] REDIRECTING TO LOGIN');
            // After logout, redirect cleanly to /admin/login
            navigateTo('/admin/login');
          }}
          onSubmissionUpdated={handleSubmissionUpdated}
          onSubmissionDeleted={handleSubmissionDeleted}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
