import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  FIELD_LIMITS,
  Invitation,
  NotificationType,
  PriorityLevel,
  Project,
  ProjectStatus,
  SubtaskItem,
  Task,
  TaskStatus,
  ThemePreference,
  UserPrivateInfo,
  WorkspaceAccent,
  WorkspaceRole,
} from '../types/models';
import { clampString, deriveProjectKey, slugify } from './utils';

interface ActorInfo {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export async function upsertUserProfile(
  actor: ActorInfo,
  updates?: {
    displayName?: string;
    photoURL?: string;
    jobTitle?: string;
    bio?: string;
    themePreference?: ThemePreference;
  }
): Promise<void> {
  const userRef = doc(db, 'users', actor.uid);
  const privateRef = doc(db, 'users', actor.uid, 'private', 'info');

  try {
    const existingSnap = await getDoc(userRef);
    const displayName = clampString(
      updates?.displayName ?? actor.displayName ?? actor.email.split('@')[0] ?? 'User',
      FIELD_LIMITS.DISPLAY_NAME_MAX
    );
    const photoURL = clampString(updates?.photoURL ?? actor.photoURL ?? '', FIELD_LIMITS.PHOTO_URL_MAX);

    if (!existingSnap.exists()) {
      const batch = writeBatch(db);
      batch.set(userRef, {
        uid: actor.uid,
        displayName: displayName || 'TaskForge User',
        photoURL,
        jobTitle: clampString(updates?.jobTitle ?? '', FIELD_LIMITS.JOB_TITLE_MAX),
        bio: clampString(updates?.bio ?? '', FIELD_LIMITS.BIO_MAX),
        themePreference: updates?.themePreference ?? 'system',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(privateRef, {
        email: clampString(actor.email.toLowerCase(), FIELD_LIMITS.EMAIL_MAX),
        notifyAssignments: true,
        notifyDeadlines: true,
        notifyMentions: true,
        notifyComments: true,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } else if (updates) {
      await updateDoc(userRef, {
        ...(updates.displayName !== undefined
          ? { displayName: clampString(updates.displayName, FIELD_LIMITS.DISPLAY_NAME_MAX) || 'User' }
          : {}),
        ...(updates.photoURL !== undefined
          ? { photoURL: clampString(updates.photoURL, FIELD_LIMITS.PHOTO_URL_MAX) }
          : {}),
        ...(updates.jobTitle !== undefined
          ? { jobTitle: clampString(updates.jobTitle, FIELD_LIMITS.JOB_TITLE_MAX) }
          : {}),
        ...(updates.bio !== undefined ? { bio: clampString(updates.bio, FIELD_LIMITS.BIO_MAX) } : {}),
        ...(updates.themePreference !== undefined ? { themePreference: updates.themePreference } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${actor.uid}`);
  }
}

export async function updateNotificationPreferences(
  uid: string,
  email: string,
  prefs: Pick<
    UserPrivateInfo,
    'notifyAssignments' | 'notifyDeadlines' | 'notifyMentions' | 'notifyComments'
  >
): Promise<void> {
  const privateRef = doc(db, 'users', uid, 'private', 'info');
  try {
    const snap = await getDoc(privateRef);
    if (!snap.exists()) {
      await setDoc(privateRef, {
        email: clampString(email.toLowerCase(), FIELD_LIMITS.EMAIL_MAX),
        ...prefs,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        ...prefs,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/private/info`);
  }
}

export async function logActivity(params: {
  workspaceId: string;
  projectId?: string;
  taskId?: string;
  actorId: string;
  actorName: string;
  action: string;
  targetTitle: string;
  details?: string;
}): Promise<void> {
  const ref = doc(collection(db, 'activityLogs'));
  try {
    await setDoc(ref, {
      workspaceId: params.workspaceId,
      projectId: params.projectId || '',
      taskId: params.taskId || '',
      actorId: params.actorId,
      actorName: clampString(params.actorName, FIELD_LIMITS.DISPLAY_NAME_MAX) || 'User',
      action: clampString(params.action, 60),
      targetTitle: clampString(params.targetTitle, 160) || 'Item',
      details: clampString(params.details || '', 300),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `activityLogs/${ref.id}`);
  }
}

export async function createNotification(params: {
  workspaceId: string;
  userId: string;
  actorId: string;
  actorName: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
}): Promise<void> {
  if (!params.userId || params.userId === params.actorId) return;
  const ref = doc(collection(db, 'notifications'));
  try {
    await setDoc(ref, {
      workspaceId: params.workspaceId,
      userId: params.userId,
      actorId: params.actorId,
      actorName: clampString(params.actorName, FIELD_LIMITS.DISPLAY_NAME_MAX) || 'Teammate',
      type: params.type,
      title: clampString(params.title, FIELD_LIMITS.NOTIF_TITLE_MAX),
      message: clampString(params.message, FIELD_LIMITS.NOTIF_MSG_MAX),
      link: clampString(params.link, 200),
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${ref.id}`);
  }
}

export async function createWorkspace(
  actor: ActorInfo,
  input: { name: string; description: string; accentColor: WorkspaceAccent }
): Promise<string> {
  const name = clampString(input.name, FIELD_LIMITS.WORKSPACE_NAME_MAX);
  if (name.length < 2) {
    throw new Error('Workspace name must be at least 2 characters.');
  }
  const wsRef = doc(collection(db, 'workspaces'));
  const memberRef = doc(db, 'workspaceMembers', `${wsRef.id}_${actor.uid}`);
  const slug = slugify(name);

  try {
    const batch = writeBatch(db);
    batch.set(wsRef, {
      name,
      slug,
      description: clampString(input.description, FIELD_LIMITS.WORKSPACE_DESC_MAX),
      ownerId: actor.uid,
      accentColor: input.accentColor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(memberRef, {
      workspaceId: wsRef.id,
      userId: actor.uid,
      role: 'owner',
      displayName: clampString(actor.displayName || actor.email.split('@')[0], FIELD_LIMITS.DISPLAY_NAME_MAX),
      email: clampString(actor.email.toLowerCase(), FIELD_LIMITS.EMAIL_MAX),
      photoURL: clampString(actor.photoURL, FIELD_LIMITS.PHOTO_URL_MAX),
      invitationId: '',
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    // Separate write after batch so membership exists for activityLogs rule
    await logActivity({
      workspaceId: wsRef.id,
      actorId: actor.uid,
      actorName: actor.displayName,
      action: 'created_workspace',
      targetTitle: name,
      details: 'Initialized workspace',
    });

    return wsRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workspaces/${wsRef.id}`);
  }
}

export async function updateWorkspace(
  workspaceId: string,
  actor: ActorInfo,
  input: { name: string; description: string; accentColor: WorkspaceAccent }
): Promise<void> {
  const name = clampString(input.name, FIELD_LIMITS.WORKSPACE_NAME_MAX);
  if (name.length < 2) {
    throw new Error('Workspace name must be at least 2 characters.');
  }
  const wsRef = doc(db, 'workspaces', workspaceId);
  try {
    await updateDoc(wsRef, {
      name,
      slug: slugify(name),
      description: clampString(input.description, FIELD_LIMITS.WORKSPACE_DESC_MAX),
      accentColor: input.accentColor,
      updatedAt: serverTimestamp(),
    });
    await logActivity({
      workspaceId,
      actorId: actor.uid,
      actorName: actor.displayName,
      action: 'updated_workspace',
      targetTitle: name,
      details: 'Updated workspace settings',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `workspaces/${workspaceId}`);
  }
}

export async function sendWorkspaceInvitation(params: {
  workspaceId: string;
  workspaceName: string;
  inviteeEmail: string;
  role: 'admin' | 'member';
  actor: ActorInfo;
}): Promise<void> {
  const email = clampString(params.inviteeEmail.toLowerCase(), FIELD_LIMITS.EMAIL_MAX);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (email === params.actor.email.trim().toLowerCase()) {
    throw new Error('You cannot send an invitation to your own email address.');
  }
  const invRef = doc(collection(db, 'invitations'));
  try {
    await setDoc(invRef, {
      workspaceId: params.workspaceId,
      workspaceName: clampString(params.workspaceName, FIELD_LIMITS.WORKSPACE_NAME_MAX),
      inviteeEmail: email,
      role: params.role,
      status: 'pending',
      invitedBy: params.actor.uid,
      invitedByName: clampString(params.actor.displayName, FIELD_LIMITS.DISPLAY_NAME_MAX),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logActivity({
      workspaceId: params.workspaceId,
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      action: 'invited_member',
      targetTitle: email,
      details: `Invited as ${params.role}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `invitations/${invRef.id}`);
  }
}

export async function respondToInvitation(
  invitation: Invitation,
  accept: boolean,
  actor: ActorInfo
): Promise<void> {
  const invRef = doc(db, 'invitations', invitation.id);
  try {
    if (!accept) {
      await updateDoc(invRef, {
        status: 'declined',
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const memberRef = doc(db, 'workspaceMembers', `${invitation.workspaceId}_${actor.uid}`);
    const batch = writeBatch(db);
    batch.update(invRef, {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
    batch.set(memberRef, {
      workspaceId: invitation.workspaceId,
      userId: actor.uid,
      role: invitation.role,
      displayName: clampString(actor.displayName || actor.email.split('@')[0], FIELD_LIMITS.DISPLAY_NAME_MAX),
      email: clampString(actor.email.toLowerCase(), FIELD_LIMITS.EMAIL_MAX),
      photoURL: clampString(actor.photoURL, FIELD_LIMITS.PHOTO_URL_MAX),
      invitationId: invitation.id,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await logActivity({
      workspaceId: invitation.workspaceId,
      actorId: actor.uid,
      actorName: actor.displayName,
      action: 'joined_workspace',
      targetTitle: invitation.workspaceName,
      details: `Joined as ${invitation.role}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `invitations/${invitation.id}`);
  }
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'invitations', invitationId), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `invitations/${invitationId}`);
  }
}

export async function updateMemberRole(
  memberId: string,
  role: Extract<WorkspaceRole, 'admin' | 'member'>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'workspaceMembers', memberId), {
      role,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `workspaceMembers/${memberId}`);
  }
}

export async function removeWorkspaceMember(memberId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaceMembers', memberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `workspaceMembers/${memberId}`);
  }
}

export async function createProject(
  workspaceId: string,
  actor: ActorInfo,
  input: {
    name: string;
    key?: string;
    description: string;
    priority: PriorityLevel;
    startDate: string;
    deadline: string;
  }
): Promise<string> {
  const name = clampString(input.name, FIELD_LIMITS.PROJECT_NAME_MAX);
  if (name.length < 2) {
    throw new Error('Project name must be at least 2 characters.');
  }
  const rawKey = (input.key || deriveProjectKey(name))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, FIELD_LIMITS.PROJECT_KEY_MAX);
  const key = rawKey.length >= 2 ? rawKey : deriveProjectKey(name);

  const projRef = doc(collection(db, 'projects'));
  try {
    await setDoc(projRef, {
      workspaceId,
      name,
      key,
      description: clampString(input.description, FIELD_LIMITS.PROJECT_DESC_MAX),
      ownerId: actor.uid,
      ownerName: clampString(actor.displayName, FIELD_LIMITS.DISPLAY_NAME_MAX),
      status: 'active',
      priority: input.priority,
      startDate: clampString(input.startDate, 20),
      deadline: clampString(input.deadline, 20),
      progress: 0,
      taskCounter: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logActivity({
      workspaceId,
      projectId: projRef.id,
      actorId: actor.uid,
      actorName: actor.displayName,
      action: 'created_project',
      targetTitle: `${key} · ${name}`,
      details: `Priority: ${input.priority}`,
    });

    return projRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `projects/${projRef.id}`);
  }
}

export async function updateProject(
  project: Project,
  actor: ActorInfo,
  updates: Partial<{
    name: string;
    description: string;
    status: ProjectStatus;
    priority: PriorityLevel;
    startDate: string;
    deadline: string;
  }>
): Promise<void> {
  const projRef = doc(db, 'projects', project.id);
  try {
    const nextName =
      updates.name !== undefined
        ? clampString(updates.name, FIELD_LIMITS.PROJECT_NAME_MAX)
        : project.name;
    await updateDoc(projRef, {
      ...(updates.name !== undefined ? { name: nextName } : {}),
      ...(updates.description !== undefined
        ? { description: clampString(updates.description, FIELD_LIMITS.PROJECT_DESC_MAX) }
        : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
      ...(updates.startDate !== undefined ? { startDate: clampString(updates.startDate, 20) } : {}),
      ...(updates.deadline !== undefined ? { deadline: clampString(updates.deadline, 20) } : {}),
      updatedAt: serverTimestamp(),
    });

    await logActivity({
      workspaceId: project.workspaceId,
      projectId: project.id,
      actorId: actor.uid,
      actorName: actor.displayName,
      action: updates.status === 'archived' ? 'archived_project' : 'updated_project',
      targetTitle: `${project.key} · ${nextName}`,
      details: updates.status ? `Status set to ${updates.status}` : 'Updated project details',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `projects/${project.id}`);
  }
}

export async function deleteProject(project: Project): Promise<void> {
  try {
    await deleteDoc(doc(db, 'projects', project.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `projects/${project.id}`);
  }
}

export function computeProjectProgress(projectTasks: Task[]): number {
  if (projectTasks.length === 0) return 0;
  const doneCount = projectTasks.filter((t) => t.status === 'done').length;
  return Math.round((doneCount / projectTasks.length) * 100);
}

export async function createTask(params: {
  project: Project;
  existingProjectTasks: Task[];
  actor: ActorInfo;
  input: {
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
  };
}): Promise<string> {
  const title = clampString(params.input.title, FIELD_LIMITS.TASK_TITLE_MAX);
  if (!title) {
    throw new Error('Task title is required.');
  }
  const nextCounter = (params.project.taskCounter || 0) + 1;
  const taskKey = `${params.project.key}-${nextCounter}`;
  const taskRef = doc(collection(db, 'tasks'));
  const projRef = doc(db, 'projects', params.project.id);

  const sanitizedLabels = params.input.labels
    .map((l) => clampString(l, 40))
    .filter(Boolean)
    .slice(0, FIELD_LIMITS.TASK_LABELS_MAX);

  const sanitizedSubtasks = params.input.subtasks
    .map((s) => ({
      id: s.id.slice(0, 64),
      title: clampString(s.title, FIELD_LIMITS.SUBTASK_TITLE_MAX),
      completed: Boolean(s.completed),
    }))
    .filter((s) => s.title.length > 0)
    .slice(0, FIELD_LIMITS.TASK_SUBTASKS_MAX);

  const totalAfter = params.existingProjectTasks.length + 1;
  const doneAfter =
    params.existingProjectTasks.filter((t) => t.status === 'done').length +
    (params.input.status === 'done' ? 1 : 0);
  const nextProgress = Math.round((doneAfter / totalAfter) * 100);

  try {
    const batch = writeBatch(db);
    batch.set(taskRef, {
      workspaceId: params.project.workspaceId,
      projectId: params.project.id,
      taskKey,
      title,
      description: clampString(params.input.description, FIELD_LIMITS.TASK_DESC_MAX),
      status: params.input.status,
      priority: params.input.priority,
      assigneeId: params.input.assigneeId || '',
      assigneeName: clampString(params.input.assigneeName || '', FIELD_LIMITS.DISPLAY_NAME_MAX),
      reporterId: params.actor.uid,
      reporterName: clampString(params.actor.displayName, FIELD_LIMITS.DISPLAY_NAME_MAX),
      dueDate: clampString(params.input.dueDate, 20),
      labels: sanitizedLabels,
      subtasks: sanitizedSubtasks,
      order: Date.now() % 9000000,
      isMilestone: Boolean(params.input.isMilestone),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(projRef, {
      taskCounter: nextCounter,
      progress: nextProgress,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await logActivity({
      workspaceId: params.project.workspaceId,
      projectId: params.project.id,
      taskId: taskRef.id,
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      action: 'created_task',
      targetTitle: `${taskKey} · ${title}`,
      details: params.input.assigneeName ? `Assigned to ${params.input.assigneeName}` : 'Unassigned',
    });

    if (params.input.assigneeId && params.input.assigneeId !== params.actor.uid) {
      await createNotification({
        workspaceId: params.project.workspaceId,
        userId: params.input.assigneeId,
        actorId: params.actor.uid,
        actorName: params.actor.displayName,
        type: 'assignment',
        title: `Assigned to ${taskKey}`,
        message: `${params.actor.displayName} assigned "${title}" to you.`,
        link: `/tasks/${taskRef.id}`,
      });
    }

    return taskRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tasks/${taskRef.id}`);
  }
}

export async function updateTask(params: {
  task: Task;
  projectTasks: Task[];
  actor: ActorInfo;
  updates: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: PriorityLevel;
    assigneeId: string;
    assigneeName: string;
    dueDate: string;
    labels: string[];
    subtasks: SubtaskItem[];
    order: number;
    isMilestone: boolean;
  }>;
}): Promise<void> {
  const taskRef = doc(db, 'tasks', params.task.id);
  const projRef = doc(db, 'projects', params.task.projectId);

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (params.updates.title !== undefined) {
    const clean = clampString(params.updates.title, FIELD_LIMITS.TASK_TITLE_MAX);
    if (!clean) throw new Error('Task title cannot be empty.');
    payload.title = clean;
  }
  if (params.updates.description !== undefined) {
    payload.description = clampString(params.updates.description, FIELD_LIMITS.TASK_DESC_MAX);
  }
  if (params.updates.status !== undefined) payload.status = params.updates.status;
  if (params.updates.priority !== undefined) payload.priority = params.updates.priority;
  if (params.updates.assigneeId !== undefined) payload.assigneeId = params.updates.assigneeId;
  if (params.updates.assigneeName !== undefined) {
    payload.assigneeName = clampString(params.updates.assigneeName, FIELD_LIMITS.DISPLAY_NAME_MAX);
  }
  if (params.updates.dueDate !== undefined) {
    payload.dueDate = clampString(params.updates.dueDate, 20);
  }
  if (params.updates.labels !== undefined) {
    payload.labels = params.updates.labels
      .map((l) => clampString(l, 40))
      .filter(Boolean)
      .slice(0, FIELD_LIMITS.TASK_LABELS_MAX);
  }
  if (params.updates.subtasks !== undefined) {
    payload.subtasks = params.updates.subtasks
      .map((s) => ({
        id: s.id.slice(0, 64),
        title: clampString(s.title, FIELD_LIMITS.SUBTASK_TITLE_MAX),
        completed: Boolean(s.completed),
      }))
      .filter((s) => s.title.length > 0)
      .slice(0, FIELD_LIMITS.TASK_SUBTASKS_MAX);
  }
  if (params.updates.order !== undefined) payload.order = params.updates.order;
  if (params.updates.isMilestone !== undefined) payload.isMilestone = params.updates.isMilestone;

  const statusChanged =
    params.updates.status !== undefined && params.updates.status !== params.task.status;
  const assigneeChanged =
    params.updates.assigneeId !== undefined &&
    params.updates.assigneeId !== params.task.assigneeId &&
    params.updates.assigneeId !== '';

  try {
    const batch = writeBatch(db);
    batch.update(taskRef, payload);

    if (statusChanged && params.projectTasks.length > 0) {
      const updatedList = params.projectTasks.map((t) =>
        t.id === params.task.id ? { ...t, status: params.updates.status! } : t
      );
      batch.update(projRef, {
        progress: computeProjectProgress(updatedList),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    if (statusChanged) {
      await logActivity({
        workspaceId: params.task.workspaceId,
        projectId: params.task.projectId,
        taskId: params.task.id,
        actorId: params.actor.uid,
        actorName: params.actor.displayName,
        action: 'moved_task',
        targetTitle: `${params.task.taskKey} · ${params.task.title}`,
        details: `Moved to ${params.updates.status}`,
      });

      if (params.task.assigneeId && params.task.assigneeId !== params.actor.uid) {
        await createNotification({
          workspaceId: params.task.workspaceId,
          userId: params.task.assigneeId,
          actorId: params.actor.uid,
          actorName: params.actor.displayName,
          type: 'update',
          title: `${params.task.taskKey} status updated`,
          message: `${params.actor.displayName} moved "${params.task.title}" to ${params.updates.status}.`,
          link: `/tasks/${params.task.id}`,
        });
      }
    }

    if (assigneeChanged && params.updates.assigneeId !== params.actor.uid) {
      await createNotification({
        workspaceId: params.task.workspaceId,
        userId: params.updates.assigneeId!,
        actorId: params.actor.uid,
        actorName: params.actor.displayName,
        type: 'assignment',
        title: `Assigned to ${params.task.taskKey}`,
        message: `${params.actor.displayName} assigned "${params.task.title}" to you.`,
        link: `/tasks/${params.task.id}`,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${params.task.id}`);
  }
}

export async function deleteTask(task: Task, projectTasks: Task[]): Promise<void> {
  const remaining = projectTasks.filter((t) => t.id !== task.id);
  const batch = writeBatch(db);
  batch.delete(doc(db, 'tasks', task.id));
  batch.update(doc(db, 'projects', task.projectId), {
    progress: computeProjectProgress(remaining),
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tasks/${task.id}`);
  }
}

export async function addComment(params: {
  task: Task;
  actor: ActorInfo;
  content: string;
  mentions: string[];
}): Promise<void> {
  const content = clampString(params.content, FIELD_LIMITS.COMMENT_MAX);
  if (!content) throw new Error('Comment cannot be empty.');
  const commentRef = doc(collection(db, 'comments'));
  const cleanMentions = params.mentions.slice(0, FIELD_LIMITS.MENTIONS_MAX);

  try {
    await setDoc(commentRef, {
      workspaceId: params.task.workspaceId,
      projectId: params.task.projectId,
      taskId: params.task.id,
      authorId: params.actor.uid,
      authorName: clampString(params.actor.displayName, FIELD_LIMITS.DISPLAY_NAME_MAX),
      authorPhotoURL: clampString(params.actor.photoURL, FIELD_LIMITS.PHOTO_URL_MAX),
      content,
      mentions: cleanMentions,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logActivity({
      workspaceId: params.task.workspaceId,
      projectId: params.task.projectId,
      taskId: params.task.id,
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      action: 'commented',
      targetTitle: `${params.task.taskKey} · ${params.task.title}`,
      details: content.slice(0, 120),
    });

    for (const mentionedUid of cleanMentions) {
      if (mentionedUid !== params.actor.uid) {
        await createNotification({
          workspaceId: params.task.workspaceId,
          userId: mentionedUid,
          actorId: params.actor.uid,
          actorName: params.actor.displayName,
          type: 'mention',
          title: `Mentioned in ${params.task.taskKey}`,
          message: `${params.actor.displayName} mentioned you: "${content.slice(0, 100)}"`,
          link: `/tasks/${params.task.id}`,
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `comments/${commentRef.id}`);
  }
}

export async function updateComment(
  commentId: string,
  content: string,
  mentions: string[]
): Promise<void> {
  const clean = clampString(content, FIELD_LIMITS.COMMENT_MAX);
  if (!clean) throw new Error('Comment cannot be empty.');
  const cleanMentions = mentions.slice(0, FIELD_LIMITS.MENTIONS_MAX);
  try {
    await updateDoc(doc(db, 'comments', commentId), {
      content: clean,
      mentions: cleanMentions,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `comments/${commentId}`);
  }
}

export async function deleteComment(commentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'comments', commentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `comments/${commentId}`);
  }
}

export async function sendMessage(params: {
  workspaceId: string;
  channelId: string;
  channelName: string;
  actor: ActorInfo;
  content: string;
  mentions: string[];
}): Promise<void> {
  const content = clampString(params.content, FIELD_LIMITS.MESSAGE_MAX);
  if (!content) throw new Error('Message cannot be empty.');
  const msgRef = doc(collection(db, 'messages'));
  const cleanMentions = params.mentions.slice(0, FIELD_LIMITS.MENTIONS_MAX);

  try {
    await setDoc(msgRef, {
      workspaceId: params.workspaceId,
      channelId: params.channelId,
      channelName: clampString(params.channelName, 80),
      authorId: params.actor.uid,
      authorName: clampString(params.actor.displayName, FIELD_LIMITS.DISPLAY_NAME_MAX),
      authorPhotoURL: clampString(params.actor.photoURL, FIELD_LIMITS.PHOTO_URL_MAX),
      content,
      mentions: cleanMentions,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const mentionedUid of cleanMentions) {
      if (mentionedUid !== params.actor.uid) {
        await createNotification({
          workspaceId: params.workspaceId,
          userId: mentionedUid,
          actorId: params.actor.uid,
          actorName: params.actor.displayName,
          type: 'mention',
          title: `Mentioned in #${params.channelName}`,
          message: `${params.actor.displayName}: "${content.slice(0, 100)}"`,
          link: `/chat?channel=${params.channelId}`,
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `messages/${msgRef.id}`);
  }
}

export async function updateMessage(
  messageId: string,
  content: string,
  mentions: string[]
): Promise<void> {
  const clean = clampString(content, FIELD_LIMITS.MESSAGE_MAX);
  if (!clean) throw new Error('Message cannot be empty.');
  const cleanMentions = mentions.slice(0, FIELD_LIMITS.MENTIONS_MAX);
  try {
    await updateDoc(doc(db, 'messages', messageId), {
      content: clean,
      mentions: cleanMentions,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `messages/${messageId}`);
  }
}

export async function deleteMessage(messageId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'messages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `messages/${messageId}`);
  }
}

export async function markChannelRead(
  uid: string,
  workspaceId: string,
  channelId: string
): Promise<void> {
  if (!uid || !workspaceId || !channelId) return;
  const readId = `${workspaceId}_${channelId}`;
  const ref = doc(db, 'users', uid, 'channelReads', readId);
  try {
    await setDoc(ref, {
      workspaceId,
      channelId,
      lastReadAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/channelReads/${readId}`);
  }
}

export async function markChannelsRead(
  uid: string,
  workspaceId: string,
  channelIds: string[]
): Promise<void> {
  if (!uid || !workspaceId || channelIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const channelId of channelIds.slice(0, 400)) {
      const readId = `${workspaceId}_${channelId}`;
      batch.set(doc(db, 'users', uid, 'channelReads', readId), {
        workspaceId,
        channelId,
        lastReadAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/channelReads`);
  }
}

export async function markNotificationRead(notificationId: string, isRead = true): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { isRead });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsRead(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of notificationIds.slice(0, 400)) {
      batch.update(doc(db, 'notifications', id), { isRead: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notifications/${notificationId}`);
  }
}
