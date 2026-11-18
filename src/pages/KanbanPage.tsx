import React, { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertCircle,
  Calendar,
  Flag,
  GripVertical,
  LayoutGrid,
  Plus,
  RotateCcw,
  Rows3,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { createTask, updateTask } from '../lib/firestoreService';
import {
  formatShortDate,
  isDueWithinDays,
  isOverdue,
  PRIORITY_LABELS,
  priorityColorClasses,
  STATUS_LABELS,
  todayIsoDate,
} from '../lib/utils';
import { Avatar } from '../components/Avatar';
import { TaskModal } from '../components/Modals';
import { PriorityLevel, Task, TaskStatus, WorkspaceMember } from '../types/models';

const COLUMNS: Array<{ id: TaskStatus; label: string }> = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_review', label: 'In Review' },
  { id: 'done', label: 'Done' },
];

type DeadlineFilter = 'all' | 'overdue' | 'today' | 'week' | 'no_date' | 'before';

interface OptimisticMove {
  status: TaskStatus;
  order: number;
}

function isColumnId(id: string): id is TaskStatus {
  return id === 'todo' || id === 'in_progress' || id === 'in_review' || id === 'done';
}

function computeOrderForPosition(columnTasks: Task[], targetIndex: number): number {
  if (columnTasks.length === 0) return 10000;
  if (targetIndex <= 0) {
    const first = columnTasks[0].order;
    return first > 1000 ? first - 1000 : Math.max(0.01, first / 2);
  }
  if (targetIndex >= columnTasks.length) {
    const last = columnTasks[columnTasks.length - 1].order;
    return Math.min(9999999, last + 1000);
  }
  const prev = columnTasks[targetIndex - 1].order;
  const next = columnTasks[targetIndex].order;
  if (prev === next) return prev + 0.5;
  return (prev + next) / 2;
}

interface CardContentProps {
  task: Task;
  members: WorkspaceMember[];
  onQuickStatusChange?: (task: Task, status: TaskStatus) => void;
  isOverlay?: boolean;
}

function TaskCardBody({
  task,
  members,
  onQuickStatusChange,
  isOverlay = false,
}: CardContentProps) {
  const doneSubtasks = task.subtasks.filter((s) => s.completed).length;
  const assigneeMember = members.find((m) => m.userId === task.assigneeId);
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div
      className={`bg-white dark:bg-slate-900 border rounded-lg p-3.5 space-y-2.5 transition-colors ${
        isOverlay
          ? 'border-indigo-500 shadow-xl ring-2 ring-indigo-500/20 cursor-grabbing'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-grab active:cursor-grabbing'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
          <span
            aria-hidden="true"
            className="touch-none p-1 -ml-1 rounded text-slate-400 shrink-0"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          <span className="font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
            {task.taskKey}
          </span>
          <span aria-hidden="true">·</span>
          <span className={`whitespace-nowrap ${priorityColorClasses(task.priority)}`}>
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
        {task.isMilestone && (
          <Flag
            className="w-3.5 h-3.5 text-amber-500 shrink-0"
            aria-label="Milestone"
          />
        )}
      </div>

      <Link
        to={`/tasks/${task.id}`}
        className="block text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 leading-snug"
      >
        {task.title}
      </Link>

      {task.labels.length > 0 && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {task.labels.join(' · ')}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          {task.assigneeName ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <Avatar
                name={task.assigneeName}
                photoURL={assigneeMember?.photoURL}
                size="xs"
              />
              <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[90px]">
                {task.assigneeName.split(' ')[0]}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">Unassigned</span>
          )}
          {task.subtasks.length > 0 && (
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
              {doneSubtasks}/{task.subtasks.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {task.dueDate && (
            <span
              className={`text-[11px] font-mono tabular-nums whitespace-nowrap ${
                overdue
                  ? 'text-rose-600 dark:text-rose-400 font-medium'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {formatShortDate(task.dueDate)}
            </span>
          )}
          {onQuickStatusChange && (
            <select
              aria-label={`Change status for ${task.taskKey}`}
              value={task.status}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onChange={(e) =>
                onQuickStatusChange(task, e.target.value as TaskStatus)
              }
              className="text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-1 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {STATUS_LABELS[c.id]}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableTaskCard({
  task,
  members,
  onQuickStatusChange,
}: {
  task: Task;
  members: WorkspaceMember[];
  onQuickStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`outline-none ${isDragging ? 'opacity-35' : ''}`}
    >
      <TaskCardBody
        task={task}
        members={members}
        onQuickStatusChange={onQuickStatusChange}
      />
    </div>
  );
}

function KanbanColumn({
  column,
  tasks,
  members,
  canCreate,
  mobileLayout,
  onAddTask,
  onQuickStatusChange,
  registerRef,
}: {
  column: { id: TaskStatus; label: string };
  tasks: Task[];
  members: WorkspaceMember[];
  canCreate: boolean;
  mobileLayout: 'board' | 'stack';
  onAddTask: (status: TaskStatus) => void;
  onQuickStatusChange: (task: Task, status: TaskStatus) => void;
  registerRef: (el: HTMLDivElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', status: column.id },
  });

  const setRefs = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    registerRef(el);
  };

  return (
    <section
      ref={setRefs}
      aria-label={column.label}
      className={`rounded-xl border p-3 min-h-[420px] flex flex-col gap-3 transition-colors ${
        mobileLayout === 'board'
          ? 'w-[84vw] sm:w-[340px] md:w-auto shrink-0 snap-start'
          : 'w-full'
      } ${
        isOver
          ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-500'
          : 'bg-slate-100/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {column.label}
          </h2>
          <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
            {tasks.length}
          </span>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            aria-label={`Add task to ${column.label}`}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2.5 flex-1 min-h-[140px]">
          {tasks.length === 0 ? (
            <div className="h-full min-h-[120px] flex items-center justify-center rounded-lg border border-dashed border-slate-300/70 dark:border-slate-700/70 text-xs text-slate-400 dark:text-slate-500 px-4 text-center">
              Drop task here
            </div>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                members={members}
                onQuickStatusChange={onQuickStatusChange}
              />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}

export function KanbanPage() {
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const { activeWorkspace, projects, tasks, members, loadingWorkspaceData } = useWorkspace();

  const [projectFilter, setProjectFilter] = useState(searchParams.get('project') || 'all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | PriorityLevel>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [deadlineBeforeDate, setDeadlineBeforeDate] = useState('');
  const [search, setSearch] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileLayout, setMobileLayout] = useState<'board' | 'stack'>('board');

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [optimisticMoves, setOptimisticMoves] = useState<Record<string, OptimisticMove>>({});
  const [pendingWrites, setPendingWrites] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);

  const columnRefs = useRef<Record<TaskStatus, HTMLDivElement | null>>({
    todo: null,
    in_progress: null,
    in_review: null,
    done: null,
  });

  const actor = {
    uid: user?.uid || '',
    displayName:
      profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Merge live Firestore tasks with in-flight optimistic drag state
  const mergedTasks = useMemo(() => {
    return tasks
      .map((t) => {
        const opt = optimisticMoves[t.id];
        return opt ? { ...t, status: opt.status, order: opt.order } : t;
      })
      .sort((a, b) => a.order - b.order);
  }, [tasks, optimisticMoves]);

  const filteredTasks = useMemo(() => {
    const today = todayIsoDate();
    return mergedTasks.filter((t) => {
      if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
      if (assigneeFilter === 'me' && t.assigneeId !== user?.uid) return false;
      if (assigneeFilter === 'unassigned' && t.assigneeId !== '') return false;
      if (
        assigneeFilter !== 'all' &&
        assigneeFilter !== 'me' &&
        assigneeFilter !== 'unassigned' &&
        t.assigneeId !== assigneeFilter
      ) {
        return false;
      }
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

      if (deadlineFilter === 'overdue' && !isOverdue(t.dueDate, t.status)) return false;
      if (deadlineFilter === 'today' && t.dueDate !== today) return false;
      if (deadlineFilter === 'week' && !isDueWithinDays(t.dueDate, 7, t.status)) return false;
      if (deadlineFilter === 'no_date' && t.dueDate !== '') return false;
      if (deadlineFilter === 'before' && deadlineBeforeDate) {
        if (!t.dueDate || t.dueDate > deadlineBeforeDate) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.taskKey.toLowerCase().includes(q) ||
          t.labels.some((l) => l.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [
    mergedTasks,
    projectFilter,
    assigneeFilter,
    priorityFilter,
    deadlineFilter,
    deadlineBeforeDate,
    search,
    user?.uid,
  ]);

  const hasActiveFilters =
    projectFilter !== 'all' ||
    assigneeFilter !== 'all' ||
    priorityFilter !== 'all' ||
    deadlineFilter !== 'all' ||
    search.trim() !== '';

  const clearFilters = () => {
    setProjectFilter('all');
    setAssigneeFilter('all');
    setPriorityFilter('all');
    setDeadlineFilter('all');
    setDeadlineBeforeDate('');
    setSearch('');
  };

  const persistTaskMove = async (
    originalTask: Task,
    targetStatus: TaskStatus,
    targetOrder: number
  ) => {
    setSyncError(null);
    setOptimisticMoves((prev) => ({
      ...prev,
      [originalTask.id]: { status: targetStatus, order: targetOrder },
    }));
    setPendingWrites((n) => n + 1);

    try {
      const projectTasks = tasks.filter((t) => t.projectId === originalTask.projectId);
      await updateTask({
        task: originalTask,
        projectTasks,
        actor,
        updates: {
          status: targetStatus,
          order: targetOrder,
        },
      });
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? `Could not update ${originalTask.taskKey}: ${err.message}`
          : `Could not update ${originalTask.taskKey}.`
      );
    } finally {
      setOptimisticMoves((prev) => {
        const next = { ...prev };
        delete next[originalTask.id];
        return next;
      });
      setPendingWrites((n) => Math.max(0, n - 1));
    }
  };

  const handleQuickStatusChange = async (task: Task, targetStatus: TaskStatus) => {
    if (task.status === targetStatus) return;
    const original = tasks.find((t) => t.id === task.id) || task;
    const targetColTasks = mergedTasks.filter(
      (t) => t.status === targetStatus && t.id !== task.id
    );
    const nextOrder = computeOrderForPosition(targetColTasks, targetColTasks.length);
    await persistTaskMove(original, targetStatus, nextOrder);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeTask = mergedTasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    const overTask = mergedTasks.find((t) => t.id === overId);
    const targetStatus: TaskStatus | null = isColumnId(overId)
      ? overId
      : overTask
        ? overTask.status
        : null;

    if (!targetStatus || activeTask.status === targetStatus) return;

    const targetColTasks = mergedTasks.filter(
      (t) => t.status === targetStatus && t.id !== activeId
    );
    const overIndex = overTask
      ? targetColTasks.findIndex((t) => t.id === overTask.id)
      : targetColTasks.length;
    const insertIndex = overIndex >= 0 ? overIndex : targetColTasks.length;
    const nextOrder = computeOrderForPosition(targetColTasks, insertIndex);

    setOptimisticMoves((prev) => ({
      ...prev,
      [activeId]: { status: targetStatus, order: nextOrder },
    }));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);

    const activeId = String(active.id);
    const originalTask = tasks.find((t) => t.id === activeId);
    if (!originalTask) {
      setOptimisticMoves((prev) => {
        const next = { ...prev };
        delete next[activeId];
        return next;
      });
      return;
    }

    if (!over) {
      setOptimisticMoves((prev) => {
        const next = { ...prev };
        delete next[activeId];
        return next;
      });
      return;
    }

    const overId = String(over.id);
    const currentMerged = mergedTasks.find((t) => t.id === activeId) || originalTask;
    const overTask = mergedTasks.find((t) => t.id === overId);

    const targetStatus: TaskStatus = isColumnId(overId)
      ? overId
      : overTask
        ? overTask.status
        : currentMerged.status;

    const targetColTasks = mergedTasks.filter(
      (t) => t.status === targetStatus && t.id !== activeId
    );

    let insertIndex = targetColTasks.length;
    if (overTask && overTask.id !== activeId) {
      const idx = targetColTasks.findIndex((t) => t.id === overTask.id);
      if (idx >= 0) {
        const activeTop = active.rect.current.translated?.top ?? 0;
        const overMiddle = over.rect.top + over.rect.height / 2;
        insertIndex = activeTop > overMiddle ? idx + 1 : idx;
      }
    }

    const targetOrder = computeOrderForPosition(targetColTasks, insertIndex);
    const statusChanged = originalTask.status !== targetStatus;
    const orderChanged = Math.abs(originalTask.order - targetOrder) > 0.001;

    if (!statusChanged && !orderChanged) {
      setOptimisticMoves((prev) => {
        const next = { ...prev };
        delete next[activeId];
        return next;
      });
      return;
    }

    await persistTaskMove(originalTask, targetStatus, targetOrder);
  };

  const handleDragCancel = () => {
    if (activeTaskId) {
      setOptimisticMoves((prev) => {
        const next = { ...prev };
        delete next[activeTaskId];
        return next;
      });
    }
    setActiveTaskId(null);
  };

  const activeDragTask = activeTaskId
    ? mergedTasks.find((t) => t.id === activeTaskId) || null
    : null;

  const canCreate = projects.some((p) => p.status !== 'archived');

  if (!activeWorkspace) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Select or create a workspace to view the Kanban board.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Kanban Board
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {pendingWrites > 0
              ? 'Saving change to Firestore...'
              : `${filteredTasks.length} of ${tasks.length} tasks · Live workspace sync`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => setCreateStatus('todo')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          )}
        </div>
      </div>

      {syncError && (
        <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{syncError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncError(null)}
            className="text-xs font-medium underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters Toolbar (Always visible on desktop, toggleable on mobile) */}
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-3 ${
          mobileFiltersOpen ? 'block' : 'hidden md:block'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search key, title, or label..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <select
            aria-label="Filter by project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} · {p.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by assignee"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="px-2.5 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Assignees</option>
            <option value="me">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'all' | PriorityLevel)}
            className="px-2.5 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              aria-label="Filter by deadline"
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilter)}
              className="px-2.5 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
            >
              <option value="all">All Deadlines</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="week">Due Within 7 Days</option>
              <option value="before">On or Before Date</option>
              <option value="no_date">No Deadline</option>
            </select>
            {deadlineFilter === 'before' && (
              <input
                type="date"
                aria-label="Target deadline date"
                value={deadlineBeforeDate}
                onChange={(e) => setDeadlineBeforeDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
              />
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Mobile Column Quick-Jump & Layout Switcher */}
      <div className="flex md:hidden items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {COLUMNS.map((c) => {
            const count = filteredTasks.filter((t) => t.status === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  columnRefs.current[c.id]?.scrollIntoView({
                    behavior: 'smooth',
                    inline: 'start',
                    block: 'nearest',
                  });
                }}
                className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0 tabular-nums"
              >
                {c.label} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setMobileLayout('board')}
            aria-label="Horizontal board view"
            className={`p-1.5 rounded ${
              mobileLayout === 'board'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMobileLayout('stack')}
            aria-label="Stacked list view"
            className={`p-1.5 rounded ${
              mobileLayout === 'stack'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-500'
            }`}
          >
            <Rows3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4-Column Drag-and-Drop Board */}
      {loadingWorkspaceData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((c) => (
            <div
              key={c.id}
              className="h-96 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div
            className={
              mobileLayout === 'board'
                ? 'flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory md:grid md:grid-cols-2 xl:grid-cols-4 md:overflow-visible md:pb-0 items-start'
                : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start'
            }
          >
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  tasks={colTasks}
                  members={members}
                  canCreate={canCreate}
                  mobileLayout={mobileLayout}
                  onAddTask={(st) => setCreateStatus(st)}
                  onQuickStatusChange={handleQuickStatusChange}
                  registerRef={(el) => {
                    columnRefs.current[col.id] = el;
                  }}
                />
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDragTask ? (
              <div className="w-[290px] sm:w-[310px]">
                <TaskCardBody
                  task={activeDragTask}
                  members={members}
                  isOverlay
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {createStatus && (
        <TaskModal
          projects={projects}
          members={members}
          defaultProjectId={projectFilter !== 'all' ? projectFilter : undefined}
          defaultStatus={createStatus}
          onClose={() => setCreateStatus(null)}
          onSubmit={async (data) => {
            const proj = projects.find((p) => p.id === data.projectId);
            if (!proj) return;
            const projTasks = tasks.filter((t) => t.projectId === proj.id);
            await createTask({
              project: proj,
              existingProjectTasks: projTasks,
              actor,
              input: data,
            });
          }}
        />
      )}
    </div>
  );
}
