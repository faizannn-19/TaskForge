import { Timestamp } from 'firebase/firestore';
import {
  FIELD_LIMITS,
  PriorityLevel,
  ProjectStatus,
  TaskStatus,
  WorkspaceMember,
} from '../types/models';

export function clampString(value: string, max: number): string {
  return value.trim().slice(0, max);
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, FIELD_LIMITS.WORKSPACE_SLUG_MAX);
  return base.length >= 2 ? base : `ws-${Math.random().toString(36).slice(2, 7)}`;
}

export function deriveProjectKey(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 4)
      .map((w) => w[0])
      .join('')
      .slice(0, 6);
  }
  const single = (words[0] || 'PRJ').replace(/[^A-Z0-9]/g, '');
  return (single.slice(0, 4) || 'PRJ').padEnd(2, 'X');
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatRelativeTime(ts: Timestamp | null | undefined): string {
  if (!ts) return 'Just now';
  const date = ts.toDate();
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate) return 'No date';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isOverdue(dueDate: string, status: TaskStatus): boolean {
  if (!dueDate || status === 'done') return false;
  return dueDate < todayIsoDate();
}

export function isDueSoon(dueDate: string, status: TaskStatus): boolean {
  if (!dueDate || status === 'done') return false;
  const today = todayIsoDate();
  if (dueDate < today) return false;
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 3;
}

export function isDueWithinDays(dueDate: string, days: number, status: TaskStatus): boolean {
  if (!dueDate || status === 'done') return false;
  const today = todayIsoDate();
  if (dueDate < today) return false;
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date(today + 'T00:00:00');
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

export function extractMentions(text: string, members: WorkspaceMember[]): string[] {
  const lower = text.toLowerCase();
  const mentionedUids = new Set<string>();
  for (const member of members) {
    const display = member.displayName.toLowerCase();
    const handle = display.replace(/\s+/g, '');
    const first = display.split(/\s+/)[0];
    const escapedDisplay = display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedHandle = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedFirst = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (
      (display && new RegExp(`(^|[\\s(])@${escapedDisplay}(?=$|[\\s.,!?:;)])`, 'i').test(lower)) ||
      (handle && new RegExp(`(^|[\\s(])@${escapedHandle}(?=$|[\\s.,!?:;)])`, 'i').test(lower)) ||
      (first && first.length >= 2 && new RegExp(`(^|[\\s(])@${escapedFirst}(?=$|[\\s.,!?:;)])`, 'i').test(lower))
    ) {
      mentionedUids.add(member.userId);
    }
    if (mentionedUids.size >= FIELD_LIMITS.MENTIONS_MAX) break;
  }
  return Array.from(mentionedUids);
}

export interface MentionQueryMatch {
  start: number;
  end: number;
  query: string;
}

export function getMentionQueryAtCursor(
  text: string,
  cursorPos: number
): MentionQueryMatch | null {
  const before = text.slice(0, cursorPos);
  const match = before.match(/(?:^|[\s(])@([^\s@\n]*)$/);
  if (!match) return null;
  const query = match[1];
  const atIndex = before.lastIndexOf('@' + query);
  if (atIndex === -1) return null;
  return {
    start: atIndex,
    end: cursorPos,
    query: query.toLowerCase(),
  };
}

export function insertMentionAtCursor(
  text: string,
  match: MentionQueryMatch,
  displayName: string
): { nextText: string; nextCursor: number } {
  const prefix = text.slice(0, match.start);
  const suffix = text.slice(match.end);
  const insertion = `@${displayName} `;
  const trimmedSuffix = suffix.startsWith(' ') ? suffix.slice(1) : suffix;
  return {
    nextText: `${prefix}${insertion}${trimmedSuffix}`,
    nextCursor: prefix.length + insertion.length,
  };
}

export interface TextMentionSegment {
  text: string;
  isMention: boolean;
  member?: WorkspaceMember;
}

export function splitMentionSegments(
  text: string,
  members: WorkspaceMember[]
): TextMentionSegment[] {
  if (!text) return [];
  if (members.length === 0) return [{ text, isMention: false }];

  // Build ordered tokens matching full displayName, compact handle, or first name
  const candidates: Array<{ token: string; member: WorkspaceMember }> = [];
  for (const m of members) {
    const clean = m.displayName.trim();
    if (!clean) continue;
    candidates.push({ token: clean, member: m });
    const handle = clean.replace(/\s+/g, '');
    if (handle && handle.toLowerCase() !== clean.toLowerCase()) {
      candidates.push({ token: handle, member: m });
    }
    const first = clean.split(/\s+/)[0];
    if (first && first.length >= 2 && first.toLowerCase() !== clean.toLowerCase()) {
      candidates.push({ token: first, member: m });
    }
  }
  candidates.sort((a, b) => b.token.length - a.token.length);

  if (candidates.length === 0) return [{ text, isMention: false }];

  const escaped = candidates.map((c) =>
    c.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(^|[\\s(])(@(?:${escaped.join('|')}))(?=$|[\\s.,!?:;)])`, 'gi');

  const segments: TextMentionSegment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    const leading = m[1] || '';
    const mentionStr = m[2];
    const mentionStart = m.index + leading.length;

    if (mentionStart > lastIndex) {
      segments.push({ text: text.slice(lastIndex, mentionStart), isMention: false });
    }

    const bare = mentionStr.slice(1).toLowerCase();
    const matched = candidates.find((c) => c.token.toLowerCase() === bare)?.member;
    segments.push({ text: mentionStr, isMention: true, member: matched });
    lastIndex = mentionStart + mentionStr.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), isMention: false });
  }

  return segments;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export function priorityColorClasses(priority: PriorityLevel): string {
  switch (priority) {
    case 'urgent':
      return 'text-rose-600 dark:text-rose-400';
    case 'high':
      return 'text-amber-600 dark:text-amber-400';
    case 'medium':
      return 'text-indigo-600 dark:text-indigo-400';
    case 'low':
    default:
      return 'text-slate-500 dark:text-slate-400';
  }
}

export function statusColorClasses(status: TaskStatus): string {
  switch (status) {
    case 'done':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'in_review':
      return 'text-amber-600 dark:text-amber-400';
    case 'in_progress':
      return 'text-indigo-600 dark:text-indigo-400';
    case 'todo':
    default:
      return 'text-slate-600 dark:text-slate-400';
  }
}

export function exportTasksToCsv(
  tasks: Array<{
    taskKey: string;
    title: string;
    status: TaskStatus;
    priority: PriorityLevel;
    assigneeName: string;
    dueDate: string;
    isMilestone: boolean;
  }>,
  filename = 'taskforge-report.csv'
): void {
  const header = ['Key', 'Title', 'Status', 'Priority', 'Assignee', 'Due Date', 'Milestone'];
  const rows = tasks.map((t) => [
    t.taskKey,
    `"${t.title.replace(/"/g, '""')}"`,
    STATUS_LABELS[t.status],
    PRIORITY_LABELS[t.priority],
    `"${(t.assigneeName || 'Unassigned').replace(/"/g, '""')}"`,
    t.dueDate || '',
    t.isMilestone ? 'Yes' : 'No',
  ]);
  const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
