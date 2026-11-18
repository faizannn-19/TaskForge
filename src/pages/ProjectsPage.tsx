import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Edit3, FolderKanban, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { createProject, deleteProject, updateProject } from '../lib/firestoreService';
import {
  formatShortDate,
  PRIORITY_LABELS,
  priorityColorClasses,
  PROJECT_STATUS_LABELS,
} from '../lib/utils';
import { ProjectModal } from '../components/Modals';
import { PriorityLevel, Project, ProjectStatus } from '../types/models';

export function ProjectsPage() {
  const { user, profile } = useAuth();
  const { activeWorkspace, myRole, projects, tasks, loadingWorkspaceData } = useWorkspace();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | PriorityLevel>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const actor = {
    uid: user?.uid || '',
    displayName: profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  };

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.key.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, statusFilter, priorityFilter, search]);

  const canModifyProject = (proj: Project) =>
    myRole === 'owner' || myRole === 'admin' || proj.ownerId === user?.uid;

  if (!activeWorkspace) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Select or create a workspace to manage projects.
        </p>
        <Link
          to="/workspaces"
          className="inline-flex items-center px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
        >
          Go to Workspaces
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Projects
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Track deliverables, owners, deadlines, and real-time completion across{' '}
            {activeWorkspace.name}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name or key..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
            {(['all', 'active', 'on_hold', 'completed', 'archived'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {st === 'all' ? 'All' : PROJECT_STATUS_LABELS[st]}
              </button>
            ))}
          </div>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'all' | PriorityLevel)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {loadingWorkspaceData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
          <FolderKanban className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {projects.length === 0 ? 'No projects created yet' : 'No projects match your filters'}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {projects.length === 0
              ? 'Create your first project to organize tasks, deadlines, and Kanban workflows.'
              : 'Try adjusting your search query or status filter.'}
          </p>
          {projects.length === 0 && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Create First Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((proj) => {
            const pTasks = tasks.filter((t) => t.projectId === proj.id);
            const doneCount = pTasks.filter((t) => t.status === 'done').length;
            const editable = canModifyProject(proj);

            return (
              <div
                key={proj.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/projects/${proj.id}`}
                      className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1"
                    >
                      {proj.name}
                    </Link>
                    {editable && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditing(proj)}
                          title="Edit project"
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {proj.status !== 'archived' && (
                          <button
                            type="button"
                            onClick={() =>
                              updateProject(proj, actor, { status: 'archived' })
                            }
                            title="Archive project"
                            className="p-1.5 text-slate-400 hover:text-amber-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteProject(proj)}
                          title="Delete project"
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {proj.key}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{PROJECT_STATUS_LABELS[proj.status]}</span>
                    <span aria-hidden="true">·</span>
                    <span className={priorityColorClasses(proj.priority)}>
                      {PRIORITY_LABELS[proj.priority]}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[2rem]">
                    {proj.description || 'No project description provided.'}
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {doneCount}/{pTasks.length} tasks complete
                      </span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {proj.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Owner: {proj.ownerName}</span>
                    <span className="font-mono tabular-nums">
                      {proj.deadline ? `Due ${formatShortDate(proj.deadline)}` : 'No deadline'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <ProjectModal
          onClose={() => setShowCreate(false)}
          onSubmit={async (data) => {
            await createProject(activeWorkspace.id, actor, data);
          }}
        />
      )}

      {editing && (
        <ProjectModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            await updateProject(editing, actor, data);
          }}
        />
      )}
    </div>
  );
}
