import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Edit3,
  Flag,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { createTask, updateProject, updateTask } from '../lib/firestoreService';
import {
  formatRelativeTime,
  formatShortDate,
  isOverdue,
  PRIORITY_LABELS,
  priorityColorClasses,
  PROJECT_STATUS_LABELS,
  STATUS_LABELS,
  statusColorClasses,
} from '../lib/utils';
import { ProjectModal, TaskModal } from '../components/Modals';
import { TaskStatus } from '../types/models';

export function ProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { projects, tasks, members, activityLogs, myRole, unreadMessagesByChannel } =
    useWorkspace();

  const [tab, setTab] = useState<'tasks' | 'milestones' | 'activity'>('tasks');
  const [showEdit, setShowEdit] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);

  const project = projects.find((p) => p.id === projectId);
  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === projectId),
    [tasks, projectId]
  );
  const projectLogs = useMemo(
    () => activityLogs.filter((l) => l.projectId === projectId),
    [activityLogs, projectId]
  );

  const actor = {
    uid: user?.uid || '',
    displayName: profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  };

  if (!project) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Project not found in the active workspace.
        </p>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Projects
        </Link>
      </div>
    );
  }

  const canManage =
    myRole === 'owner' || myRole === 'admin' || project.ownerId === user?.uid;

  const displayedTasks =
    tab === 'milestones' ? projectTasks.filter((t) => t.isMilestone) : projectTasks;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Link to="/projects" className="hover:text-slate-900 dark:hover:text-slate-100 inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Projects
        </Link>
        <span>/</span>
        <span className="font-mono text-slate-700 dark:text-slate-300">{project.key}</span>
      </div>

      {/* Project Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {project.key}
              </span>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {project.name}
              </h1>
            </div>
            <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Status: {PROJECT_STATUS_LABELS[project.status]}</span>
              <span aria-hidden="true">·</span>
              <span className={priorityColorClasses(project.priority)}>
                Priority: {PRIORITY_LABELS[project.priority]}
              </span>
              <span aria-hidden="true">·</span>
              <span>Owner: {project.ownerName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Deadline: {project.deadline ? formatShortDate(project.deadline) : 'Not set'}
              </span>
            </div>
            {project.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/chat?channel=${project.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Channel</span>
              {(unreadMessagesByChannel[project.id] || 0) > 0 && (
                <span className="font-mono tabular-nums text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                  {unreadMessagesByChannel[project.id]}
                </span>
              )}
            </button>
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => setShowEdit(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                {project.status !== 'archived' ? (
                  <button
                    type="button"
                    onClick={() => updateProject(project, actor, { status: 'archived' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Archive
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateProject(project, actor, { status: 'active' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Restore
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              disabled={project.status === 'archived'}
              title={project.status === 'archived' ? 'Restore project before adding tasks' : undefined}
              onClick={() => setShowNewTask(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Task
            </button>
          </div>
        </div>

        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 tabular-nums">
              {projectTasks.filter((t) => t.status === 'done').length} of {projectTasks.length}{' '}
              tasks complete
            </span>
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {project.progress}%
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('tasks')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'tasks'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            All Tasks ({projectTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('milestones')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'milestones'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Milestones ({projectTasks.filter((t) => t.isMilestone).length})
          </button>
          <button
            type="button"
            onClick={() => setTab('activity')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'activity'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Activity ({projectLogs.length})
          </button>
        </div>

        <Link
          to={`/kanban?project=${project.id}`}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Open in Kanban Board
        </Link>
      </div>

      {/* Tab Content */}
      {tab === 'activity' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
          {projectLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No activity recorded for this project yet.
            </div>
          ) : (
            projectLogs.map((log) => (
              <div key={log.id} className="px-5 py-3.5 text-xs flex items-center justify-between gap-4">
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {log.actorName}
                  </span>{' '}
                  <span className="text-slate-500 dark:text-slate-400">
                    {log.action.replace(/_/g, ' ')}
                  </span>{' '}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {log.targetTitle}
                  </span>
                  {log.details && (
                    <span className="text-slate-500 dark:text-slate-400"> — {log.details}</span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  {formatRelativeTime(log.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {displayedTasks.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {tab === 'milestones' ? 'No milestones marked yet' : 'No tasks in this project yet'}
              </p>
              <button
                type="button"
                onClick={() => setShowNewTask(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Task
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-5">Key</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Assignee</th>
                    <th className="py-3 px-5 text-right">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {displayedTasks.map((task) => (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {task.taskKey}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          to={`/tasks/${task.id}`}
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1.5"
                        >
                          {task.isMilestone && (
                            <Flag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span>{task.title}</span>
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={task.status}
                          onChange={(e) =>
                            updateTask({
                              task,
                              projectTasks,
                              actor,
                              updates: { status: e.target.value as TaskStatus },
                            })
                          }
                          className={`bg-transparent font-medium focus:outline-none ${statusColorClasses(
                            task.status
                          )}`}
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="in_review">In Review</option>
                          <option value="done">Done</option>
                        </select>
                      </td>
                      <td className={`py-3 px-4 font-medium ${priorityColorClasses(task.priority)}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {task.assigneeName || 'Unassigned'}
                      </td>
                      <td
                        className={`py-3 px-5 text-right font-mono tabular-nums whitespace-nowrap ${
                          isOverdue(task.dueDate, task.status)
                            ? 'text-rose-600 dark:text-rose-400 font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {task.dueDate ? formatShortDate(task.dueDate) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showEdit && (
        <ProjectModal
          initial={project}
          onClose={() => setShowEdit(false)}
          onSubmit={async (data) => {
            await updateProject(project, actor, data);
          }}
        />
      )}

      {showNewTask && (
        <TaskModal
          projects={projects}
          members={members}
          defaultProjectId={project.id}
          onClose={() => setShowNewTask(false)}
          onSubmit={async (data) => {
            await createTask({
              project,
              existingProjectTasks: projectTasks,
              actor,
              input: data,
            });
          }}
        />
      )}
    </div>
  );
}
