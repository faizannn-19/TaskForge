# TaskForge Firestore Security Specification (Phase 0 & Red Team Audit)

## 1. Data Invariants
1. **Verified Identity Gate**: Every read and write operation requires `request.auth != null` and `request.auth.token.email_verified == true`. Email-matched flows (invitations, workspace membership) also verify `request.auth.token.email` is a non-empty string and normalize via `.lower()`.
2. **PII Isolation & Owner-Scoped Users**: User email addresses and personal notification preferences are stored in `/users/{userId}/private/info` and restricted strictly to `request.auth.uid == userId`. `/users/{userId}` and `/users/{userId}/channelReads/{readId}` are likewise restricted to `isOwner(userId)` (`allow list: if false` on `/users/{userId}` and `/private`).
3. **Workspace Membership Master Gate**: Access to any workspace, project, task, comment, message, or activity log requires existence of `/workspaceMembers/{workspaceId}_{request.auth.uid}`. Removing a membership document immediately revokes access across all workspace resources, including editing/deleting prior comments or messages.
4. **Atomic Workspace Ownership & Role Hierarchy**:
   - Creating `/workspaces/{workspaceId}` atomically creates `/workspaceMembers/{workspaceId}_{uid}` with `role == 'owner'` via `existsAfter`/`getAfter`.
   - Only the workspace `owner` can delete a workspace or promote/demote member roles (`owner` role is immutable).
   - `admin` members can manage workspace settings, revoke invitations, and remove `'member'` accounts, but cannot remove other `'admin'`s or the `'owner'`.
5. **Anti-Abuse Invitations**:
   - Only `owner` or `admin` can create invitations (`role in ['admin', 'member']`), and cannot self-invite or target non-existent workspaces.
   - `inviteeEmail` is normalized lowercase and validated against an email pattern.
   - Invitations are locked once out of `'pending'` (`accepted`, `declined`, `revoked` are terminal).
   - Accepting an invitation requires `request.auth.token.email.lower() == inviteeEmail` and atomically verifies membership creation via `existsAfter(memberDocPath(...))`.
6. **Cross-Workspace & Parent Integrity**:
   - Projects verify workspace existence; archived projects lock updates to workspace admins/owners (`existing().status != 'archived' || isWorkspaceAdminOrOwner(...)`).
   - Tasks verify parent project exists in the same workspace, is not archived, and any non-empty `assigneeId` is a member of the workspace.
   - Comments verify parent task exists and matches both `workspaceId` and `projectId`.
   - Messages verify `channelId == 'general'` OR `channelId` is a project belonging to the same `workspaceId`.
   - Notifications restrict reads/updates/deletes strictly to `existing().userId == request.auth.uid` and require on `create` that both actor AND recipient (`incoming().userId`) are members of `incoming().workspaceId`.
   - Activity logs verify optional `projectId`/`taskId` belong to the declared `workspaceId` and forbid all `update`/`delete` mutations.
7. **Temporal, Author, Key & Size Enforcement**: All timestamps enforce `request.time`, author/reporter UIDs enforce `request.auth.uid`, updates whitelist exact `affectedKeys().hasOnly(...)`, path variables enforce `isValidId()`, and every string/list enforces strict bounds.

## 2. Adversarial Scenarios Verified
1. **Shadow Field Injection** (`isVerified: true` on workspace/task/project) -> Rejected by `keys().hasOnly(...)`.
2. **Self-Assigned Owner/Admin Escalation** (`workspaceMembers/ws_attacker` with `role: 'owner'` or `'admin'` without valid invitation) -> Rejected.
3. **Cross-Workspace Project/Task/Comment/Message Read or Write** -> Rejected by `isWorkspaceMember(workspaceId)` and parent `workspaceId` checks.
4. **Cross-Workspace Notification Abuse** (Workspace A member sending notification to non-member UID) -> Rejected by `isUserMemberOfWorkspace(incoming().workspaceId, incoming().userId)`.
5. **Cross-Workspace Chat Channel Spoofing** (Posting to Workspace B project ID under Workspace A) -> Rejected by project `workspaceId` match on `messages`.
6. **Invitation Hijacking & Replay** (Wrong email, self-invite, accepting revoked/declined invite, or accepting without creating membership doc) -> Rejected.
7. **Admin-on-Admin Removal & Owner Deletion by Admin** -> Rejected (`existing().role == 'member'` for admin deletes; `isWorkspaceOwner` for workspace delete/role change).
8. **Notification Snooping** (`get`/`list` another member's notification) -> Rejected (`existing().userId == request.auth.uid`).
9. **Archived Project Task Injection / Progress Tampering** -> Rejected (`status != 'archived'`).
10. **PII Scrape Attempt** (`get`/`list` `/users/{otherUid}` or `/users/{otherUid}/private/info`) -> Rejected (`isOwner(userId)`).
11. **ID Poisoning & Unbounded Lists** (>128 char IDs, special chars, >8 labels, >25 subtasks) -> Rejected.
12. **Unverified Email Bypass & Forged Client Timestamps** -> Rejected (`email_verified == true` and `request.time`).
