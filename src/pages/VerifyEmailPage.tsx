import { useState } from 'react';
import { MailCheck, RefreshCw, LogOut, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function VerifyEmailPage() {
  const { user, resendVerification, refreshUser, logout } = useAuth();
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const handleRefresh = async () => {
    setBusy(true);
    setStatus('');
    try {
      const ok = await refreshUser();
      if (!ok) {
        setStatus('Your email is not verified yet. Please click the link in your inbox first.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setStatus('');
    try {
      await resendVerification();
      setStatus('Verification email sent. Check your inbox and spam folder.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unable to resend verification email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 space-y-5">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <MailCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Verify your email address
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            TaskForge enforces verified identity for workspace security. We sent a verification link
            to <span className="font-medium text-slate-900 dark:text-slate-100">{user?.email}</span>.
          </p>
        </div>

        {status && (
          <div className="p-3 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {status}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={handleRefresh}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            I Have Verified — Continue
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleResend}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
            Resend Verification Email
          </button>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out / Use Google Sign-In
          </button>
        </div>
      </div>
    </div>
  );
}
