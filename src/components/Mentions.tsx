import React, { useMemo, useState } from 'react';
import {
  getMentionQueryAtCursor,
  insertMentionAtCursor,
  MentionQueryMatch,
  splitMentionSegments,
} from '../lib/utils';
import { WorkspaceMember } from '../types/models';
import { Avatar } from './Avatar';

export function MentionText({
  text,
  members,
  currentUserId,
}: {
  text: string;
  members: WorkspaceMember[];
  currentUserId?: string;
}) {
  const segments = useMemo(
    () => splitMentionSegments(text, members),
    [text, members]
  );

  return (
    <>
      {segments.map((seg, idx) => {
        if (!seg.isMention) {
          return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
        }
        const isSelf = Boolean(currentUserId && seg.member?.userId === currentUserId);
        return (
          <span
            key={idx}
            className={`font-medium rounded px-1 py-0.5 ${
              isSelf
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
            }`}
          >
            {seg.text}
          </span>
        );
      })}
    </>
  );
}

export function useMentionAutocomplete(
  text: string,
  setText: (next: string) => void,
  members: WorkspaceMember[],
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
) {
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const match: MentionQueryMatch | null = useMemo(() => {
    const m = getMentionQueryAtCursor(text, cursorPos);
    if (!m || dismissedAt === m.start) return null;
    return m;
  }, [text, cursorPos, dismissedAt]);

  const suggestions = useMemo(() => {
    if (!match) return [];
    const q = match.query;
    return members
      .filter((m) => {
        if (!q) return true;
        return (
          m.displayName.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().replace(/\s+/g, '').includes(q)
        );
      })
      .slice(0, 6);
  }, [match, members]);

  const isOpen = Boolean(match && suggestions.length > 0);
  const safeIndex =
    suggestions.length > 0 ? Math.min(selectedIndex, suggestions.length - 1) : 0;

  const syncCursor = (el: HTMLInputElement | HTMLTextAreaElement) => {
    setCursorPos(el.selectionStart ?? el.value.length);
    setDismissedAt(null);
    setSelectedIndex(0);
  };

  const applySuggestion = (member: WorkspaceMember) => {
    if (!match) return;
    const { nextText, nextCursor } = insertMentionAtCursor(
      text,
      match,
      member.displayName
    );
    setText(nextText);
    setDismissedAt(null);
    setSelectedIndex(0);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(nextCursor, nextCursor);
        setCursorPos(nextCursor);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent): boolean => {
    if (!isOpen) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((idx) => (idx + 1) % suggestions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((idx) => (idx - 1 + suggestions.length) % suggestions.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const target = suggestions[safeIndex];
      if (target) applySuggestion(target);
      return true;
    }
    if (e.key === 'Escape' && match) {
      e.preventDefault();
      setDismissedAt(match.start);
      return true;
    }
    return false;
  };

  return {
    isOpen,
    suggestions,
    selectedIndex: safeIndex,
    syncCursor,
    applySuggestion,
    handleKeyDown,
  };
}

export function MentionDropdown({
  isOpen,
  suggestions,
  selectedIndex,
  onSelect,
  placement = 'top',
}: {
  isOpen: boolean;
  suggestions: WorkspaceMember[];
  selectedIndex: number;
  onSelect: (member: WorkspaceMember) => void;
  placement?: 'top' | 'bottom';
}) {
  if (!isOpen || suggestions.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Mention teammate"
      className={`absolute left-0 right-0 sm:w-72 z-30 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1 overflow-hidden ${
        placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-1.5'
      }`}
    >
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Mention Teammate
      </div>
      {suggestions.map((m, idx) => (
        <button
          key={m.userId}
          type="button"
          role="option"
          aria-selected={idx === selectedIndex}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(m);
          }}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
            idx === selectedIndex
              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <Avatar name={m.displayName} photoURL={m.photoURL} size="xs" />
            <span className="font-medium truncate">{m.displayName}</span>
          </span>
          <span className="text-[10px] text-slate-400 capitalize shrink-0">{m.role}</span>
        </button>
      ))}
    </div>
  );
}
