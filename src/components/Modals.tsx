import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import {
  FIELD_LIMITS,
  PriorityLevel,
  Project,
  ProjectStatus,
  SubtaskItem,
  TaskStatus,
  Workspace,
  WorkspaceAccent,
  WorkspaceMember,
} from '../types/models';
import { deriveProjectKey, todayIsoDate } from '../lib/utils';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

function ModalShell({ title, subtitle, onClose, children }: ModalShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const ACCENTS: Array<{ id: WorkspaceAccent; label: string; swatch: string }> = [
  { id: 'indigo', label: 'Indigo', swatch: 'bg-indigo-600' },
  { id: 'emerald', label: 'Emerald', swatch: 'bg-emerald-600' },
  { id: 'amber', label: 'Amber', swatch: 'bg-amber-600' },
  { id: 'rose', label: 'Rose', swatch: 'bg-rose-600' },
  { id: 'sky', label: 'Sky', swatch: 'bg-sky-600' },
  { id: 'slate', label: 'Slate', swatch: 'bg-slate-700' },
];

export function WorkspaceModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: Workspace | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    accentColor: WorkspaceAccent;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [accentColor, setAccentColor] = useState<WorkspaceAccent>(initial?.accentColor || 'indigo');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Workspace name must be at least 2 characters.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), accentColor });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save workspace.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={initial ? 'Edit Workspace' : 'Create Workspace'}
      subtitle="Workspaces isolate projects, tasks, channels, and team members."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Workspace Name
          </label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.WORKSPACE_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Product Engineering"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            maxLength={FIELD_LIMITS.WORKSPACE_DESC_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this workspace used for?"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Workspace Color
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {ACCENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAccentColor(item.id)}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  accentColor === item.id
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-sm ${item.swatch}`} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Workspace'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function InviteMemberModal({
  workspaceName,
  onClose,
  onSubmit,
}: {
  workspaceName: string;
  onClose: () => void;
  onSubmit: (data: { email: string; role: 'admin' | 'member' }) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim().includes('@')) {
      setError('Enter a valid teammate email address.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSubmit({ email: email.trim().toLowerCase(), role });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invitation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Invite Team Member"
      subtitle={`Send an invitation to join ${workspaceName}.`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            required
            maxLength={FIELD_LIMITS.EMAIL_MAX}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            When they sign in with this verified email, the invitation appears in their inbox.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Role
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('member')}
              className={`p-3 text-left rounded-lg border transition-colors ${
                role === 'member'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">Member</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Create projects, manage tasks, and chat.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`p-3 text-left rounded-lg border transition-colors ${
                role === 'admin'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">Admin</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Invite members and manage workspace settings.
              </div>
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? 'Sending...' : 'Send Invitation'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function ProjectModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: Project | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    key: string;
    description: string;
    status: ProjectStatus;
    priority: PriorityLevel;
    startDate: string;
    deadline: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [key, setKey] = useState(initial?.key || '');
  const [keyEdited, setKeyEdited] = useState(Boolean(initial));
  const [description, setDescription] = useState(initial?.description || '');
  const [status, setStatus] = useState<ProjectStatus>(initial?.status || 'active');
  const [priority, setPriority] = useState<PriorityLevel>(initial?.priority || 'medium');
  const [startDate, setStartDate] = useState(initial?.startDate || todayIsoDate());
  const [deadline, setDeadline] = useState(initial?.deadline || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleNameChange = (val: string) => {
    setName(val);
    if (!keyEdited) {
      setKey(deriveProjectKey(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Project name must be at least 2 characters.');
      return;
    }
    const cleanKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanKey.length < 2 || cleanKey.length > 6) {
      setError('Project key must be 2–6 uppercase letters or digits.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        key: cleanKey,
        description: description.trim(),
        status,
        priority,
        startDate,
        deadline,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={initial ? 'Edit Project' : 'Create Project'}
      subtitle="Organize tasks, milestones, and team channels around a project."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.PROJECT_NAME_MAX}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Mobile App V2"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Key
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.PROJECT_KEY_MAX}
              value={key}
              disabled={Boolean(initial)}
              onChange={(e) => {
                setKeyEdited(true);
                setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              }}
              placeholder="MAV2"
              className="w-full px-3 py-2 text-sm font-mono uppercase bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            maxLength={FIELD_LIMITS.PROJECT_DESC_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Outline goals, deliverables, and scope..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          {initial ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {initial && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          )}
          <div className={initial ? '' : 'sm:col-span-2'}>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Target Deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function TaskModal({
  projects,
  members,
  defaultProjectId,
  defaultStatus = 'todo',
  onClose,
  onSubmit,
}: {
  projects: Project[];
  members: WorkspaceMember[];
  defaultProjectId?: string;
  defaultStatus?: TaskStatus;
  onClose: () => void;
  onSubmit: (data: {
    projectId: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: PriorityLevel;
    assigneeId: string;
    assigneeName: string;
    dueDate: string;
    labels: string[];
    subtasks: SubtaskItem[];
    isMilestone: boolean;
  }) => Promise<void>;
}) {
  const activeProjects = projects.filter((p) => p.status !== 'archived');
  const [projectId, setProjectId] = useState(defaultProjectId || activeProjects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [labelsInput, setLabelsInput] = useState('');
  const [subtaskText, setSubtaskText] = useState('');
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [isMilestone, setIsMilestone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addSubtask = () => {
    const clean = subtaskText.trim();
    if (!clean || subtasks.length >= FIELD_LIMITS.TASK_SUBTASKS_MAX) return;
    setSubtasks((prev) => [
      ...prev,
      { id: `st_${Date.now()}_${prev.length}`, title: clean, completed: false },
    ]);
    setSubtaskText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Please select or create a project first.');
      return;
    }
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    const assignee = members.find((m) => m.userId === assigneeId);
    const labels = labelsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, FIELD_LIMITS.TASK_LABELS_MAX);

    setError('');
    setSaving(true);
    try {
      await onSubmit({
        projectId,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId,
        assigneeName: assignee?.displayName || '',
        dueDate,
        labels,
        subtasks,
        isMilestone,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title="Create Task"
      subtitle="Add a tracked work item to your project board."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Project
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            {activeProjects.length === 0 && <option value="">No active projects</option>}
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} · {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Task Title
          </label>
          <input
            type="text"
            required
            maxLength={FIELD_LIMITS.TASK_TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Implement webhook signature verification"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            maxLength={FIELD_LIMITS.TASK_DESC_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Acceptance criteria, context, or links..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityLevel)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Assignee
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Labels (comma-separated)
          </label>
          <input
            type="text"
            value={labelsInput}
            onChange={(e) => setLabelsInput(e.target.value)}
            placeholder="backend, security, release-1.2"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Checklist Subtasks
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={subtaskText}
              onChange={(e) => setSubtaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="Add checklist item..."
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <button
              type="button"
              onClick={addSubtask}
              className="px-3 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {subtasks.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {subtasks.map((st) => (
                <li
                  key={st.id}
                  className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md"
                >
                  <span className="text-slate-700 dark:text-slate-300 truncate">{st.title}</span>
                  <button
                    type="button"
                    onClick={() => setSubtasks((prev) => prev.filter((item) => item.id !== st.id))}
                    className="text-slate-400 hover:text-rose-600 ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={isMilestone}
            onChange={(e) => setIsMilestone(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
          />
          Mark as project milestone (highlighted on Calendar)
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || activeProjects.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
