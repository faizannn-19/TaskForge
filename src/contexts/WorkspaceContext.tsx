import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  ActivityLog,
  AppNotification,
  ChannelRead,
  Invitation,
  Message,
  Project,
  Task,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '../types/models';
import { useAuth } from './AuthContext';

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  myMemberships: WorkspaceMember[];
  myRole: WorkspaceRole | null;
  members: WorkspaceMember[];
  projects: Project[];
  tasks: Task[];
  messages: Message[];
  activityLogs: ActivityLog[];
  workspaceInvitations: Invitation[];
  myPendingInvitations: Invitation[];
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  channelReads: ChannelRead[];
  unreadMessagesByChannel: Record<string, number>;
  totalUnreadMessages: number;
  loadingWorkspaces: boolean;
  loadingWorkspaceData: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);
const ACTIVE_WS_STORAGE_KEY = 'taskforge_active_workspace';

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isVerified } = useAuth();

  const [myMemberships, setMyMemberships] = useState<WorkspaceMember[]>([]);
  const [workspacesMap, setWorkspacesMap] = useState<Record<string, Workspace>>({});
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_WS_STORAGE_KEY)
  );
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingWorkspaceData, setLoadingWorkspaceData] = useState(false);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [workspaceInvitations, setWorkspaceInvitations] = useState<Invitation[]>([]);
  const [myPendingInvitations, setMyPendingInvitations] = useState<Invitation[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [channelReads, setChannelReads] = useState<ChannelRead[]>([]);

  const setActiveWorkspaceId = (id: string) => {
    setActiveWorkspaceIdState(id);
    localStorage.setItem(ACTIVE_WS_STORAGE_KEY, id);
  };

  // 1. Subscribe to current user's memberships, pending invitations, notifications, and channel read cursors
  useEffect(() => {
    if (!user || !isVerified) {
      setMyMemberships([]);
      setWorkspacesMap({});
      setMyPendingInvitations([]);
      setNotifications([]);
      setChannelReads([]);
      setLoadingWorkspaces(false);
      return;
    }

    setLoadingWorkspaces(true);

    const membershipsQuery = query(
      collection(db, 'workspaceMembers'),
      where('userId', '==', user.uid)
    );
    const unsubMemberships = onSnapshot(
      membershipsQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkspaceMember);
        setMyMemberships(list);
        setLoadingWorkspaces(false);
      },
      (error) => {
        setLoadingWorkspaces(false);
        handleFirestoreError(error, OperationType.LIST, 'workspaceMembers');
      }
    );

    const userEmail = (user.email || '').trim().toLowerCase();
    let unsubInvites = () => {};
    if (userEmail) {
      const invQuery = query(
        collection(db, 'invitations'),
        where('inviteeEmail', '==', userEmail),
        where('status', '==', 'pending')
      );
      unsubInvites = onSnapshot(
        invQuery,
        (snap) => {
          setMyPendingInvitations(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Invitation)
          );
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'invitations');
        }
      );
    }

    const notifQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );
    const unsubNotifs = onSnapshot(
      notifQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as AppNotification)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setNotifications(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notifications');
      }
    );

    const channelReadsRef = collection(db, 'users', user.uid, 'channelReads');
    const unsubReads = onSnapshot(
      channelReadsRef,
      (snap) => {
        setChannelReads(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ChannelRead));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/channelReads`);
      }
    );

    return () => {
      unsubMemberships();
      unsubInvites();
      unsubNotifs();
      unsubReads();
    };
  }, [user, isVerified]);

  // 2. Subscribe to each workspace doc the user is a member of
  useEffect(() => {
    if (!user || !isVerified || myMemberships.length === 0) {
      setWorkspacesMap({});
      return;
    }

    const unsubs: Array<() => void> = [];
    for (const membership of myMemberships) {
      const wsId = membership.workspaceId;
      const unsub = onSnapshot(
        doc(db, 'workspaces', wsId),
        (snap) => {
          setWorkspacesMap((prev) => {
            if (!snap.exists()) {
              const next = { ...prev };
              delete next[wsId];
              return next;
            }
            return { ...prev, [wsId]: { id: snap.id, ...snap.data() } as Workspace };
          });
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `workspaces/${wsId}`);
        }
      );
      unsubs.push(unsub);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, isVerified, myMemberships]);

  const workspaces = useMemo(() => {
    return Object.values(workspacesMap).sort(
      (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
    );
  }, [workspacesMap]);

  // Keep activeWorkspaceId valid against joined memberships
  useEffect(() => {
    if (myMemberships.length === 0) {
      setActiveWorkspaceIdState(null);
      return;
    }
    const validIds = new Set(myMemberships.map((m) => m.workspaceId));
    if (!activeWorkspaceId || !validIds.has(activeWorkspaceId)) {
      const fallback = myMemberships[0].workspaceId;
      setActiveWorkspaceId(fallback);
    }
  }, [myMemberships, activeWorkspaceId]);

  const activeWorkspace = useMemo(() => {
    if (!activeWorkspaceId) return null;
    return workspacesMap[activeWorkspaceId] ?? null;
  }, [workspacesMap, activeWorkspaceId]);

  const myRole = useMemo(() => {
    if (!activeWorkspaceId) return null;
    return myMemberships.find((m) => m.workspaceId === activeWorkspaceId)?.role ?? null;
  }, [myMemberships, activeWorkspaceId]);

  // 3. Subscribe to active workspace's scoped collections
  useEffect(() => {
    if (!user || !isVerified || !activeWorkspaceId) {
      setMembers([]);
      setProjects([]);
      setTasks([]);
      setMessages([]);
      setActivityLogs([]);
      setWorkspaceInvitations([]);
      setLoadingWorkspaceData(false);
      return;
    }

    const isMember = myMemberships.some((m) => m.workspaceId === activeWorkspaceId);
    if (!isMember) return;

    setLoadingWorkspaceData(true);

    const membersQ = query(
      collection(db, 'workspaceMembers'),
      where('workspaceId', '==', activeWorkspaceId)
    );
    const projectsQ = query(
      collection(db, 'projects'),
      where('workspaceId', '==', activeWorkspaceId)
    );
    const tasksQ = query(
      collection(db, 'tasks'),
      where('workspaceId', '==', activeWorkspaceId)
    );
    const messagesQ = query(
      collection(db, 'messages'),
      where('workspaceId', '==', activeWorkspaceId)
    );
    const logsQ = query(
      collection(db, 'activityLogs'),
      where('workspaceId', '==', activeWorkspaceId)
    );
    const invitesQ = query(
      collection(db, 'invitations'),
      where('workspaceId', '==', activeWorkspaceId)
    );

    const unsubMembers = onSnapshot(
      membersQ,
      (snap) => {
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkspaceMember));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'workspaceMembers')
    );

    const unsubProjects = onSnapshot(
      projectsQ,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Project)
          .sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
        setProjects(list);
        setLoadingWorkspaceData(false);
      },
      (err) => {
        setLoadingWorkspaceData(false);
        handleFirestoreError(err, OperationType.LIST, 'projects');
      }
    );

    const unsubTasks = onSnapshot(
      tasksQ,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Task)
          .sort((a, b) => a.order - b.order);
        setTasks(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tasks')
    );

    const unsubMessages = onSnapshot(
      messagesQ,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Message)
          .sort((a, b) => (a.createdAt?.toMillis() ?? Date.now()) - (b.createdAt?.toMillis() ?? Date.now()));
        setMessages(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'messages')
    );

    const unsubLogs = onSnapshot(
      logsQ,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as ActivityLog)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setActivityLogs(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'activityLogs')
    );

    const unsubWsInvites = onSnapshot(
      invitesQ,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Invitation)
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setWorkspaceInvitations(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'invitations')
    );

    return () => {
      unsubMembers();
      unsubProjects();
      unsubTasks();
      unsubMessages();
      unsubLogs();
      unsubWsInvites();
    };
  }, [user, isVerified, activeWorkspaceId, myMemberships]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length + myPendingInvitations.length,
    [notifications, myPendingInvitations]
  );

  const unreadMessagesByChannel = useMemo(() => {
    if (!user || !activeWorkspaceId) return {};
    const myMembership = myMemberships.find((m) => m.workspaceId === activeWorkspaceId);
    const joinedAtMs = myMembership?.joinedAt?.toMillis() ?? 0;

    const readMap = new Map<string, number>();
    for (const r of channelReads) {
      if (r.workspaceId === activeWorkspaceId && r.lastReadAt) {
        readMap.set(r.channelId, r.lastReadAt.toMillis());
      }
    }

    const counts: Record<string, number> = {};
    for (const msg of messages) {
      if (msg.authorId === user.uid || !msg.createdAt) continue;
      const baseline = readMap.get(msg.channelId) ?? joinedAtMs;
      if (msg.createdAt.toMillis() > baseline) {
        counts[msg.channelId] = (counts[msg.channelId] || 0) + 1;
      }
    }
    return counts;
  }, [user, activeWorkspaceId, myMemberships, channelReads, messages]);

  const totalUnreadMessages = useMemo(
    () => Object.values(unreadMessagesByChannel).reduce((sum, n) => sum + n, 0),
    [unreadMessagesByChannel]
  );

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        activeWorkspaceId,
        setActiveWorkspaceId,
        myMemberships,
        myRole,
        members,
        projects,
        tasks,
        messages,
        activityLogs,
        workspaceInvitations,
        myPendingInvitations,
        notifications,
        unreadNotificationsCount,
        channelReads,
        unreadMessagesByChannel,
        totalUnreadMessages,
        loadingWorkspaces,
        loadingWorkspaceData,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

