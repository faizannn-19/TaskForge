import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Mail, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  respondToInvitation,
} from '../lib/firestoreService';
import { formatRelativeTime } from '../lib/utils';

export function NotificationsPage() {
  const { user, profile } = useAuth();
  const {
    notifications,
    myPendingInvitations,
    setActiveWorkspaceId,
  } = useWorkspace();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const actor = {
    uid: user?.uid || '',
    displayName: profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  };

  const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
  const displayed =
    filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Notifications
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time task assignments, status updates, @mentions, and workspace invitations.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                filter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                filter === 'unread'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Unread ({unreadIds.length})
            </button>
          </div>

          {unreadIds.length > 0 && (
            <button
              type="button"
              onClick={() => markAllNotificationsRead(unreadIds)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {myPendingInvitations.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
          {myPendingInvitations.map((inv) => (
            <div key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Invitation to join {inv.workspaceName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    From {inv.invitedByName} · Role: {inv.role}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  onClick={async () => {
                    setBusyId(inv.id);
                    try {
                      await respondToInvitation(inv, true, actor);
                      setActiveWorkspaceId(inv.workspaceId);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  onClick={async () => {
                    setBusyId(inv.id);
                    try {
                      await respondToInvitation(inv, false, actor);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Notifications Stream */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
        {displayed.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Bell className="w-7 h-7 text-slate-400 mx-auto" />
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {filter === 'unread' ? 'All caught up' : 'No notifications yet'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Assignments, updates, and @mentions will appear here automatically.
            </p>
          </div>
        ) : (
          displayed.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                !n.isRead ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {n.title}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="capitalize text-slate-500 dark:text-slate-400">{n.type}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-400 tabular-nums">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{n.message}</p>
                {n.link && (
                  <Link
                    to={n.link}
                    onClick={() => {
                      if (!n.isRead) void markNotificationRead(n.id, true);
                    }}
                    className="inline-block text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline pt-0.5"
                  >
                    View item
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => markNotificationRead(n.id, !n.isRead)}
                  title={n.isRead ? 'Mark as unread' : 'Mark as read'}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteNotification(n.id)}
                  title="Delete notification"
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
