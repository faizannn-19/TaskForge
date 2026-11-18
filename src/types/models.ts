import { Timestamp } from 'firebase/firestore';

export type ThemePreference = 'light' | 'dark' | 'system';
export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type WorkspaceAccent = 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';
export type NotificationType = 'assignment' | 'deadline' | 'update' | 'mention' | 'invitation';

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const FIELD_LIMITS = {
  ID_MAX: 128,
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  SLUG_PATTERN: /^[a-z0-9\-]+$/,
  PROJECT_KEY_PATTERN: /^[A-Z0-9]+$/,
  DISPLAY_NAME_MAX: 80,
  PHOTO_URL_MAX: 500,
  JOB_TITLE_MAX: 80,
  BIO_MAX: 400,
  EMAIL_MAX: 254,
  WORKSPACE_NAME_MAX: 80,
  WORKSPACE_SLUG_MAX: 60,
  WORKSPACE_DESC_MAX: 400,
  PROJECT_NAME_MAX: 100,
  PROJECT_KEY_MIN: 2,
  PROJECT_KEY_MAX: 6,
  PROJECT_DESC_MAX: 1500,
  TASK_TITLE_MAX: 160,
  TASK_DESC_MAX: 4000,
  TASK_LABELS_MAX: 8,
  TASK_SUBTASKS_MAX: 25,
  SUBTASK_TITLE_MAX: 160,
  COMMENT_MAX: 2000,
  MESSAGE_MAX: 2000,
  MENTIONS_MAX: 15,
  NOTIF_TITLE_MAX: 140,
  NOTIF_MSG_MAX: 400,
} as const;

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface UserPublicProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  jobTitle: string;
  bio: string;
  themePreference: ThemePreference;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UserPrivateInfo {
  email: string;
  notifyAssignments: boolean;
  notifyDeadlines: boolean;
  notifyMentions: boolean;
  notifyComments: boolean;
  updatedAt: Timestamp | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  ownerId: string;
  accentColor: WorkspaceAccent;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  displayName: string;
  email: string;
  photoURL: string;
  invitationId: string;
  joinedAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  inviteeEmail: string;
  role: 'admin' | 'member';
  status: InvitationStatus;
  invitedBy: string;
  invitedByName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string;
  ownerId: string;
  ownerName: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  startDate: string;
  deadline: string;
  progress: number;
  taskCounter: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Task {
  id: string;
  workspaceId: string;
  projectId: string;
  taskKey: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: PriorityLevel;
  assigneeId: string;
  assigneeName: string;
  reporterId: string;
  reporterName: string;
  dueDate: string;
  labels: string[];
  subtasks: SubtaskItem[];
  order: number;
  isMilestone: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Comment {
  id: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  content: string;
  mentions: string[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Message {
  id: string;
  workspaceId: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string;
  content: string;
  mentions: string[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface AppNotification {
  id: string;
  workspaceId: string;
  userId: string;
  actorId: string;
  actorName: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: Timestamp | null;
}

export interface ActivityLog {
  id: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  actorId: string;
  actorName: string;
  action: string;
  targetTitle: string;
  details: string;
  createdAt: Timestamp | null;
}

export interface ChannelRead {
  id: string;
  workspaceId: string;
  channelId: string;
  lastReadAt: Timestamp | null;
}

