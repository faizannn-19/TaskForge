import { useState } from 'react';
import {
  Check,
  Edit3,
  Mail,
  Plus,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  createWorkspace,
  removeWorkspaceMember,
  respondToInvitation,
  revokeInvitation,
  sendWorkspaceInvitation,
  updateMemberRole,
  updateWorkspace,
} from '../lib/firestoreService';
import { Avatar } from '../components/Avatar';
import { InviteMemberModal, WorkspaceModal } from '../components/Modals';
import { Workspace } from '../types/models';

export function WorkspacesPage() {
  const { user, profile } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    myRole,
    members,
    workspaceInvitations,
    myPendingInvitations,
  } = useWorkspace();

  const [showCreateWs, setShowCreateWs] = useState(false);
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const actor = {
    uid: user?.uid || '',
    displayName: profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  };

  const canManage = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Workspaces & Team
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Switch workspaces, invite teammates, and enforce owner/admin/member permissions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateWs(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Workspace
        </button>
      </div>

      {actionError && (
        <div className="p-3.5 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError('')}
            className="font-medium hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pending Invitations Received */}
      {myPendingInvitations.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Invitations for You
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {myPendingInvitations.map((inv) => (
              <div key={inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {inv.workspaceName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Invited by {inv.invitedByName} · Role: {inv.role}
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                  >
                    Accept & Join
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
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Your Workspaces Grid */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Your Workspaces ({workspaces.length})
        </h2>
        {workspaces.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              You have not joined any workspaces yet.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateWs(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Create Workspace
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspace?.id;
              return (
                <div
                  key={ws.id}
                  className={`bg-white dark:bg-slate-900 border rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors ${
                    isActive
                      ? 'border-indigo-600 dark:border-indigo-500'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {ws.name}
                      </h3>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 shrink-0">
                          <Check className="w-3.5 h-3.5" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {ws.description || 'No workspace description provided.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-mono text-slate-400">/{ws.slug}</span>
                    <div className="flex items-center gap-2">
                      {isActive && canManage && (
                        <button
                          type="button"
                          onClick={() => setEditingWs(ws)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                          title="Edit workspace"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => setActiveWorkspaceId(ws.id)}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Active Workspace Members & Access Control */}
      {activeWorkspace && (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Members of {activeWorkspace.name} ({members.length})
              </h2>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowInvite(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite Member
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-5">Member</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {members.map((m) => {
                  const isSelf = m.userId === user?.uid;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={m.displayName} photoURL={m.photoURL} size="sm" />
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {m.displayName} {isSelf && <span className="text-slate-400">(You)</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono">
                        {m.email}
                      </td>
                      <td className="py-3 px-4">
                        {isOwner && m.role !== 'owner' ? (
                          <select
                            value={m.role}
                            disabled={busyId === m.id}
                            onChange={async (e) => {
                              const nextRole = e.target.value as 'admin' | 'member';
                              setBusyId(m.id);
                              try {
                                await updateMemberRole(m.id, nextRole);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="px-2 py-1 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1 capitalize font-medium text-slate-700 dark:text-slate-300">
                            <Shield className="w-3.5 h-3.5 text-slate-400" />
                            {m.role}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right">
                        {m.role !== 'owner' &&
                          (isSelf || isOwner || (canManage && m.role === 'member')) && (
                            <button
                              type="button"
                              disabled={busyId === m.id}
                              onClick={async () => {
                                setBusyId(m.id);
                                setActionError('');
                                try {
                                  await removeWorkspaceMember(m.id);
                                } catch (err) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Unable to remove member.'
                                  );
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {isSelf ? 'Leave' : 'Remove'}
                            </button>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {workspaceInvitations.filter((i) => i.status === 'pending').length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Pending Sent Invitations
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {workspaceInvitations
                  .filter((i) => i.status === 'pending')
                  .map((inv) => (
                    <div
                      key={inv.id}
                      className="py-2 flex items-center justify-between text-xs gap-4"
                    >
                      <div className="text-slate-600 dark:text-slate-400">
                        <span className="font-mono text-slate-900 dark:text-slate-100">
                          {inv.inviteeEmail}
                        </span>{' '}
                        · {inv.role} · invited by {inv.invitedByName}
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => revokeInvitation(inv.id)}
                          className="text-rose-600 dark:text-rose-400 hover:underline shrink-0"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {showCreateWs && (
        <WorkspaceModal
          onClose={() => setShowCreateWs(false)}
          onSubmit={async (data) => {
            const newId = await createWorkspace(actor, data);
            setActiveWorkspaceId(newId);
          }}
        />
      )}

      {editingWs && (
        <WorkspaceModal
          initial={editingWs}
          onClose={() => setEditingWs(null)}
          onSubmit={async (data) => {
            await updateWorkspace(editingWs.id, actor, data);
          }}
        />
      )}

      {showInvite && activeWorkspace && (
        <InviteMemberModal
          workspaceName={activeWorkspace.name}
          onClose={() => setShowInvite(false)}
          onSubmit={async (data) => {
            await sendWorkspaceInvitation({
              workspaceId: activeWorkspace.id,
              workspaceName: activeWorkspace.name,
              inviteeEmail: data.email,
              role: data.role,
              actor,
            });
          }}
        />
      )}
    </div>
  );
}
