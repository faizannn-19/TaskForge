import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  Layers,
  Plus,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  createProject,
  createWorkspace,
  respondToInvitation,
} from '../lib/firestoreService';
import {
  formatRelativeTime,
  formatShortDate,
  isOverdue,
  PRIORITY_LABELS,
  priorityColorClasses,
  STATUS_LABELS,
  statusColorClasses,
} from '../lib/utils';
import { ProjectModal, WorkspaceModal } from '../components/Modals';

export function DashboardPage() {
  const { user, profile } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspaceId,
    projects,
    tasks,
    members,
    activityLogs,
    myPendingInvitations,
    loadingWorkspaces,
    loadingWorkspaceData,
  } = useWorkspace();

  const [showCreateWs, setShowCreateWs] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);

  const actor = {
    uid: user?.uid || '',
    displayName: profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  };

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== 'archived'),
    [projects]
  );
  const openTasks = useMemo(() => tasks.filter((t) => t.status !== 'done'), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 'done'), [tasks]);
  const overdueTasks = useMemo(
    () => tasks.filter((t) => isOverdue(t.dueDate, t.status)),
    [tasks]
  );

  const myTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.assigneeId === user?.uid && t.status !== 'done')
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
        .slice(0, 6),
    [tasks, user?.uid]
  );

  const upcomingDeadlines = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate && t.status !== 'done')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 5),
    [tasks]
  );

  if (loadingWorkspaces) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // First-time user onboarding if no workspaces joined yet
  if (workspaces.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 space-y-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome to TaskForge, {actor.displayName}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
            Create your first workspace to manage projects, track sprints on a real-time Kanban
            board, and collaborate with your team — or accept an invitation below.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowCreateWs(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Your First Workspace
            </button>
          </div>
        </div>

        {myPendingInvitations.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Pending Workspace Invitations
            </h2>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {myPendingInvitations.map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between gap-4">
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
                      disabled={inviteBusy === inv.id}
                      onClick={async () => {
                        setInviteBusy(inv.id);
                        try {
                          await respondToInvitation(inv, true, actor);
                          setActiveWorkspaceId(inv.workspaceId);
                        } finally {
                          setInviteBusy(null);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={inviteBusy === inv.id}
                      onClick={async () => {
                        setInviteBusy(inv.id);
                        try {
                          await respondToInvitation(inv, false, actor);
                        } finally {
                          setInviteBusy(null);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showCreateWs && (
          <WorkspaceModal
            onClose={() => setShowCreateWs(false)}
            onSubmit={async (data) => {
              const id = await createWorkspace(actor, data);
              setActiveWorkspaceId(id);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {activeWorkspace?.name || 'Workspace Overview'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {activeWorkspace?.description ||
              `${members.length} member${members.length === 1 ? '' : 's'} · Real-time workspace status`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowCreateProject(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Project
          </button>
          <Link
            to="/kanban"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap"
          >
            Open Board
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Pending Invitations Banner */}
      {myPendingInvitations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-700 dark:text-slate-300">
            You have <span className="font-semibold tabular-nums">{myPendingInvitations.length}</span>{' '}
            pending workspace invitation{myPendingInvitations.length === 1 ? '' : 's'}.
          </div>
          <Link
            to="/workspaces"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
          >
            Review Invitations
          </Link>
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Active Projects</span>
            <FolderKanban className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {activeProjects.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {projects.filter((p) => p.status === 'archived').length} archived
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Open Tasks</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {openTasks.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {tasks.filter((t) => t.status === 'in_progress').length} in progress
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Completed Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {completedTasks.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}% completion
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Overdue & Team</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div
            className={`mt-2 text-2xl font-semibold tabular-nums ${
              overdueTasks.length > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {overdueTasks.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            overdue · {members.length} team member{members.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: My Tasks + Projects Progress */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                My Assigned Tasks
              </h2>
              <Link
                to="/kanban"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View all
              </Link>
            </div>
            {loadingWorkspaceData ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                ))}
              </div>
            ) : myTasks.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No open tasks assigned to you
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Create a project and assign tasks to see your personal queue here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {myTasks.map((task) => (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                          {task.taskKey}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={statusColorClasses(task.status)}>
                          {STATUS_LABELS[task.status]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={priorityColorClasses(task.priority)}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate mt-0.5">
                        {task.title}
                      </div>
                    </div>
                    <div
                      className={`text-xs font-mono tabular-nums shrink-0 ${
                        isOverdue(task.dueDate, task.status)
                          ? 'text-rose-600 dark:text-rose-400 font-medium'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {task.dueDate ? formatShortDate(task.dueDate) : 'No due date'}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Project Progress
              </h2>
              <Link
                to="/projects"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Manage projects
              </Link>
            </div>
            {activeProjects.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No projects in this workspace yet
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateProject(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Project
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeProjects.slice(0, 5).map((proj) => {
                  const pTasks = tasks.filter((t) => t.projectId === proj.id);
                  const doneCount = pTasks.filter((t) => t.status === 'done').length;
                  return (
                    <Link
                      key={proj.id}
                      to={`/projects/${proj.id}`}
                      className="block px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {proj.key}
                          </span>
                          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {proj.name}
                          </span>
                        </div>
                        <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400 shrink-0">
                          {doneCount}/{pTasks.length} tasks · {proj.progress}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${proj.progress}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Col: Upcoming Deadlines + Live Activity Feed */}
        <div className="space-y-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Upcoming Deadlines
              </h2>
              <Link
                to="/calendar"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5" />
                Calendar
              </Link>
            </div>
            {upcomingDeadlines.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No upcoming task deadlines scheduled.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {upcomingDeadlines.map((task) => (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className="block px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        {task.taskKey}
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          isOverdue(task.dueDate, task.status)
                            ? 'text-rose-600 dark:text-rose-400 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {formatShortDate(task.dueDate)}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate mt-1">
                      {task.title}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent Activity
              </h2>
            </div>
            {activityLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Workspace activity will appear here in real time.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-80 overflow-y-auto">
                {activityLogs.slice(0, 12).map((log) => (
                  <div key={log.id} className="px-5 py-3 text-xs space-y-0.5">
                    <div className="text-slate-800 dark:text-slate-200">
                      <span className="font-medium">{log.actorName}</span>{' '}
                      <span className="text-slate-500 dark:text-slate-400">
                        {log.action.replace(/_/g, ' ')}
                      </span>{' '}
                      <span className="font-medium">{log.targetTitle}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 tabular-nums">
                      {log.details ? `${log.details} · ` : ''}
                      {formatRelativeTime(log.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {showCreateProject && activeWorkspace && (
        <ProjectModal
          onClose={() => setShowCreateProject(false)}
          onSubmit={async (data) => {
            await createProject(activeWorkspace.id, actor, data);
          }}
        />
      )}
    </div>
  );
}
