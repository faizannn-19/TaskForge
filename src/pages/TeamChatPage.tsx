import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  Check,
  CheckCheck,
  Edit3,
  Hash,
  MessageSquare,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import {
  deleteMessage,
  markChannelRead,
  markChannelsRead,
  sendMessage,
  updateMessage,
} from '../lib/firestoreService';
import { extractMentions, formatRelativeTime } from '../lib/utils';
import { Avatar } from '../components/Avatar';
import {
  MentionDropdown,
  MentionText,
  useMentionAutocomplete,
} from '../components/Mentions';
import { FIELD_LIMITS } from '../types/models';

type MobilePane = 'channels' | 'chat' | 'activity';
type RightPanelMode = 'activity' | 'members';
type ActivityFilter = 'all' | 'channel' | 'tasks' | 'comments';

export function TeamChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const {
    activeWorkspace,
    projects,
    messages,
    members,
    activityLogs,
    myRole,
    channelReads,
    unreadMessagesByChannel,
    totalUnreadMessages,
    loadingWorkspaceData,
  } = useWorkspace();

  const channels = useMemo(() => {
    const base = [
      {
        id: 'general',
        name: 'general',
        description: 'Workspace-wide team channel',
        projectId: '',
        archived: false,
      },
    ];
    const projChannels = projects
      .filter((p) => p.status !== 'archived' || messages.some((m) => m.channelId === p.id))
      .map((p) => ({
        id: p.id,
        name: p.key.toLowerCase(),
        description: p.name,
        projectId: p.id,
        archived: p.status === 'archived',
      }));
    return [...base, ...projChannels];
  }, [projects, messages]);

  const activeChannelId = searchParams.get('channel') || 'general';
  const activeChannel =
    channels.find((c) => c.id === activeChannelId) || channels[0];

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [mobilePane, setMobilePane] = useState<MobilePane>('chat');
  const [rightPanel, setRightPanel] = useState<RightPanelMode>('activity');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMarkedRef = useRef<string>('');

  const mention = useMentionAutocomplete(text, setText, members, inputRef);

  const actor = {
    uid: user?.uid || '',
    displayName:
      profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User',
    email: user?.email || '',
    photoURL: profile?.photoURL || user?.photoURL || '',
  };

  const channelMessages = useMemo(
    () => messages.filter((m) => m.channelId === activeChannel.id),
    [messages, activeChannel.id]
  );

  // Latest message timestamp in current channel from other users
  const latestOtherMsgMs = useMemo(() => {
    let maxMs = 0;
    for (const m of channelMessages) {
      if (m.authorId !== user?.uid && m.createdAt) {
        const ms = m.createdAt.toMillis();
        if (ms > maxMs) maxMs = ms;
      }
    }
    return maxMs;
  }, [channelMessages, user?.uid]);

  // Persist read cursor when opening a channel or receiving new messages in the open channel
  useEffect(() => {
    if (!user || !activeWorkspace || !activeChannel) return;
    if (mobilePane === 'channels') return;

    const unreadCount = unreadMessagesByChannel[activeChannel.id] || 0;
    const hasReadDoc = channelReads.some(
      (r) => r.workspaceId === activeWorkspace.id && r.channelId === activeChannel.id
    );

    if (unreadCount === 0 && hasReadDoc) return;
    if (unreadCount === 0 && latestOtherMsgMs === 0 && hasReadDoc) return;

    const markKey = `${activeWorkspace.id}_${activeChannel.id}_${latestOtherMsgMs}_${unreadCount}`;
    if (lastMarkedRef.current === markKey) return;
    lastMarkedRef.current = markKey;

    void markChannelRead(user.uid, activeWorkspace.id, activeChannel.id).catch(() => {
      lastMarkedRef.current = '';
    });
  }, [
    user,
    activeWorkspace,
    activeChannel,
    unreadMessagesByChannel,
    channelReads,
    latestOtherMsgMs,
    mobilePane,
  ]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length, activeChannel.id]);

  const filteredActivity = useMemo(() => {
    return activityLogs
      .filter((log) => {
        if (activityFilter === 'channel' && activeChannel.projectId) {
          return log.projectId === activeChannel.projectId;
        }
        if (activityFilter === 'tasks') {
          return log.action.includes('task');
        }
        if (activityFilter === 'comments') {
          return log.action === 'commented';
        }
        return true;
      })
      .slice(0, 40);
  }, [activityLogs, activityFilter, activeChannel.projectId]);

  const handleSelectChannel = (channelId: string) => {
    setSearchParams({ channel: channelId });
    setEditingMessageId(null);
    setErrorMsg('');
    setMobilePane('chat');
  };

  const handleMarkAllChannelsRead = async () => {
    if (!user || !activeWorkspace) return;
    setErrorMsg('');
    try {
      await markChannelsRead(
        user.uid,
        activeWorkspace.id,
        channels.map((c) => c.id)
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to mark channels as read.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !text.trim()) return;
    setErrorMsg('');
    setSending(true);
    try {
      const mentions = extractMentions(text, members);
      await sendMessage({
        workspaceId: activeWorkspace.id,
        channelId: activeChannel.id,
        channelName: activeChannel.name,
        actor,
        content: text,
        mentions,
      });
      setText('');
      if (user) {
        void markChannelRead(user.uid, activeWorkspace.id, activeChannel.id);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleStartEdit = (messageId: string, currentContent: string) => {
    setEditingMessageId(messageId);
    setEditingText(currentContent);
    setErrorMsg('');
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editingText.trim()) return;
    setSavingEdit(true);
    setErrorMsg('');
    try {
      const mentions = extractMentions(editingText, members);
      await updateMessage(messageId, editingText, mentions);
      setEditingMessageId(null);
      setEditingText('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update message.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    setErrorMsg('');
    try {
      await deleteMessage(messageId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete message.');
    }
  };

  const handleInsertMemberMention = (displayName: string) => {
    const addition = `@${displayName} `;
    setText((prev) => {
      const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
      return `${prev}${spacer}${addition}`;
    });
    setMobilePane('chat');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  if (!activeWorkspace) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Select or create a workspace to open Team Collaboration.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile Pane Switcher */}
      <div className="flex md:hidden items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
        <button
          type="button"
          onClick={() => setMobilePane('channels')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mobilePane === 'channels'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          Channels
          {totalUnreadMessages > 0 && (
            <span className="font-mono tabular-nums text-[10px] px-1 py-0.5 rounded bg-white/20">
              {totalUnreadMessages}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mobilePane === 'chat'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="truncate">#{activeChannel.name}</span>
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('activity')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mobilePane === 'activity'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Activity
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px] h-[calc(100vh-11.5rem)]">
        {/* Left Sidebar: Project & Team Channels + Teammates */}
        <aside
          className={`${
            mobilePane === 'channels' ? 'flex' : 'hidden md:flex'
          } md:col-span-3 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-4 flex-col justify-between gap-4 overflow-y-auto`}
        >
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Discussion Channels
                </span>
                {totalUnreadMessages > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllChannelsRead}
                    title="Mark all channels read"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Read all
                  </button>
                )}
              </div>

              <div className="space-y-1">
                {channels.map((ch) => {
                  const unread = unreadMessagesByChannel[ch.id] || 0;
                  const isActive = ch.id === activeChannel.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => handleSelectChannel(ch.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                          : unread > 0
                          ? 'text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Hash className="w-3.5 h-3.5 shrink-0 opacity-75" />
                        <span className="truncate">{ch.name}</span>
                        {ch.archived && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            (archived)
                          </span>
                        )}
                      </span>
                      {unread > 0 && !isActive && (
                        <span className="font-mono tabular-nums text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-600 text-white shrink-0">
                          {unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                <Users className="w-3.5 h-3.5" />
                Workspace Members ({members.length})
              </div>
              <div className="space-y-1">
                {members.map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => handleInsertMemberMention(m.displayName)}
                    title={`Click to @mention ${m.displayName}`}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Avatar name={m.displayName} photoURL={m.photoURL} size="xs" />
                      <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                        {m.displayName}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-400 capitalize shrink-0">
                      {m.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Center Stream: Real-Time Channel Messages */}
        <section
          className={`${
            mobilePane === 'chat' ? 'flex' : 'hidden md:flex'
          } md:col-span-6 flex-col min-h-0`}
        >
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Hash className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{activeChannel.name}</span>
                <span className="text-[11px] font-mono tabular-nums font-normal text-slate-400">
                  {channelMessages.length} msg{channelMessages.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {activeChannel.description}
              </p>
            </div>

            {activeChannel.projectId && (
              <Link
                to={`/projects/${activeChannel.projectId}`}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg shrink-0"
              >
                Project
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {errorMsg && (
            <div className="mx-5 mt-3 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center justify-between gap-2">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg('')}
                className="text-rose-500 hover:text-rose-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loadingWorkspaceData && messages.length === 0 ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800/70 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : channelMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No messages in #{activeChannel.name} yet
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Send a message or type @ to mention a teammate in real time.
                </p>
              </div>
            ) : (
              channelMessages.map((msg) => {
                const isAuthor = msg.authorId === user?.uid;
                const canDelete = isAuthor || myRole === 'owner' || myRole === 'admin';
                const mentionsMe = Boolean(user?.uid && msg.mentions.includes(user.uid));
                const isEdited =
                  Boolean(msg.createdAt && msg.updatedAt) &&
                  msg.updatedAt!.toMillis() - msg.createdAt!.toMillis() > 1500;
                const isEditing = editingMessageId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 group rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
                      mentionsMe
                        ? 'bg-amber-50/70 dark:bg-amber-950/20'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <Avatar name={msg.authorName} photoURL={msg.authorPhotoURL} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {msg.authorName}
                          </span>
                          <span className="text-slate-400 tabular-nums shrink-0">
                            {formatRelativeTime(msg.createdAt)}
                          </span>
                          {isEdited && (
                            <span className="text-[11px] text-slate-400">(edited)</span>
                          )}
                        </div>

                        {!isEditing && (isAuthor || canDelete) && (
                          <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                            {isAuthor && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(msg.id, msg.content)}
                                aria-label="Edit message"
                                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                aria-label="Delete message"
                                className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="mt-1.5 space-y-2">
                          <input
                            type="text"
                            value={editingText}
                            maxLength={FIELD_LIMITS.MESSAGE_MAX}
                            autoFocus
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setEditingMessageId(null);
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleSaveEdit(msg.id);
                              }
                            }}
                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-950 border border-indigo-400 dark:border-indigo-700 rounded-md focus:outline-none"
                          />
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              disabled={savingEdit || !editingText.trim()}
                              onClick={() => handleSaveEdit(msg.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded"
                            >
                              <Check className="w-3 h-3" />
                              {savingEdit ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMessageId(null)}
                              className="px-2.5 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words mt-0.5">
                          <MentionText
                            text={msg.content}
                            members={members}
                            currentUserId={user?.uid}
                          />
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={handleSend}
            className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0 relative"
          >
            <MentionDropdown
              isOpen={mention.isOpen}
              suggestions={mention.suggestions}
              selectedIndex={mention.selectedIndex}
              onSelect={mention.applySuggestion}
              placement="top"
            />
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={text}
                maxLength={FIELD_LIMITS.MESSAGE_MAX}
                onChange={(e) => {
                  setText(e.target.value);
                  mention.syncCursor(e.target);
                }}
                onClick={(e) => mention.syncCursor(e.currentTarget)}
                onKeyUp={(e) => {
                  if (
                    e.key !== 'ArrowUp' &&
                    e.key !== 'ArrowDown' &&
                    e.key !== 'Enter' &&
                    e.key !== 'Tab' &&
                    e.key !== 'Escape'
                  ) {
                    mention.syncCursor(e.currentTarget);
                  }
                }}
                onKeyDown={(e) => {
                  mention.handleKeyDown(e);
                }}
                placeholder={`Message #${activeChannel.name} (type @ to mention)...`}
                className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </section>

        {/* Right Panel: Live Activity Feed & Mentions */}
        <aside
          className={`${
            mobilePane === 'activity' ? 'flex' : 'hidden md:flex'
          } md:col-span-3 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 flex-col min-h-0 bg-slate-50/40 dark:bg-slate-950/30`}
        >
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRightPanel('activity')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  rightPanel === 'activity'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Activity Feed
              </button>
              <button
                type="button"
                onClick={() => setRightPanel('members')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  rightPanel === 'members'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Team
              </button>
            </div>
          </div>

          {rightPanel === 'activity' ? (
            <>
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 overflow-x-auto shrink-0">
                {(
                  [
                    { id: 'all', label: 'All' },
                    ...(activeChannel.projectId
                      ? [{ id: 'channel', label: `#${activeChannel.name}` }]
                      : []),
                    { id: 'tasks', label: 'Tasks' },
                    { id: 'comments', label: 'Comments' },
                  ] as Array<{ id: ActivityFilter; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActivityFilter(f.id)}
                    className={`px-2 py-1 text-[11px] font-medium rounded whitespace-nowrap transition-colors ${
                      activityFilter === f.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800">
                {filteredActivity.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No activity events matching this filter yet.
                  </div>
                ) : (
                  filteredActivity.map((log) => {
                    const targetHref = log.taskId
                      ? `/tasks/${log.taskId}`
                      : log.projectId
                      ? `/projects/${log.projectId}`
                      : '';
                    return (
                      <div key={log.id} className="px-4 py-3 text-xs space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 leading-relaxed">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {log.actorName}
                            </span>{' '}
                            <span className="text-slate-500 dark:text-slate-400">
                              {log.action.replace(/_/g, ' ')}
                            </span>{' '}
                            {targetHref ? (
                              <Link
                                to={targetHref}
                                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline break-words"
                              >
                                {log.targetTitle}
                              </Link>
                            ) : (
                              <span className="font-medium text-slate-900 dark:text-slate-100 break-words">
                                {log.targetTitle}
                              </span>
                            )}
                          </div>
                        </div>
                        {log.details && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {log.details}
                          </p>
                        )}
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          {formatRelativeTime(log.createdAt)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                Click any teammate to mention them in #{activeChannel.name}.
              </p>
              {members.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => handleInsertMemberMention(m.displayName)}
                  className="w-full flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 text-left transition-colors"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={m.displayName} photoURL={m.photoURL} size="xs" />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {m.displayName}
                      </span>
                      <span className="block text-[10px] text-slate-400 truncate">
                        {m.email}
                      </span>
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize shrink-0">
                    {m.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
