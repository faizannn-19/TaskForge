import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Edit3,
  Flag,
  Plus,
  Send,
  Square,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  addComment,
  deleteComment,
  deleteTask,
  updateComment,
  updateTask,
} from '../lib/firestoreService';
import {
  extractMentions,
  formatRelativeTime,
} from '../lib/utils';
import { Avatar } from '../components/Avatar';
import {
  MentionDropdown,
  MentionText,
  useMentionAutocomplete,
} from '../components/Mentions';
import {
  Comment,
  FIELD_LIMITS,
  PriorityLevel,
  SubtaskItem,
  TaskStatus,
} from '../types/models';

export function TaskDetailsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { tasks, projects, members, myRole } = useWorkspace();

  const task = tasks.find((t) => t.id === taskId);
  const project = projects.find((p) => p.id === task?.projectId);
  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === task?.projectId),
    [tasks, task?.projectId]
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [savingDetails, setSavingDetails] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [savingCommentEdit, setSavingCommentEdit] = useState(false);

  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const commentMention = useMentionAutocomplete(
    commentText,
    setCommentText,
    members,
    commentInputRef
  );

  const actor = {
    uid: user?.uid || '',
    displayName: profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  };

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
    }
  }, [task?.id, task?.title, task?.description]);

  useEffect(() => {
    if (!taskId || !task) {
      setComments([]);
      return;
    }
    const q = query(
      collection(db, 'comments'),
      where('workspaceId', '==', task.workspaceId),
      where('taskId', '==', taskId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Comment)
          .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0));
        setComments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'comments')
    );
    return () => unsub();
  }, [taskId, task?.workspaceId]);

  if (!task) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">Task not found.</p>
        <Link
          to="/kanban"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Board
        </Link>
      </div>
    );
  }

  const canFullEdit =
    myRole === 'owner' ||
    myRole === 'admin' ||
    task.reporterId === user?.uid ||
    task.assigneeId === user?.uid;

  const canDelete =
    myRole === 'owner' || myRole === 'admin' || task.reporterId === user?.uid;

  const saveTextFields = async () => {
    if (!canFullEdit || !title.trim()) return;
    setSavingDetails(true);
    try {
      await updateTask({
        task,
        projectTasks,
        actor,
        updates: { title: title.trim(), description: description.trim() },
      });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleToggleSubtask = async (subId: string) => {
    const next: SubtaskItem[] = task.subtasks.map((s) =>
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    await updateTask({ task, projectTasks, actor, updates: { subtasks: next } });
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSubtask.trim();
    if (!clean || task.subtasks.length >= FIELD_LIMITS.TASK_SUBTASKS_MAX) return;
    const next: SubtaskItem[] = [
      ...task.subtasks,
      { id: `st_${Date.now()}`, title: clean, completed: false },
    ];
    setNewSubtask('');
    await updateTask({ task, projectTasks, actor, updates: { subtasks: next } });
  };

  const handleRemoveSubtask = async (subId: string) => {
    const next = task.subtasks.filter((s) => s.id !== subId);
    await updateTask({ task, projectTasks, actor, updates: { subtasks: next } });
  };

  const handleAddLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newLabel.trim();
    if (!clean || task.labels.includes(clean) || task.labels.length >= FIELD_LIMITS.TASK_LABELS_MAX)
      return;
    setNewLabel('');
    await updateTask({
      task,
      projectTasks,
      actor,
      updates: { labels: [...task.labels, clean] },
    });
  };

  const handleRemoveLabel = async (label: string) => {
    await updateTask({
      task,
      projectTasks,
      actor,
      updates: { labels: task.labels.filter((l) => l !== label) },
    });
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPostingComment(true);
    setCommentError('');
    try {
      const mentions = extractMentions(commentText, members);
      await addComment({
        task,
        actor,
        content: commentText,
        mentions,
      });
      setCommentText('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setPostingComment(false);
    }
  };

  const handleSaveCommentEdit = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    setSavingCommentEdit(true);
    setCommentError('');
    try {
      const mentions = extractMentions(editingCommentText, members);
      await updateComment(commentId, editingCommentText, mentions);
      setEditingCommentId(null);
      setEditingCommentText('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to update comment.');
    } finally {
      setSavingCommentEdit(false);
    }
  };

  const doneCount = task.subtasks.filter((s) => s.completed).length;
  const subPct =
    task.subtasks.length > 0 ? Math.round((doneCount / task.subtasks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Link to="/kanban" className="hover:text-slate-900 dark:hover:text-slate-100 inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Kanban
          </Link>
          {project && (
            <>
              <span>/</span>
              <Link to={`/projects/${project.id}`} className="hover:text-slate-900 dark:hover:text-slate-100">
                {project.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
            {task.taskKey}
          </span>
        </div>

        {canDelete && (
          <button
            type="button"
            onClick={async () => {
              await deleteTask(task, projectTasks);
              navigate('/kanban');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Task
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Title, Description, Subtasks, Comments */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <input
              type="text"
              value={title}
              disabled={!canFullEdit}
              maxLength={FIELD_LIMITS.TASK_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xl font-semibold bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none border-b border-transparent focus:border-indigo-500 pb-1"
            />
            <textarea
              rows={4}
              value={description}
              disabled={!canFullEdit}
              maxLength={FIELD_LIMITS.TASK_DESC_MAX}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add acceptance criteria, technical notes, or links..."
              className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            {canFullEdit && (title !== task.title || description !== task.description) && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={savingDetails}
                  onClick={saveTextFields}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  {savingDetails ? 'Saving...' : 'Save Description'}
                </button>
              </div>
            )}
          </section>

          {/* Subtasks / Checklists */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Subtasks & Checklist
              </h2>
              <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {doneCount}/{task.subtasks.length} ({subPct}%)
              </span>
            </div>

            {task.subtasks.length > 0 && (
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${subPct}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {task.subtasks.map((st) => (
                <div
                  key={st.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(st.id)}
                    className="flex items-center gap-2.5 text-left text-xs flex-1 min-w-0"
                  >
                    {st.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span
                      className={
                        st.completed
                          ? 'line-through text-slate-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }
                    >
                      {st.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(st.id)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <input
                type="text"
                value={newSubtask}
                maxLength={FIELD_LIMITS.SUBTASK_TITLE_MAX}
                onChange={(e) => setNewSubtask(e.target.value)}
                placeholder="Add checklist step..."
                className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </form>
          </section>

          {/* Comments & @Mentions */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Discussion ({comments.length})
            </h2>

            {commentError && (
              <div className="px-3 py-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg">
                {commentError}
              </div>
            )}

            {comments.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No comments yet. Type @ to mention a teammate and notify them in real time.
              </p>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => {
                  const isAuthor = c.authorId === user?.uid;
                  const canDeleteComment =
                    isAuthor || myRole === 'owner' || myRole === 'admin';
                  const mentionsMe = Boolean(user?.uid && c.mentions.includes(user.uid));
                  const isEdited =
                    Boolean(c.createdAt && c.updatedAt) &&
                    c.updatedAt!.toMillis() - c.createdAt!.toMillis() > 1500;
                  const isEditing = editingCommentId === c.id;

                  return (
                    <div
                      key={c.id}
                      className={`flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0 rounded-lg ${
                        mentionsMe ? 'bg-amber-50/60 dark:bg-amber-950/20 p-2 -mx-2' : ''
                      }`}
                    >
                      <Avatar name={c.authorName} photoURL={c.authorPhotoURL} size="sm" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {c.authorName}
                            </span>
                            <span className="text-slate-400 tabular-nums">
                              {formatRelativeTime(c.createdAt)}
                            </span>
                            {isEdited && (
                              <span className="text-[11px] text-slate-400">(edited)</span>
                            )}
                          </div>
                          {!isEditing && (isAuthor || canDeleteComment) && (
                            <div className="flex items-center gap-1.5">
                              {isAuthor && (
                                <button
                                  type="button"
                                  aria-label="Edit comment"
                                  onClick={() => {
                                    setEditingCommentId(c.id);
                                    setEditingCommentText(c.content);
                                    setCommentError('');
                                  }}
                                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDeleteComment && (
                                <button
                                  type="button"
                                  aria-label="Delete comment"
                                  onClick={() => deleteComment(c.id)}
                                  className="text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              rows={2}
                              value={editingCommentText}
                              maxLength={FIELD_LIMITS.COMMENT_MAX}
                              autoFocus
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-indigo-400 dark:border-indigo-700 rounded-lg focus:outline-none"
                            />
                            <div className="flex items-center gap-2 text-xs">
                              <button
                                type="button"
                                disabled={savingCommentEdit || !editingCommentText.trim()}
                                onClick={() => handleSaveCommentEdit(c.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded"
                              >
                                <Check className="w-3 h-3" />
                                {savingCommentEdit ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                            <MentionText
                              text={c.content}
                              members={members}
                              currentUserId={user?.uid}
                            />
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={handlePostComment} className="space-y-2 pt-2 relative">
              <MentionDropdown
                isOpen={commentMention.isOpen}
                suggestions={commentMention.suggestions}
                selectedIndex={commentMention.selectedIndex}
                onSelect={commentMention.applySuggestion}
                placement="top"
              />
              <textarea
                ref={commentInputRef}
                rows={2}
                value={commentText}
                maxLength={FIELD_LIMITS.COMMENT_MAX}
                onChange={(e) => {
                  setCommentText(e.target.value);
                  commentMention.syncCursor(e.target);
                }}
                onClick={(e) => commentMention.syncCursor(e.currentTarget)}
                onKeyUp={(e) => {
                  if (
                    e.key !== 'ArrowUp' &&
                    e.key !== 'ArrowDown' &&
                    e.key !== 'Enter' &&
                    e.key !== 'Tab' &&
                    e.key !== 'Escape'
                  ) {
                    commentMention.syncCursor(e.currentTarget);
                  }
                }}
                onKeyDown={(e) => {
                  commentMention.handleKeyDown(e);
                }}
                placeholder="Write a comment... Type @ to mention a teammate"
                className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-500">
                  <span>Mention:</span>
                  {members.slice(0, 5).map((m) => (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => {
                        setCommentText((prev) => {
                          const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
                          return `${prev}${spacer}@${m.displayName} `;
                        });
                        requestAnimationFrame(() => commentInputRef.current?.focus());
                      }}
                      className="hover:text-indigo-600 dark:hover:text-indigo-400 whitespace-nowrap"
                    >
                      @{m.displayName}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={postingComment || !commentText.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  {postingComment ? 'Posting...' : 'Comment'}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Col: Properties Sidebar */}
        <div className="space-y-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Task Properties
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
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
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={task.priority}
                disabled={!canFullEdit}
                onChange={(e) =>
                  updateTask({
                    task,
                    projectTasks,
                    actor,
                    updates: { priority: e.target.value as PriorityLevel },
                  })
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-60"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Assignee
              </label>
              <select
                value={task.assigneeId}
                disabled={!canFullEdit}
                onChange={(e) => {
                  const m = members.find((item) => item.userId === e.target.value);
                  updateTask({
                    task,
                    projectTasks,
                    actor,
                    updates: {
                      assigneeId: e.target.value,
                      assigneeName: m?.displayName || '',
                    },
                  });
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-60"
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
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={task.dueDate}
                disabled={!canFullEdit}
                onChange={(e) =>
                  updateTask({
                    task,
                    projectTasks,
                    actor,
                    updates: { dueDate: e.target.value },
                  })
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-60"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={task.isMilestone}
                disabled={!canFullEdit}
                onChange={(e) =>
                  updateTask({
                    task,
                    projectTasks,
                    actor,
                    updates: { isMilestone: e.target.checked },
                  })
                }
                className="rounded border-slate-300 dark:border-slate-700 text-indigo-600"
              />
              <Flag className="w-3.5 h-3.5 text-amber-500" />
              Milestone deliverable
            </label>

            {/* Labels */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Labels
              </div>
              {task.labels.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {task.labels.map((lbl) => (
                    <span
                      key={lbl}
                      className="inline-flex items-center gap-1 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md"
                    >
                      {lbl}
                      {canFullEdit && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLabel(lbl)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {canFullEdit && (
                <form onSubmit={handleAddLabel} className="flex gap-1.5">
                  <input
                    type="text"
                    value={newLabel}
                    maxLength={40}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Add label..."
                    className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div>Reporter: {task.reporterName}</div>
              <div className="tabular-nums">Created {formatRelativeTime(task.createdAt)}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
