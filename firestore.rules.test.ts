import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clampString,
  deriveProjectKey,
  extractMentions,
  slugify,
} from './src/lib/utils.ts';
import { FIELD_LIMITS, WorkspaceMember } from './src/types/models.ts';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
  firestore: Record<string, unknown>;
};

function getMatchBlock(source: string, header: string): string {
  const idx = source.indexOf(header);
  assert.notEqual(idx, -1, `Expected block "${header}" in firestore.rules`);
  const startBrace = source.indexOf(' {', idx) + 1;
  assert.ok(startBrace > 0, `Expected opening brace for "${header}"`);
  let depth = 0;
  for (let i = startBrace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(idx, i + 1);
      }
    }
  }
  throw new Error(`Unclosed brace in block ${header}`);
}

test('Global deny safety net and rules_version = 2 are enforced', () => {
  assert.match(rulesText, /^rules_version = '2';/m);
  const catchAll = getMatchBlock(rulesText, 'match /{document=**}');
  assert.match(catchAll, /allow read, write: if false;/);
});

test('Every collection in firebase-blueprint.json has an explicit match block in firestore.rules', () => {
  const expectedHeaders = [
    'match /users/{userId}',
    'match /private/{docId}',
    'match /channelReads/{readId}',
    'match /workspaces/{workspaceId}',
    'match /workspaceMembers/{memberId}',
    'match /invitations/{invitationId}',
    'match /projects/{projectId}',
    'match /tasks/{taskId}',
    'match /comments/{commentId}',
    'match /messages/{messageId}',
    'match /notifications/{notificationId}',
    'match /activityLogs/{logId}',
  ];

  assert.equal(Object.keys(blueprint.firestore).length, 12);
  for (const header of expectedHeaders) {
    getMatchBlock(rulesText, header);
  }
});

test('Unverified email bypass and PII scraping are blocked across all collections', () => {
  assert.match(
    rulesText,
    /function isVerifiedUser\(\)\s*\{\s*return isSignedIn\(\) && request\.auth\.token\.email_verified == true;/
  );

  const userBlock = getMatchBlock(rulesText, 'match /users/{userId}');
  assert.match(userBlock, /allow get: if isOwner\(userId\)/);
  assert.match(userBlock, /allow list: if false;/);

  const privateBlock = getMatchBlock(userBlock, 'match /private/{docId}');
  assert.match(privateBlock, /allow get: if isOwner\(userId\).*docId == 'info'/);
  assert.match(privateBlock, /allow list: if false;/);
  assert.match(privateBlock, /allow delete: if false;/);
});

test('Cross-workspace reads and writes are blocked on workspaces, projects, tasks, comments, messages, and activityLogs', () => {
  const wsBlock = getMatchBlock(rulesText, 'match /workspaces/{workspaceId}');
  assert.match(wsBlock, /allow get: if isVerifiedUser\(\) && isValidId\(workspaceId\) && isWorkspaceMember\(workspaceId\);/);
  assert.match(wsBlock, /allow list: if false;/);
  assert.match(wsBlock, /allow delete: if isVerifiedUser\(\)\s*&& isValidId\(workspaceId\)\s*&& isWorkspaceOwner\(workspaceId\);/);

  for (const header of [
    'match /projects/{projectId}',
    'match /tasks/{taskId}',
    'match /comments/{commentId}',
    'match /messages/{messageId}',
    'match /activityLogs/{logId}',
  ]) {
    const block = getMatchBlock(rulesText, header);
    assert.match(block, /allow get:[\s\S]*isWorkspaceMember\(existing\(\)\.workspaceId\)/);
    assert.match(block, /allow list:[\s\S]*isWorkspaceMember\(existing\(\)\.workspaceId\)/);
  }

  // Messages must verify channel belongs to workspace when not #general
  const msgBlock = getMatchBlock(rulesText, 'match /messages/{messageId}');
  assert.match(msgBlock, /incoming\(\)\.channelId == 'general'/);
  assert.match(msgBlock, /projects\/\$\(incoming\(\)\.channelId\)\)\.data\.workspaceId == incoming\(\)\.workspaceId/);

  // Tasks must verify project belongs to workspace, is not archived, and assignee is workspace member
  const taskBlock = getMatchBlock(rulesText, 'match /tasks/{taskId}');
  assert.match(taskBlock, /projects\/\$\(incoming\(\)\.projectId\)\)\.data\.workspaceId == incoming\(\)\.workspaceId/);
  assert.match(taskBlock, /projects\/\$\(incoming\(\)\.projectId\)\)\.data\.status != 'archived'/);
  assert.match(taskBlock, /isUserMemberOfWorkspace\(incoming\(\)\.workspaceId, incoming\(\)\.assigneeId\)/);

  // Comments must verify both workspaceId and projectId match parent task
  const commentBlock = getMatchBlock(rulesText, 'match /comments/{commentId}');
  assert.match(commentBlock, /tasks\/\$\(incoming\(\)\.taskId\)\)\.data\.workspaceId == incoming\(\)\.workspaceId/);
  assert.match(commentBlock, /tasks\/\$\(incoming\(\)\.taskId\)\)\.data\.projectId == incoming\(\)\.projectId/);
});

test('Notifications prevent cross-user reading and cross-workspace targeting', () => {
  const notifBlock = getMatchBlock(rulesText, 'match /notifications/{notificationId}');
  assert.match(notifBlock, /allow get:[\s\S]*existing\(\)\.userId == request\.auth\.uid/);
  assert.match(notifBlock, /allow list:[\s\S]*existing\(\)\.userId == request\.auth\.uid/);
  assert.match(notifBlock, /allow delete:[\s\S]*existing\(\)\.userId == request\.auth\.uid/);
  assert.match(notifBlock, /isWorkspaceMember\(incoming\(\)\.workspaceId\)/);
  assert.match(notifBlock, /isUserMemberOfWorkspace\(incoming\(\)\.workspaceId, incoming\(\)\.userId\)/);
  assert.match(notifBlock, /incoming\(\)\.userId != request\.auth\.uid/);
});

test('Invitations and workspaceMembers prevent hijacking, replay, self-invite, and role escalation', () => {
  const invBlock = getMatchBlock(rulesText, 'match /invitations/{invitationId}');
  assert.match(invBlock, /isWorkspaceAdminOrOwner\(incoming\(\)\.workspaceId\)/);
  assert.match(invBlock, /incoming\(\)\.inviteeEmail != callerEmailLower\(\)/);
  assert.match(invBlock, /existing\(\)\.status == 'pending'/);
  assert.match(invBlock, /existing\(\)\.inviteeEmail == callerEmailLower\(\)/);
  assert.match(invBlock, /existsAfter\(memberDocPath\(existing\(\)\.workspaceId, request\.auth\.uid\)\)/);

  const memberBlock = getMatchBlock(rulesText, 'match /workspaceMembers/{memberId}');
  assert.match(memberBlock, /incoming\(\)\.role in \['admin', 'member'\]/);
  assert.match(memberBlock, /isWorkspaceOwner\(existing\(\)\.workspaceId\)[\s\S]*existing\(\)\.role != 'owner'/);
  assert.match(memberBlock, /isWorkspaceAdminOrOwner\(existing\(\)\.workspaceId\) && existing\(\)\.role == 'member'/);
});

test('Activity logs are strictly append-only (no update or delete)', () => {
  const logBlock = getMatchBlock(rulesText, 'match /activityLogs/{logId}');
  assert.match(logBlock, /allow update: if false;/);
  assert.match(logBlock, /allow delete: if false;/);
});

test('Client boundary and sanitization helpers enforce blueprint volumetric constraints', () => {
  const oversized = 'A'.repeat(500);
  assert.equal(clampString(oversized, FIELD_LIMITS.WORKSPACE_NAME_MAX).length, FIELD_LIMITS.WORKSPACE_NAME_MAX);
  assert.match(slugify('!!!'), FIELD_LIMITS.SLUG_PATTERN);
  assert.match(deriveProjectKey('Alpha Release 2026'), FIELD_LIMITS.PROJECT_KEY_PATTERN);

  const mockMembers = Array.from({ length: 20 }, (_, i) => ({
    id: `ws_${i}`,
    workspaceId: 'ws',
    userId: `uid_${i}`,
    role: 'member' as const,
    displayName: `User${i}`,
    email: `u${i}@example.com`,
    photoURL: '',
    invitationId: '',
    joinedAt: null,
    updatedAt: null,
  })) satisfies WorkspaceMember[];

  const manyMentionsText = mockMembers.map((m) => `@${m.displayName}`).join(' ');
  const extracted = extractMentions(manyMentionsText, mockMembers);
  assert.equal(extracted.length, FIELD_LIMITS.MENTIONS_MAX);
});
