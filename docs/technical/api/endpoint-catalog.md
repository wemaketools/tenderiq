# Endpoint catalog (as built)

Status: As-built (Stage A prototype); backend sections as-designed

Generated on 2026-09-30 from `src/contracts/catalog.ts` (`ENDPOINT_MAPS`, 25 contract modules, **919 endpoints**). Together with [openapi.json](openapi.json) (`npm run docs:api`: 920 operations, the 919 contract endpoints plus `GET /api/v1/health`) this file is the authoritative list of the API surface that the Stage A mock API serves and that Stage B must implement unchanged ([07-api.md §13](../07-api.md#13-endpoint-catalog-by-domain)).

How to read a row:
- **Id** is the stable `defineEndpoint` id, used as the OpenAPI `operationId` and by the mock API's route table.
- **Path** is relative to `/api/v1`. Its first segment is the audience: `public`, `me`, `buyer`, `supplier` or `ops` ([07-api.md §2.2](../07-api.md#22-audience-prefixes)).
- **Permission** lists the permission codes of the endpoint; several codes mean "any of these", and the handler then applies the subject-specific check. A dash means that no permission code is declared: a `public` endpoint, or a `me` endpoint that needs authentication only.
- **Screens** are the PRD screen ids whose pages call the endpoint (`screens` of the contract).
- **Flags**: `idempotent` accepts an optional `Idempotency-Key` header (DD-39); `row tenant` is a `/me` action whose `X-Tenant-Id` must be the row's tenant (DD-21); `support: metadata|records` opens the endpoint to an operator's support grant (OPS-04); a number is a success status other than 200.

Totals by audience: buyer 583, supplier 195, ops 63, me 49, public 29. 160 endpoints are idempotent, 12 are row-tenant `/me` actions, 3 accept a support grant, and 107 distinct permission codes are used.

## 00 Workspace: session and shared services

### `src/contracts/session.ts` (2 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `me.session.context` | GET | `/me/context` | — | COM-01, COM-02, COM-03 | — |
| `me.session.updateTheme` | PUT | `/me/theme` | — | COM-03 | — |

### `src/contracts/tasks.ts` (7 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `me.tasks.list` | GET | `/me/tasks` | — | COM-04 | — |
| `me.tasks.summary` | GET | `/me/task-summary` | — | COM-04, BUY-01, SUP-01 | — |
| `me.tasks.get` | GET | `/me/tasks/:taskId` | — | COM-04 | — |
| `me.tasks.complete` | POST | `/me/tasks/:taskId/complete` | — | COM-04 | row tenant |
| `me.tasks.return` | POST | `/me/tasks/:taskId/return` | — | COM-04 | row tenant |
| `me.tasks.reassign` | POST | `/me/tasks/:taskId/reassign` | — | COM-04 | row tenant |
| `me.tasks.reassignCandidates` | GET | `/me/tasks/:taskId/reassign-candidates` | — | COM-04 | — |

### `src/contracts/notifications.ts` (7 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `me.notifications.list` | GET | `/me/notifications` | — | COM-06 | — |
| `me.notifications.summary` | GET | `/me/notification-summary` | — | COM-06, BUY-01, SUP-01 | — |
| `me.notifications.markRead` | POST | `/me/notifications/:notificationId/read` | — | COM-06 | row tenant |
| `me.notifications.markAllRead` | POST | `/me/notifications/read-all` | — | COM-06 | — |
| `me.notifications.acknowledge` | POST | `/me/notifications/:notificationId/acknowledge` | — | COM-06 | row tenant |
| `me.notifications.preferences` | GET | `/me/notification-preferences` | — | COM-03, COM-06 | — |
| `me.notifications.updatePreferences` | PUT | `/me/notification-preferences` | — | COM-03 | — |

### `src/contracts/notification-rules.ts` (8 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.notificationRules.list` | GET | `/buyer/notification-rules` | `org.notifications.manage` | ADM-12 | — |
| `buyer.notificationRules.get` | GET | `/buyer/notification-rules/:ruleId` | `org.notifications.manage` | ADM-12 | — |
| `buyer.notificationRules.create` | POST | `/buyer/notification-rules` | `org.notifications.manage` | ADM-12 | idempotent, 201 |
| `buyer.notificationRules.update` | PUT | `/buyer/notification-rules/:ruleId` | `org.notifications.manage` | ADM-12 | — |
| `buyer.notificationRules.setStatus` | POST | `/buyer/notification-rules/:ruleId/status` | `org.notifications.manage` | ADM-12 | — |
| `buyer.notificationRules.preview` | POST | `/buyer/notification-rule-preview` | `org.notifications.manage` | ADM-12 | — |
| `buyer.notificationRules.events` | GET | `/buyer/notification-events` | `org.notifications.manage` | ADM-12 | — |
| `buyer.notificationRules.deliveryExceptions` | GET | `/buyer/notification-delivery-exceptions` | `org.notifications.manage` | ADM-12, COM-06 | — |

### `src/contracts/approvals.ts` (8 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `me.approvals.list` | GET | `/me/approvals` | — | COM-04, COM-05 | — |
| `me.approvals.get` | GET | `/me/approvals/:approvalId` | — | COM-05 | — |
| `me.approvals.decide` | POST | `/me/approvals/:approvalId/decide` | `approval.decide` | COM-05 | row tenant |
| `buyer.approvals.forSubject` | GET | `/buyer/approvals/subjects/:subjectType/:subjectId` | `request.create`, `request.approve`, `request.view_all`, `request.review`, `audit.view`, `request.funding_confirm`, `strategy.manage`, `strategy.approve`, `tender.edit`, `tender.release_approve`, `tender.view`, `tender.clarifications.manage`, `tender.addenda.approve`, `compliance.assess`, `exclusion.approve`, `evaluation.chair`, `bid.monitor`, `selection.manage`, `shortlist.approve`, `negotiation.conduct`, `negotiation.approve`, `award.recommend`, `award.approve`, `contract.prepare`, `contract.approve`, `contract.view`, `contract.sign`, `contract.manage`, `contract.change.approve`, `contract.renewal.decide`, `qualification.review`, `qualification.decide`, `org.policy.manage`, `org.policy.approve`, `org.templates.manage`, `org.templates.approve`, `records.retention.manage`, `records.disposal.approve`, `tender.cancel`, `records.hold.manage` | BUY-04, BUY-06, BUY-13, BUY-17, BUY-21, BUY-23, BUY-24, BUY-25, BUY-26, BUY-29, BUY-35, CON-02, CON-05, CON-08, CON-09, ADM-06, ADM-08, ADM-14 | — |
| `buyer.approvals.get` | GET | `/buyer/approvals/:approvalId` | `request.create`, `request.approve`, `request.view_all`, `request.review`, `audit.view`, `request.funding_confirm`, `strategy.manage`, `strategy.approve`, `tender.edit`, `tender.release_approve`, `tender.view`, `tender.clarifications.manage`, `tender.addenda.approve`, `compliance.assess`, `exclusion.approve`, `evaluation.chair`, `bid.monitor`, `selection.manage`, `shortlist.approve`, `negotiation.conduct`, `negotiation.approve`, `award.recommend`, `award.approve`, `contract.prepare`, `contract.approve`, `contract.view`, `contract.sign`, `contract.manage`, `contract.change.approve`, `contract.renewal.decide`, `qualification.review`, `qualification.decide`, `org.policy.manage`, `org.policy.approve`, `org.templates.manage`, `org.templates.approve`, `records.retention.manage`, `records.disposal.approve`, `tender.cancel`, `records.hold.manage` | COM-05, BUY-04, BUY-06, BUY-13, BUY-17, BUY-21, BUY-23, BUY-24, BUY-25, BUY-26, BUY-29, BUY-35, CON-02, CON-05, CON-08, CON-09, ADM-06, ADM-08, ADM-14 | — |
| `buyer.approvals.request` | POST | `/buyer/approvals` | `request.create`, `request.review`, `strategy.manage`, `tender.edit`, `tender.clarifications.manage`, `compliance.assess`, `selection.manage`, `negotiation.conduct`, `award.recommend`, `contract.prepare`, `contract.manage`, `qualification.review`, `org.policy.manage`, `org.templates.manage`, `records.retention.manage`, `records.hold.manage` | BUY-04, BUY-06, BUY-13, BUY-17, BUY-21, BUY-23, BUY-24, BUY-25, BUY-26, BUY-29, BUY-35, CON-02, CON-05, CON-08, CON-09, ADM-06, ADM-08, ADM-14 | idempotent, 201 |
| `buyer.approvals.withdraw` | POST | `/buyer/approvals/:approvalId/withdraw` | `request.create`, `request.review`, `strategy.manage`, `tender.edit`, `tender.clarifications.manage`, `compliance.assess`, `selection.manage`, `negotiation.conduct`, `award.recommend`, `contract.prepare`, `contract.manage`, `qualification.review`, `org.policy.manage`, `org.templates.manage`, `records.retention.manage`, `records.hold.manage` | BUY-04, BUY-06, BUY-13, BUY-17, BUY-21, BUY-23, BUY-24, BUY-25, BUY-26, BUY-29, BUY-35, CON-02, CON-05, CON-08, CON-09, ADM-06, ADM-08, ADM-14 | — |
| `buyer.approvals.authorityCheck` | GET | `/buyer/approval-authority-check` | `request.create`, `request.review`, `strategy.manage`, `tender.edit`, `tender.clarifications.manage`, `compliance.assess`, `selection.manage`, `negotiation.conduct`, `award.recommend`, `contract.prepare`, `contract.manage`, `qualification.review`, `org.policy.manage`, `org.templates.manage`, `records.retention.manage`, `records.hold.manage` | BUY-04, BUY-06, BUY-13, BUY-17, BUY-21, BUY-23, BUY-24, BUY-25, BUY-26, BUY-29, BUY-35, CON-02, CON-05, CON-08, CON-09, ADM-06, ADM-08, ADM-14 | — |

### `src/contracts/documents.ts` (11 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `me.documents.list` | GET | `/me/documents` | — | COM-07 | — |
| `me.documents.get` | GET | `/me/documents/:documentId` | — | COM-07 | — |
| `me.documents.versions` | GET | `/me/documents/:documentId/versions` | — | COM-07 | — |
| `me.documents.download` | GET | `/me/documents/:documentId/versions/:versionId/download` | — | COM-07 | — |
| `buyer.documents.list` | GET | `/buyer/documents` | `request.create`, `request.view_all`, `strategy.manage`, `tender.view`, `tender.edit`, `tender.clarifications.manage`, `supplier.directory.view`, `qualification.review`, `qualification.financial_review`, `evaluation.score`, `evaluation.chair`, `selection.manage`, `award.recommend`, `notice.issue`, `complaint.manage`, `contract.view`, `contract.manage`, `org.templates.manage`, `org.policy.manage`, `org.imports.manage`, `export.create`, `audit.view` | COM-07, BUY-03, BUY-06, BUY-09, BUY-17, BUY-34, BUY-29, CON-01, CON-03, CON-05, ADM-08 | — |
| `supplier.documents.list` | GET | `/supplier/documents` | `supplier.opportunities.view`, `supplier.response.edit`, `supplier.pricing.edit`, `supplier.evidence.manage`, `supplier.org.manage`, `supplier.qualification.apply`, `supplier.complaint.submit`, `supplier.contract.participate` | COM-07, SUP-05, SUP-08, SUP-12, SUP-20, SUP-22, SUP-23 | — |
| `buyer.documents.createUpload` | POST | `/buyer/documents/uploads` | `request.create`, `strategy.manage`, `tender.edit`, `tender.clarifications.manage`, `tender.sessions.manage`, `qualification.review`, `evaluation.chair`, `selection.manage`, `diligence.manage`, `award.recommend`, `notice.issue`, `complaint.manage`, `contract.prepare`, `contract.manage`, `org.templates.manage`, `org.policy.manage`, `org.imports.manage` | COM-07, BUY-03, BUY-06, BUY-09, BUY-17, BUY-34, BUY-29, CON-01, CON-03, CON-05, ADM-08 | idempotent, 201 |
| `supplier.documents.createUpload` | POST | `/supplier/documents/uploads` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.evidence.manage`, `supplier.org.manage`, `supplier.qualification.apply`, `supplier.complaint.submit`, `supplier.contract.participate` | COM-07, SUP-05, SUP-08, SUP-12, SUP-20, SUP-22, SUP-23 | idempotent, 201 |
| `buyer.documents.confirmUpload` | POST | `/buyer/documents/uploads/:versionId/confirm` | `request.create`, `strategy.manage`, `tender.edit`, `tender.clarifications.manage`, `tender.sessions.manage`, `qualification.review`, `evaluation.chair`, `selection.manage`, `diligence.manage`, `award.recommend`, `notice.issue`, `complaint.manage`, `contract.prepare`, `contract.manage`, `org.templates.manage`, `org.policy.manage`, `org.imports.manage` | COM-07, BUY-03, BUY-06, BUY-09, BUY-17, BUY-34, BUY-29, CON-01, CON-03, CON-05, ADM-08 | — |
| `supplier.documents.confirmUpload` | POST | `/supplier/documents/uploads/:versionId/confirm` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.evidence.manage`, `supplier.org.manage`, `supplier.qualification.apply`, `supplier.complaint.submit`, `supplier.contract.participate` | COM-07, SUP-05, SUP-08, SUP-12, SUP-20, SUP-22, SUP-23 | — |
| `buyer.documents.createRedactedCopy` | POST | `/buyer/documents/:documentId/redacted-copies` | `notice.issue`, `complaint.manage`, `tender.clarifications.manage`, `contract.manage`, `export.create` | COM-07, BUY-28, BUY-29 | idempotent, 201 |

### `src/contracts/audit.ts` (1 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.audit.entityHistory` | GET | `/buyer/audit/entities/:entityType/:entityId` | `audit.view` | ADM-14, BUY-07, BUY-04, CON-01, BUY-33 | — |

### `src/contracts/calendars.ts` (11 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.calendars.list` | GET | `/buyer/calendars` | `org.calendars.manage`, `tender.edit`, `tender.view`, `support.view` | ADM-10, BUY-08 | support: metadata |
| `buyer.calendars.get` | GET | `/buyer/calendars/:calendarId` | `org.calendars.manage`, `tender.edit`, `tender.view`, `support.view` | ADM-10 | support: metadata |
| `buyer.calendars.create` | POST | `/buyer/calendars` | `org.calendars.manage` | ADM-10 | idempotent, 201 |
| `buyer.calendars.update` | PUT | `/buyer/calendars/:calendarId` | `org.calendars.manage` | ADM-10 | — |
| `buyer.calendars.addHoliday` | POST | `/buyer/calendars/:calendarId/holidays` | `org.calendars.manage` | ADM-10 | idempotent, 201 |
| `buyer.calendars.removeHoliday` | DELETE | `/buyer/calendars/:calendarId/holidays/:holidayId` | `org.calendars.manage` | ADM-10 | — |
| `buyer.calendars.impactReview` | POST | `/buyer/calendars/:calendarId/impact-review` | `org.calendars.manage` | ADM-10 | — |
| `buyer.calendars.approve` | POST | `/buyer/calendars/:calendarId/approve` | `org.calendars.manage` | ADM-10 | — |
| `buyer.calendars.retire` | POST | `/buyer/calendars/:calendarId/retire` | `org.calendars.manage` | ADM-10 | — |
| `buyer.calendars.setDefault` | POST | `/buyer/calendars/:calendarId/set-default` | `org.calendars.manage` | ADM-10 | — |
| `buyer.calendars.deadlinePolicy` | GET | `/buyer/deadline-policy` | `org.calendars.manage`, `tender.edit`, `tender.view`, `support.view` | ADM-10 | support: metadata |

## 01 Identity and organization administration

### `src/contracts/org-admin.ts` (129 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `public.invitations.preview` | GET | `/public/invitations/:token` | — | COM-01 | — |
| `me.invitations.accept` | POST | `/me/invitations/:token/accept` | — | COM-01 | — |
| `me.memberships.list` | GET | `/me/memberships` | — | COM-02, COM-03 | — |
| `me.memberships.withdrawRequest` | POST | `/me/memberships/:membershipId/withdraw-request` | — | COM-02 | — |
| `me.memberships.leave` | POST | `/me/memberships/:membershipId/leave` | — | COM-02, COM-03 | — |
| `me.profile.get` | GET | `/me/profile` | — | COM-03 | — |
| `me.profile.update` | PUT | `/me/profile` | — | COM-03 | — |
| `me.profile.requestContactChange` | POST | `/me/profile/contact-changes` | — | COM-03 | idempotent, 201 |
| `me.profile.cancelContactChange` | POST | `/me/profile/contact-changes/:changeId/cancel` | — | COM-03 | — |
| `me.profile.access` | GET | `/me/access-summary` | — | COM-03 | — |
| `buyer.admin.users.list` | GET | `/buyer/admin/users` | `org.users.view`, `org.users.manage` | ADM-03 | — |
| `buyer.admin.users.get` | GET | `/buyer/admin/users/:userId` | `org.users.view`, `org.users.manage` | ADM-03 | — |
| `buyer.admin.users.update` | PATCH | `/buyer/admin/users/:userId` | `org.users.manage` | ADM-03 | — |
| `buyer.admin.invitations.create` | POST | `/buyer/admin/invitations` | `org.users.manage` | ADM-03 | idempotent, 201 |
| `buyer.admin.invitations.list` | GET | `/buyer/admin/invitations` | `org.users.view`, `org.users.manage` | ADM-03 | — |
| `buyer.admin.invitations.reissue` | POST | `/buyer/admin/invitations/:invitationId/reissue` | `org.users.manage` | ADM-03 | — |
| `buyer.admin.invitations.revoke` | POST | `/buyer/admin/invitations/:invitationId/revoke` | `org.users.manage` | ADM-03 | — |
| `buyer.admin.users.activate` | POST | `/buyer/admin/users/:userId/activate` | `org.users.manage` | ADM-03 | — |
| `buyer.admin.users.approveMembership` | POST | `/buyer/admin/users/:userId/approve-membership` | `org.users.manage` | ADM-03 | — |
| `buyer.admin.users.rejectMembership` | POST | `/buyer/admin/users/:userId/reject-membership` | `org.users.manage` | ADM-03 | — |
| `buyer.admin.users.suspend` | POST | `/buyer/admin/users/:userId/suspend` | `org.users.manage` | ADM-03 | — |
| `buyer.admin.users.deactivationReview` | GET | `/buyer/admin/users/:userId/deactivation-review` | `org.users.manage` | ADM-03 | — |
| `buyer.admin.users.deactivate` | POST | `/buyer/admin/users/:userId/deactivate` | `org.users.manage` | ADM-03 | — |
| `buyer.admin.users.reassignWork` | POST | `/buyer/admin/users/:userId/reassign-work` | `org.users.manage` | ADM-03 | — |
| `buyer.admin.users.recover` | POST | `/buyer/admin/users/:userId/recover` | `org.users.manage` | ADM-03 | — |
| `buyer.admin.users.addRole` | POST | `/buyer/admin/users/:userId/role-assignments` | `org.roles.manage` | ADM-03, ADM-04 | idempotent, 201 |
| `buyer.admin.users.revokeRole` | POST | `/buyer/admin/users/:userId/role-assignments/:assignmentId/revoke` | `org.roles.manage` | ADM-03, ADM-04 | — |
| `buyer.admin.roles.list` | GET | `/buyer/admin/roles` | `org.roles.manage`, `org.access.review`, `org.users.manage` | ADM-04 | — |
| `buyer.admin.roles.get` | GET | `/buyer/admin/roles/:roleId` | `org.roles.manage`, `org.access.review`, `org.users.manage` | ADM-04 | — |
| `buyer.admin.roles.catalog` | GET | `/buyer/admin/role-catalog` | `org.roles.manage`, `org.access.review`, `org.users.manage` | ADM-04 | — |
| `buyer.admin.roles.create` | POST | `/buyer/admin/roles` | `org.roles.manage` | ADM-04 | idempotent, 201 |
| `buyer.admin.roles.update` | PUT | `/buyer/admin/roles/:roleId` | `org.roles.manage` | ADM-04 | — |
| `buyer.admin.roles.deactivate` | POST | `/buyer/admin/roles/:roleId/deactivate` | `org.roles.manage` | ADM-04 | — |
| `buyer.admin.groups.list` | GET | `/buyer/admin/groups` | `org.roles.manage`, `org.access.review`, `org.users.manage` | ADM-04 | — |
| `buyer.admin.groups.get` | GET | `/buyer/admin/groups/:groupId` | `org.roles.manage`, `org.access.review`, `org.users.manage` | ADM-04 | — |
| `buyer.admin.groups.create` | POST | `/buyer/admin/groups` | `org.roles.manage` | ADM-04 | idempotent, 201 |
| `buyer.admin.groups.deactivate` | POST | `/buyer/admin/groups/:groupId/deactivate` | `org.roles.manage` | ADM-04 | — |
| `buyer.admin.groups.addMember` | POST | `/buyer/admin/groups/:groupId/members` | `org.roles.manage` | ADM-04 | — |
| `buyer.admin.groups.removeMember` | POST | `/buyer/admin/groups/:groupId/members/:userId/remove` | `org.roles.manage` | ADM-04 | — |
| `supplier.admin.users.list` | GET | `/supplier/admin/users` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.users.get` | GET | `/supplier/admin/users/:userId` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.users.update` | PATCH | `/supplier/admin/users/:userId` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.invitations.create` | POST | `/supplier/admin/invitations` | `supplier.users.manage` | SUP-04 | idempotent, 201 |
| `supplier.admin.invitations.list` | GET | `/supplier/admin/invitations` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.invitations.reissue` | POST | `/supplier/admin/invitations/:invitationId/reissue` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.invitations.revoke` | POST | `/supplier/admin/invitations/:invitationId/revoke` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.users.activate` | POST | `/supplier/admin/users/:userId/activate` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.users.approveMembership` | POST | `/supplier/admin/users/:userId/approve-membership` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.users.rejectMembership` | POST | `/supplier/admin/users/:userId/reject-membership` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.users.suspend` | POST | `/supplier/admin/users/:userId/suspend` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.users.deactivationReview` | GET | `/supplier/admin/users/:userId/deactivation-review` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.users.deactivate` | POST | `/supplier/admin/users/:userId/deactivate` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.users.reassignWork` | POST | `/supplier/admin/users/:userId/reassign-work` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.users.recover` | POST | `/supplier/admin/users/:userId/recover` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.users.addRole` | POST | `/supplier/admin/users/:userId/role-assignments` | `supplier.users.manage` | SUP-04, SUP-04 | idempotent, 201 |
| `supplier.admin.users.revokeRole` | POST | `/supplier/admin/users/:userId/role-assignments/:assignmentId/revoke` | `supplier.users.manage` | SUP-04, SUP-04 | — |
| `supplier.admin.roles.list` | GET | `/supplier/admin/roles` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.roles.get` | GET | `/supplier/admin/roles/:roleId` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.roles.catalog` | GET | `/supplier/admin/role-catalog` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.roles.create` | POST | `/supplier/admin/roles` | `supplier.users.manage` | SUP-04 | idempotent, 201 |
| `supplier.admin.roles.update` | PUT | `/supplier/admin/roles/:roleId` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.roles.deactivate` | POST | `/supplier/admin/roles/:roleId/deactivate` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.groups.list` | GET | `/supplier/admin/groups` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.groups.get` | GET | `/supplier/admin/groups/:groupId` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.groups.create` | POST | `/supplier/admin/groups` | `supplier.users.manage` | SUP-04 | idempotent, 201 |
| `supplier.admin.groups.deactivate` | POST | `/supplier/admin/groups/:groupId/deactivate` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.groups.addMember` | POST | `/supplier/admin/groups/:groupId/members` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.groups.removeMember` | POST | `/supplier/admin/groups/:groupId/members/:userId/remove` | `supplier.users.manage` | SUP-04 | — |
| `buyer.admin.organization.get` | GET | `/buyer/admin/organization` | `org.settings.manage`, `org.structure.manage` | ADM-01 | — |
| `buyer.admin.organization.impactReview` | POST | `/buyer/admin/organization/impact-review` | `org.settings.manage` | ADM-01 | — |
| `buyer.admin.organization.update` | PUT | `/buyer/admin/organization` | `org.settings.manage` | ADM-01 | — |
| `buyer.admin.legalEntities.list` | GET | `/buyer/admin/legal-entities` | `org.structure.manage`, `org.settings.manage` | ADM-01 | — |
| `buyer.admin.legalEntities.create` | POST | `/buyer/admin/legal-entities` | `org.structure.manage` | ADM-01 | idempotent, 201 |
| `buyer.admin.legalEntities.update` | PUT | `/buyer/admin/legal-entities/:valueId` | `org.structure.manage` | ADM-01 | — |
| `buyer.admin.legalEntities.deactivate` | POST | `/buyer/admin/legal-entities/:valueId/deactivate` | `org.structure.manage` | ADM-01 | — |
| `buyer.admin.departments.list` | GET | `/buyer/admin/departments` | `org.structure.manage`, `org.settings.manage` | ADM-02 | — |
| `buyer.admin.departments.create` | POST | `/buyer/admin/departments` | `org.structure.manage` | ADM-02 | idempotent, 201 |
| `buyer.admin.departments.update` | PUT | `/buyer/admin/departments/:valueId` | `org.structure.manage` | ADM-02 | — |
| `buyer.admin.departments.deactivate` | POST | `/buyer/admin/departments/:valueId/deactivate` | `org.structure.manage` | ADM-02 | — |
| `buyer.admin.locations.list` | GET | `/buyer/admin/locations` | `org.structure.manage`, `org.settings.manage` | ADM-02 | — |
| `buyer.admin.locations.create` | POST | `/buyer/admin/locations` | `org.structure.manage` | ADM-02 | idempotent, 201 |
| `buyer.admin.locations.update` | PUT | `/buyer/admin/locations/:valueId` | `org.structure.manage` | ADM-02 | — |
| `buyer.admin.locations.deactivate` | POST | `/buyer/admin/locations/:valueId/deactivate` | `org.structure.manage` | ADM-02 | — |
| `buyer.admin.categories.list` | GET | `/buyer/admin/categories` | `org.structure.manage`, `org.settings.manage` | ADM-02 | — |
| `buyer.admin.categories.create` | POST | `/buyer/admin/categories` | `org.structure.manage` | ADM-02 | idempotent, 201 |
| `buyer.admin.categories.update` | PUT | `/buyer/admin/categories/:valueId` | `org.structure.manage` | ADM-02 | — |
| `buyer.admin.categories.deactivate` | POST | `/buyer/admin/categories/:valueId/deactivate` | `org.structure.manage` | ADM-02 | — |
| `buyer.admin.costCenters.list` | GET | `/buyer/admin/cost-centers` | `org.structure.manage`, `org.settings.manage` | ADM-02 | — |
| `buyer.admin.costCenters.create` | POST | `/buyer/admin/cost-centers` | `org.structure.manage` | ADM-02 | idempotent, 201 |
| `buyer.admin.costCenters.update` | PUT | `/buyer/admin/cost-centers/:valueId` | `org.structure.manage` | ADM-02 | — |
| `buyer.admin.costCenters.deactivate` | POST | `/buyer/admin/cost-centers/:valueId/deactivate` | `org.structure.manage` | ADM-02 | — |
| `buyer.admin.fundingSources.list` | GET | `/buyer/admin/funding-sources` | `org.structure.manage`, `org.settings.manage` | ADM-02 | — |
| `buyer.admin.fundingSources.create` | POST | `/buyer/admin/funding-sources` | `org.structure.manage` | ADM-02 | idempotent, 201 |
| `buyer.admin.fundingSources.update` | PUT | `/buyer/admin/funding-sources/:valueId` | `org.structure.manage` | ADM-02 | — |
| `buyer.admin.fundingSources.deactivate` | POST | `/buyer/admin/funding-sources/:valueId/deactivate` | `org.structure.manage` | ADM-02 | — |
| `buyer.admin.categoryCatalog.list` | GET | `/buyer/admin/category-catalog` | `org.structure.manage`, `org.settings.manage` | ADM-02 | — |
| `buyer.admin.grants.list` | GET | `/buyer/admin/access-grants` | `org.access.review`, `org.roles.manage` | ADM-04 | — |
| `buyer.admin.grants.create` | POST | `/buyer/admin/access-grants` | `org.roles.manage` | ADM-04, ADM-03 | idempotent, 201 |
| `buyer.admin.grants.revoke` | POST | `/buyer/admin/access-grants/:grantId/revoke` | `org.roles.manage` | ADM-04 | — |
| `buyer.admin.grants.extend` | POST | `/buyer/admin/access-grants/:grantId/extend` | `org.roles.manage` | ADM-04 | — |
| `buyer.admin.restrictions.list` | GET | `/buyer/admin/access-restrictions` | `org.access.review`, `org.roles.manage` | ADM-04 | — |
| `buyer.admin.restrictions.create` | POST | `/buyer/admin/access-restrictions` | `org.roles.manage` | ADM-04 | idempotent, 201 |
| `buyer.admin.restrictions.lift` | POST | `/buyer/admin/access-restrictions/:restrictionId/lift` | `org.roles.manage` | ADM-04 | — |
| `buyer.admin.access.effective` | GET | `/buyer/admin/access/users/:userId` | `org.access.review`, `org.roles.manage` | ADM-04, ADM-03 | — |
| `buyer.admin.access.findings` | GET | `/buyer/admin/access/findings` | `org.access.review` | ADM-04 | — |
| `buyer.admin.conflicts.list` | GET | `/buyer/admin/conflict-declarations` | `org.access.review`, `evaluation.chair` | ADM-04 | — |
| `buyer.admin.conflicts.get` | GET | `/buyer/admin/conflict-declarations/:declarationId` | `org.access.review`, `evaluation.chair` | ADM-04 | — |
| `buyer.admin.conflicts.decide` | POST | `/buyer/admin/conflict-declarations/:declarationId/decide` | `org.access.review`, `evaluation.chair` | ADM-04 | — |
| `buyer.admin.sod.list` | GET | `/buyer/admin/sod-policies` | `org.authority.manage`, `org.access.review` | ADM-05, ADM-04 | — |
| `buyer.admin.sod.update` | PUT | `/buyer/admin/sod-policies/:ruleCode` | `org.authority.manage` | ADM-05 | — |
| `buyer.admin.authorityLimits.list` | GET | `/buyer/admin/authority-limits` | `org.authority.manage`, `org.access.review` | ADM-05 | — |
| `buyer.admin.authorityLimits.create` | POST | `/buyer/admin/authority-limits` | `org.authority.manage` | ADM-05 | idempotent, 201 |
| `buyer.admin.authorityLimits.end` | POST | `/buyer/admin/authority-limits/:limitId/end` | `org.authority.manage` | ADM-05 | — |
| `buyer.admin.delegations.list` | GET | `/buyer/admin/delegations` | `org.authority.manage`, `org.access.review` | ADM-05, ADM-03 | — |
| `buyer.admin.delegations.create` | POST | `/buyer/admin/delegations` | `org.authority.manage` | ADM-05 | idempotent, 201 |
| `buyer.admin.delegations.revoke` | POST | `/buyer/admin/delegations/:delegationId/revoke` | `org.authority.manage` | ADM-05, ADM-03 | — |
| `buyer.admin.committees.list` | GET | `/buyer/admin/committees` | `org.authority.manage`, `org.structure.manage` | ADM-05 | — |
| `buyer.admin.committees.get` | GET | `/buyer/admin/committees/:committeeId` | `org.authority.manage`, `org.structure.manage` | ADM-05 | — |
| `buyer.admin.committees.create` | POST | `/buyer/admin/committees` | `org.authority.manage` | ADM-05 | idempotent, 201 |
| `buyer.admin.committees.addMember` | POST | `/buyer/admin/committees/:committeeId/members` | `org.authority.manage` | ADM-05 | — |
| `buyer.admin.committees.endMember` | POST | `/buyer/admin/committees/:committeeId/members/:memberId/end` | `org.authority.manage` | ADM-05 | — |
| `buyer.admin.committees.deactivate` | POST | `/buyer/admin/committees/:committeeId/deactivate` | `org.authority.manage` | ADM-05 | — |
| `supplier.admin.assignableTenders.list` | GET | `/supplier/admin/assignable-tenders` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.assignments.list` | GET | `/supplier/admin/tender-assignments` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.assignments.create` | POST | `/supplier/admin/tender-assignments` | `supplier.users.manage` | SUP-04 | idempotent, 201 |
| `supplier.admin.assignments.end` | POST | `/supplier/admin/tender-assignments/:assignmentId/end` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.authority.list` | GET | `/supplier/admin/authority` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.authority.setSigningLimit` | PUT | `/supplier/admin/authority/:userId/signing-limit` | `supplier.users.manage` | SUP-04 | — |
| `supplier.admin.authority.setSubmission` | PUT | `/supplier/admin/authority/:userId/submission` | `supplier.users.manage` | SUP-04 | — |

## 02 Policy

### `src/contracts/policy.ts` (43 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.policy.listProfiles` | GET | `/buyer/policy/profiles` | `org.policy.manage`, `org.policy.approve`, `audit.view` | ADM-06 | — |
| `buyer.policy.getProfile` | GET | `/buyer/policy/profiles/:profileId` | `org.policy.manage`, `org.policy.approve`, `audit.view` | ADM-06 | — |
| `buyer.policy.getVersion` | GET | `/buyer/policy/profiles/:profileId/versions/:versionId` | `org.policy.manage`, `org.policy.approve`, `audit.view` | ADM-06 | — |
| `buyer.policy.compareVersions` | GET | `/buyer/policy/profiles/:profileId/versions/:versionId/comparison` | `org.policy.manage`, `org.policy.approve`, `audit.view` | ADM-06 | — |
| `buyer.policy.createProfile` | POST | `/buyer/policy/profiles` | `org.policy.manage` | ADM-06 | idempotent, 201 |
| `buyer.policy.createVersion` | POST | `/buyer/policy/profiles/:profileId/versions` | `org.policy.manage` | ADM-06 | idempotent, 201 |
| `buyer.policy.updateVersion` | PUT | `/buyer/policy/profiles/:profileId/versions/:versionId` | `org.policy.manage` | ADM-06 | — |
| `buyer.policy.submitVersion` | POST | `/buyer/policy/profiles/:profileId/versions/:versionId/submit` | `org.policy.manage` | ADM-06 | — |
| `buyer.policy.approveVersion` | POST | `/buyer/policy/profiles/:profileId/versions/:versionId/approve` | `org.policy.approve` | ADM-06 | — |
| `buyer.policy.returnVersion` | POST | `/buyer/policy/profiles/:profileId/versions/:versionId/return` | `org.policy.approve` | ADM-06 | — |
| `buyer.policy.retireVersion` | POST | `/buyer/policy/profiles/:profileId/versions/:versionId/retire` | `org.policy.manage` | ADM-06 | — |
| `buyer.policy.retireProfile` | POST | `/buyer/policy/profiles/:profileId/retire` | `org.policy.manage` | ADM-06 | — |
| `buyer.policy.versionOptions` | GET | `/buyer/policy/version-options` | `org.policy.manage`, `strategy.manage`, `tender.create`, `tender.edit` | ADM-06, BUY-06, BUY-08 | — |
| `buyer.policy.listFields` | GET | `/buyer/policy/custom-fields` | `org.fields.manage`, `audit.view` | ADM-07 | — |
| `buyer.policy.getField` | GET | `/buyer/policy/custom-fields/:fieldId` | `org.fields.manage`, `audit.view` | ADM-07 | — |
| `buyer.policy.createField` | POST | `/buyer/policy/custom-fields` | `org.fields.manage` | ADM-07 | idempotent, 201 |
| `buyer.policy.updateField` | PUT | `/buyer/policy/custom-fields/:fieldId` | `org.fields.manage` | ADM-07 | — |
| `buyer.policy.deactivateField` | POST | `/buyer/policy/custom-fields/:fieldId/deactivate` | `org.fields.manage` | ADM-07 | — |
| `buyer.policy.reactivateField` | POST | `/buyer/policy/custom-fields/:fieldId/reactivate` | `org.fields.manage` | ADM-07 | — |
| `buyer.policy.reorderFields` | PUT | `/buyer/policy/custom-field-order` | `org.fields.manage` | ADM-07 | — |
| `buyer.policy.formDefinition` | GET | `/buyer/policy/form-definitions/:entityType` | `org.fields.manage`, `request.create`, `request.view_all`, `request.review`, `tender.view`, `tender.create`, `tender.edit`, `qualification.review`, `qualification.financial_review`, `qualification.decide`, `contract.view`, `contract.prepare`, `audit.view` | ADM-07, BUY-03, BUY-08, BUY-34, CON-02 | — |
| `supplier.policy.formDefinition` | GET | `/supplier/policy/form-definitions/:buyerSlug/:entityType` | `supplier.qualification.apply`, `supplier.opportunities.view`, `supplier.response.edit`, `supplier.contract.participate` | SUP-20, SUP-08, SUP-23 | — |
| `buyer.policy.listTemplates` | GET | `/buyer/policy/templates` | `org.templates.manage`, `org.templates.approve`, `audit.view` | ADM-08 | — |
| `buyer.policy.templateAuthoringOptions` | GET | `/buyer/policy/template-authoring-options` | `org.templates.manage`, `org.templates.approve`, `audit.view` | ADM-08 | — |
| `buyer.policy.getTemplate` | GET | `/buyer/policy/templates/:templateId` | `org.templates.manage`, `org.templates.approve`, `audit.view` | ADM-08 | — |
| `buyer.policy.getTemplateVersion` | GET | `/buyer/policy/templates/:templateId/versions/:versionId` | `org.templates.manage`, `org.templates.approve`, `audit.view` | ADM-08 | — |
| `buyer.policy.createTemplate` | POST | `/buyer/policy/templates` | `org.templates.manage` | ADM-08 | idempotent, 201 |
| `buyer.policy.updateTemplate` | PUT | `/buyer/policy/templates/:templateId` | `org.templates.manage` | ADM-08 | — |
| `buyer.policy.createTemplateVersion` | POST | `/buyer/policy/templates/:templateId/versions` | `org.templates.manage` | ADM-08 | idempotent, 201 |
| `buyer.policy.updateTemplateVersion` | PUT | `/buyer/policy/templates/:templateId/versions/:versionId` | `org.templates.manage` | ADM-08 | — |
| `buyer.policy.submitTemplateVersion` | POST | `/buyer/policy/templates/:templateId/versions/:versionId/submit` | `org.templates.manage` | ADM-08 | — |
| `buyer.policy.approveTemplateVersion` | POST | `/buyer/policy/templates/:templateId/versions/:versionId/approve` | `org.templates.approve` | ADM-08 | — |
| `buyer.policy.returnTemplateVersion` | POST | `/buyer/policy/templates/:templateId/versions/:versionId/return` | `org.templates.approve` | ADM-08 | — |
| `buyer.policy.retireTemplate` | POST | `/buyer/policy/templates/:templateId/retire` | `org.templates.manage` | ADM-08 | — |
| `buyer.policy.templateOptions` | GET | `/buyer/policy/template-options` | `org.templates.manage`, `strategy.manage`, `tender.create`, `tender.edit`, `contract.prepare` | ADM-08, BUY-07, CON-02 | — |
| `buyer.policy.resolveTemplate` | GET | `/buyer/policy/template-options/:templateId` | `org.templates.manage`, `strategy.manage`, `tender.create`, `tender.edit`, `contract.prepare` | BUY-07, CON-02 | — |
| `buyer.policy.getPortal` | GET | `/buyer/policy/portal` | `org.portal.manage`, `org.settings.manage`, `tender.publish`, `audit.view` | ADM-11 | — |
| `buyer.policy.savePortalProposal` | PUT | `/buyer/policy/portal/proposal` | `org.portal.manage` | ADM-11 | — |
| `buyer.policy.submitPortalProposal` | POST | `/buyer/policy/portal/proposal/submit` | `org.portal.manage` | ADM-11 | — |
| `buyer.policy.approvePortalProposal` | POST | `/buyer/policy/portal/proposal/approve` | `org.portal.manage` | ADM-11 | — |
| `buyer.policy.returnPortalProposal` | POST | `/buyer/policy/portal/proposal/return` | `org.portal.manage` | ADM-11 | — |
| `buyer.policy.withdrawPortalProposal` | DELETE | `/buyer/policy/portal/proposal` | `org.portal.manage` | ADM-11 | — |
| `public.policy.portal` | GET | `/public/portal-policies/:buyerSlug` | — | PUB-01, ADM-11 | — |

## 03 Suppliers

### `src/contracts/suppliers.ts` (47 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `public.suppliers.categoryOptions` | GET | `/public/supplier-registrations/categories` | — | SUP-02, SUP-03, BUY-31 | — |
| `public.suppliers.referenceOptions` | GET | `/public/supplier-registrations/reference` | — | SUP-02, SUP-03, SUP-05, BUY-31 | — |
| `public.suppliers.duplicateCheck` | POST | `/public/supplier-registrations/duplicate-check` | — | SUP-02 | — |
| `public.suppliers.register` | POST | `/public/supplier-registrations` | — | SUP-02 | idempotent, 201 |
| `public.suppliers.resendVerification` | POST | `/public/supplier-registrations/resend-verification` | — | SUP-02 | 202 |
| `public.suppliers.requestMembership` | POST | `/public/supplier-registrations/membership-requests` | — | SUP-02 | idempotent, 201 |
| `public.suppliers.claims.get` | GET | `/public/supplier-registrations/claims/:token` | — | SUP-02 | — |
| `public.suppliers.claims.claim` | POST | `/public/supplier-registrations/claims/:token` | — | SUP-02 | idempotent, 201 |
| `me.suppliers.membershipRequests.list` | GET | `/me/supplier-membership-requests` | — | SUP-02, COM-02 | — |
| `me.suppliers.membershipRequests.create` | POST | `/me/supplier-membership-requests` | — | SUP-02 | idempotent, 201 |
| `me.suppliers.membershipRequests.withdraw` | POST | `/me/supplier-membership-requests/:requestId/withdraw` | — | SUP-02, COM-02 | — |
| `supplier.suppliers.profile.get` | GET | `/supplier/profile` | `supplier.org.manage`, `supplier.dashboard.view` | SUP-03, SUP-02 | — |
| `supplier.suppliers.verificationRequests.respond` | POST | `/supplier/verification-requests/:requestId/respond` | `supplier.org.manage` | SUP-02, SUP-03 | — |
| `supplier.suppliers.profile.update` | PUT | `/supplier/profile` | `supplier.org.manage` | SUP-03 | — |
| `supplier.suppliers.identityChanges.list` | GET | `/supplier/identity-changes` | `supplier.org.manage`, `supplier.dashboard.view` | SUP-03 | — |
| `supplier.suppliers.identityChanges.get` | GET | `/supplier/identity-changes/:changeId` | `supplier.org.manage`, `supplier.dashboard.view` | SUP-03 | — |
| `supplier.suppliers.identityChanges.create` | POST | `/supplier/identity-changes` | `supplier.org.manage` | SUP-03 | idempotent, 201 |
| `supplier.suppliers.membershipRequests.list` | GET | `/supplier/membership-requests` | `supplier.users.manage` | SUP-04, SUP-02 | — |
| `supplier.suppliers.membershipRequests.decide` | POST | `/supplier/membership-requests/:requestId/decide` | `supplier.users.manage` | SUP-04, SUP-02 | — |
| `supplier.suppliers.evidence.list` | GET | `/supplier/evidence` | `supplier.evidence.manage`, `supplier.evidence.share`, `supplier.financial.view` | SUP-05 | — |
| `supplier.suppliers.evidence.get` | GET | `/supplier/evidence/:evidenceId` | `supplier.evidence.manage`, `supplier.evidence.share`, `supplier.financial.view` | SUP-05 | — |
| `supplier.suppliers.evidence.create` | POST | `/supplier/evidence` | `supplier.evidence.manage` | SUP-05 | idempotent, 201 |
| `supplier.suppliers.evidence.replace` | POST | `/supplier/evidence/:evidenceId/replace` | `supplier.evidence.manage` | SUP-05 | idempotent, 201 |
| `supplier.suppliers.evidence.renew` | POST | `/supplier/evidence/:evidenceId/renew` | `supplier.evidence.manage` | SUP-05 | idempotent, 201 |
| `supplier.suppliers.evidence.withdraw` | POST | `/supplier/evidence/:evidenceId/withdraw` | `supplier.evidence.manage` | SUP-05 | — |
| `supplier.suppliers.evidence.share` | POST | `/supplier/evidence/:evidenceId/shares` | `supplier.evidence.share` | SUP-05, SUP-03 | idempotent, 201 |
| `supplier.suppliers.evidence.withdrawShare` | POST | `/supplier/evidence/:evidenceId/shares/:shareId/withdraw` | `supplier.evidence.share` | SUP-05, SUP-03 | — |
| `supplier.suppliers.sharingBuyers` | GET | `/supplier/evidence-sharing/buyers` | `supplier.evidence.share`, `supplier.org.manage` | SUP-05, SUP-03 | — |
| `buyer.suppliers.directory.list` | GET | `/buyer/suppliers` | `supplier.directory.view` | BUY-31 | — |
| `buyer.suppliers.directory.get` | GET | `/buyer/suppliers/:supplierTenantId` | `supplier.directory.view` | BUY-32, BUY-31 | — |
| `buyer.suppliers.relationship.update` | PUT | `/buyer/suppliers/:supplierTenantId/relationship` | `supplier.relationship.manage` | BUY-32 | — |
| `buyer.suppliers.contacts.create` | POST | `/buyer/suppliers/:supplierTenantId/contacts` | `supplier.relationship.manage` | BUY-32 | idempotent, 201 |
| `buyer.suppliers.contacts.update` | PUT | `/buyer/suppliers/:supplierTenantId/contacts/:contactId` | `supplier.relationship.manage` | BUY-32 | — |
| `buyer.suppliers.provisional.create` | POST | `/buyer/suppliers` | `supplier.relationship.manage` | BUY-31 | idempotent, 201 |
| `buyer.suppliers.qualificationRequests.create` | POST | `/buyer/suppliers/:supplierTenantId/qualification-requests` | `supplier.relationship.manage` | BUY-31, BUY-32 | idempotent, 201 |
| `buyer.suppliers.duplicates.flag` | POST | `/buyer/suppliers/:supplierTenantId/duplicate-flags` | `supplier.duplicates.review` | BUY-31, BUY-32 | idempotent, 201 |
| `ops.suppliers.duplicates.list` | GET | `/ops/supplier-duplicates` | `ops.customers.manage` | OPS-01 | — |
| `ops.suppliers.duplicates.get` | GET | `/ops/supplier-duplicates/:candidateId` | `ops.customers.manage` | OPS-01 | — |
| `ops.suppliers.duplicates.decide` | POST | `/ops/supplier-duplicates/:candidateId/decide` | `ops.customers.manage` | OPS-01 | — |
| `ops.suppliers.registrations.list` | GET | `/ops/supplier-registrations` | `ops.customers.manage` | OPS-01 | — |
| `ops.suppliers.registrations.close` | POST | `/ops/supplier-registrations/:supplierTenantId/close` | `ops.customers.manage` | OPS-01 | — |
| `ops.suppliers.registrations.verifyIdentity` | POST | `/ops/supplier-registrations/:supplierTenantId/verify-identity` | `ops.customers.manage` | OPS-01 | — |
| `ops.suppliers.registrations.requestEvidence` | POST | `/ops/supplier-registrations/:supplierTenantId/evidence-requests` | `ops.customers.manage` | OPS-01 | — |
| `ops.suppliers.identityChanges.list` | GET | `/ops/supplier-identity-changes` | `ops.customers.manage` | OPS-01 | — |
| `ops.suppliers.identityChanges.get` | GET | `/ops/supplier-identity-changes/:changeId` | `ops.customers.manage` | OPS-01 | — |
| `ops.suppliers.identityChanges.startReview` | POST | `/ops/supplier-identity-changes/:changeId/start-review` | `ops.customers.manage` | OPS-01 | — |
| `ops.suppliers.identityChanges.decide` | POST | `/ops/supplier-identity-changes/:changeId/decide` | `ops.customers.manage` | OPS-01 | — |

## 04 Qualification

### `src/contracts/qualification.ts` (47 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.qualification.summary` | GET | `/buyer/qualification/summary` | `qualification.review`, `qualification.financial_review`, `qualification.decide` | BUY-33, BUY-35 | — |
| `buyer.qualification.options` | GET | `/buyer/qualification/options` | `qualification.program.manage`, `qualification.review`, `qualification.financial_review`, `qualification.decide` | ADM-09, BUY-33, BUY-34, BUY-35 | — |
| `buyer.qualification.programs.list` | GET | `/buyer/qualification/programs` | `qualification.program.manage`, `qualification.review`, `qualification.financial_review`, `qualification.decide` | ADM-09 | — |
| `buyer.qualification.programs.get` | GET | `/buyer/qualification/programs/:programId` | `qualification.program.manage`, `qualification.review`, `qualification.financial_review`, `qualification.decide` | ADM-09 | — |
| `buyer.qualification.programs.create` | POST | `/buyer/qualification/programs` | `qualification.program.manage` | ADM-09 | idempotent, 201 |
| `buyer.qualification.programs.update` | PATCH | `/buyer/qualification/programs/:programId` | `qualification.program.manage` | ADM-09 | — |
| `buyer.qualification.programs.createVersion` | POST | `/buyer/qualification/programs/:programId/versions` | `qualification.program.manage` | ADM-09 | idempotent, 201 |
| `buyer.qualification.programs.saveCriteria` | PUT | `/buyer/qualification/programs/:programId/versions/:versionId/criteria` | `qualification.program.manage` | ADM-09 | — |
| `buyer.qualification.programs.approveVersion` | POST | `/buyer/qualification/programs/:programId/versions/:versionId/approve` | `qualification.program.manage` | ADM-09 | — |
| `buyer.qualification.programs.retire` | POST | `/buyer/qualification/programs/:programId/retire` | `qualification.program.manage` | ADM-09 | — |
| `buyer.qualification.applications.list` | GET | `/buyer/qualification/applications` | `qualification.review`, `qualification.financial_review`, `qualification.decide` | BUY-33 | — |
| `buyer.qualification.applications.get` | GET | `/buyer/qualification/applications/:applicationId` | `qualification.review`, `qualification.financial_review`, `qualification.decide` | BUY-34 | — |
| `buyer.qualification.applications.assign` | POST | `/buyer/qualification/applications/:applicationId/assignment` | `qualification.review` | BUY-33 | — |
| `buyer.qualification.applications.financialReview` | GET | `/buyer/qualification/applications/:applicationId/financial-review` | `qualification.financial_review`, `qualification.decide` | BUY-34, BUY-35 | — |
| `buyer.qualification.applications.recordFinancialReview` | POST | `/buyer/qualification/applications/:applicationId/financial-reviews` | `qualification.financial_review` | BUY-34 | idempotent, 201 |
| `buyer.qualification.applications.recordFinding` | PUT | `/buyer/qualification/applications/:applicationId/findings/:criterionId` | `qualification.review`, `qualification.financial_review` | BUY-34 | — |
| `buyer.qualification.applications.requestInfo` | POST | `/buyer/qualification/applications/:applicationId/info-requests` | `qualification.review`, `qualification.financial_review` | BUY-33, BUY-34 | idempotent, 201 |
| `buyer.qualification.applications.closeInfoRequest` | POST | `/buyer/qualification/applications/:applicationId/info-requests/:infoRequestId/close` | `qualification.review`, `qualification.financial_review` | BUY-34 | — |
| `buyer.qualification.applications.recommend` | POST | `/buyer/qualification/applications/:applicationId/recommendation` | `qualification.review` | BUY-34 | — |
| `buyer.qualification.applications.decide` | POST | `/buyer/qualification/applications/:applicationId/decision` | `qualification.decide` | BUY-35 | idempotent, 201 |
| `buyer.qualification.screenings.list` | GET | `/buyer/qualification/screenings` | `qualification.review`, `qualification.financial_review`, `qualification.decide` | BUY-34, BUY-35 | — |
| `buyer.qualification.screenings.review` | POST | `/buyer/qualification/screenings/:screeningId/review` | `qualification.review` | BUY-34, BUY-35 | — |
| `buyer.qualification.statuses.list` | GET | `/buyer/qualification/statuses` | `qualification.review`, `qualification.financial_review`, `qualification.decide` | BUY-35 | — |
| `buyer.qualification.eligibility` | GET | `/buyer/qualification/eligibility` | `qualification.review`, `qualification.financial_review`, `qualification.decide`, `tender.participants.manage`, `supplier.directory.view` | BUY-35, BUY-15 | — |
| `buyer.qualification.decisions.list` | GET | `/buyer/qualification/decisions` | `qualification.review`, `qualification.financial_review`, `qualification.decide` | BUY-35 | — |
| `buyer.qualification.decisions.get` | GET | `/buyer/qualification/decisions/:decisionId` | `qualification.review`, `qualification.financial_review`, `qualification.decide` | BUY-35 | — |
| `buyer.qualification.decisions.supersede` | POST | `/buyer/qualification/decisions/:decisionId/supersede` | `qualification.decide` | BUY-35 | idempotent, 201 |
| `buyer.qualification.decisions.requestRenewal` | POST | `/buyer/qualification/decisions/:decisionId/renewal-request` | `qualification.decide` | BUY-35 | — |
| `buyer.qualification.triggers.list` | GET | `/buyer/qualification/triggers` | `qualification.review`, `qualification.financial_review`, `qualification.decide` | BUY-35 | — |
| `buyer.qualification.triggers.get` | GET | `/buyer/qualification/triggers/:triggerId` | `qualification.review`, `qualification.financial_review`, `qualification.decide` | BUY-35 | — |
| `buyer.qualification.triggers.create` | POST | `/buyer/qualification/triggers` | `qualification.review`, `qualification.decide` | BUY-35 | idempotent, 201 |
| `buyer.qualification.triggers.assess` | POST | `/buyer/qualification/triggers/:triggerId/assess` | `qualification.decide` | BUY-35 | — |
| `supplier.qualification.overview` | GET | `/supplier/qualification/overview` | `supplier.qualification.apply`, `supplier.outcomes.view` | SUP-20, SUP-24 | — |
| `supplier.qualification.programs.list` | GET | `/supplier/qualification/programs` | `supplier.qualification.apply` | SUP-20 | — |
| `supplier.qualification.programs.get` | GET | `/supplier/qualification/programs/:programId` | `supplier.qualification.apply` | SUP-20 | — |
| `supplier.qualification.applications.list` | GET | `/supplier/qualification/applications` | `supplier.qualification.apply` | SUP-20 | — |
| `supplier.qualification.applications.get` | GET | `/supplier/qualification/applications/:applicationId` | `supplier.qualification.apply` | SUP-20 | — |
| `supplier.qualification.applications.create` | POST | `/supplier/qualification/applications` | `supplier.qualification.apply` | SUP-20, SUP-24 | idempotent, 201 |
| `supplier.qualification.applications.saveAnswers` | PUT | `/supplier/qualification/applications/:applicationId/answers` | `supplier.qualification.apply` | SUP-20 | — |
| `supplier.qualification.applications.evidenceCandidates` | GET | `/supplier/qualification/applications/:applicationId/evidence-candidates` | `supplier.qualification.apply` | SUP-20 | — |
| `supplier.qualification.applications.submit` | POST | `/supplier/qualification/applications/:applicationId/submit` | `supplier.qualification.apply` | SUP-20 | — |
| `supplier.qualification.applications.withdraw` | POST | `/supplier/qualification/applications/:applicationId/withdraw` | `supplier.qualification.apply` | SUP-20 | — |
| `supplier.qualification.applications.respondInfoRequest` | POST | `/supplier/qualification/applications/:applicationId/info-requests/:infoRequestId/respond` | `supplier.qualification.apply` | SUP-20 | — |
| `supplier.qualification.decisions.list` | GET | `/supplier/qualification/decisions` | `supplier.qualification.apply`, `supplier.outcomes.view` | SUP-24 | — |
| `supplier.qualification.decisions.get` | GET | `/supplier/qualification/decisions/:decisionId` | `supplier.qualification.apply`, `supplier.outcomes.view` | SUP-24 | — |
| `supplier.qualification.decisions.requestReconsideration` | POST | `/supplier/qualification/decisions/:decisionId/reconsideration` | `supplier.qualification.apply` | SUP-24 | idempotent, 201 |
| `supplier.qualification.decisions.supplyEvidence` | POST | `/supplier/qualification/decisions/:decisionId/evidence-updates` | `supplier.qualification.apply` | SUP-24 | idempotent, 201 |

## 05 Requests and planning

### `src/contracts/requests.ts` (49 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.requests.list` | GET | `/buyer/requests` | `request.create`, `request.view_all` | BUY-02 | — |
| `buyer.requests.summary` | GET | `/buyer/request-summary` | `request.create`, `request.view_all` | BUY-02 | — |
| `buyer.requests.options` | GET | `/buyer/request-options` | `request.create`, `request.view_all`, `plan.manage`, `strategy.manage` | BUY-03, BUY-05, BUY-06 | — |
| `buyer.requests.get` | GET | `/buyer/requests/:requestId` | `request.create`, `request.view_all` | BUY-03, BUY-04 | — |
| `buyer.requests.create` | POST | `/buyer/requests` | `request.create` | BUY-02, BUY-03 | idempotent, 201 |
| `buyer.requests.update` | PUT | `/buyer/requests/:requestId` | `request.create` | BUY-03 | — |
| `buyer.requests.submit` | POST | `/buyer/requests/:requestId/submit` | `request.create` | BUY-03 | — |
| `buyer.requests.withdraw` | POST | `/buyer/requests/:requestId/withdraw` | `request.create` | BUY-03 | — |
| `buyer.requests.assign` | POST | `/buyer/requests/:requestId/assign` | `request.review` | BUY-02, BUY-04 | — |
| `buyer.requests.requestInfo` | POST | `/buyer/requests/:requestId/info-requests` | `request.review` | BUY-03, BUY-04 | idempotent, 201 |
| `buyer.requests.respondInfo` | POST | `/buyer/requests/:requestId/info-requests/:infoRequestId/respond` | `request.create` | BUY-03 | — |
| `buyer.requests.combine` | POST | `/buyer/requests/:requestId/combine` | `request.review` | BUY-02, BUY-04 | — |
| `buyer.requests.split` | POST | `/buyer/requests/:requestId/split` | `request.review` | BUY-04 | — |
| `buyer.requests.defer` | POST | `/buyer/requests/:requestId/defer` | `request.review` | BUY-02, BUY-04 | — |
| `buyer.requests.routingOptions` | GET | `/buyer/requests/:requestId/routing-options` | `request.review` | BUY-02, BUY-04 | — |
| `buyer.requests.routeToContract` | POST | `/buyer/requests/:requestId/route-to-contract` | `request.review` | BUY-02, BUY-04 | — |
| `buyer.requests.decisionView` | GET | `/buyer/requests/:requestId/decision` | `request.review`, `request.approve`, `request.funding_confirm`, `request.view_all` | BUY-04 | — |
| `buyer.requests.decide` | POST | `/buyer/requests/:requestId/decision` | `request.approve` | BUY-04 | — |
| `buyer.requests.escalate` | POST | `/buyer/requests/:requestId/decision/escalate` | `request.approve` | BUY-04 | — |
| `buyer.requests.confirmFunding` | POST | `/buyer/requests/:requestId/funding` | `request.funding_confirm` | BUY-04 | — |
| `buyer.requests.comment` | POST | `/buyer/requests/:requestId/comments` | `request.review`, `request.approve`, `request.funding_confirm` | BUY-04 | idempotent, 201 |
| `buyer.requests.rescind` | POST | `/buyer/requests/:requestId/rescind` | `request.approve` | BUY-04 | — |
| `buyer.requests.reconsider` | POST | `/buyer/requests/:requestId/reconsider` | `request.review` | BUY-02, BUY-04 | — |
| `buyer.requests.close` | POST | `/buyer/requests/:requestId/close` | `request.review` | BUY-02 | — |
| `buyer.planning.list` | GET | `/buyer/plan-items` | `plan.manage`, `request.view_all` | BUY-05 | — |
| `buyer.planning.get` | GET | `/buyer/plan-items/:planItemId` | `plan.manage`, `request.view_all` | BUY-05 | — |
| `buyer.planning.create` | POST | `/buyer/plan-items` | `plan.manage` | BUY-05 | idempotent, 201 |
| `buyer.planning.update` | PUT | `/buyer/plan-items/:planItemId` | `plan.manage` | BUY-05 | — |
| `buyer.planning.calendar` | GET | `/buyer/plan-calendar` | `plan.manage`, `request.view_all` | BUY-05 | — |
| `buyer.planning.resourceDemand` | GET | `/buyer/plan-resource-demand` | `plan.manage`, `request.view_all` | BUY-05 | — |
| `buyer.planning.notices` | GET | `/buyer/advance-notices` | `plan.manage`, `request.view_all` | BUY-05 | — |
| `buyer.planning.notice` | GET | `/buyer/advance-notices/:noticeId` | `plan.manage`, `request.view_all` | BUY-05 | — |
| `buyer.planning.createNotice` | POST | `/buyer/advance-notices` | `plan.manage` | BUY-05 | idempotent, 201 |
| `buyer.planning.updateNotice` | PUT | `/buyer/advance-notices/:noticeId` | `plan.manage` | BUY-05 | — |
| `buyer.planning.publishNotice` | POST | `/buyer/advance-notices/:noticeId/publish` | `plan.manage` | BUY-05 | — |
| `buyer.planning.withdrawNotice` | POST | `/buyer/advance-notices/:noticeId/withdraw` | `plan.manage` | BUY-05 | — |
| `public.planning.notices` | GET | `/public/advance-notices` | — | PUB-06 | — |
| `public.planning.notice` | GET | `/public/advance-notices/:buyerSlug/:noticeId` | — | PUB-06 | — |
| `public.planning.summary` | GET | `/public/procurement-plans` | — | PUB-06 | — |
| `public.planning.follow` | POST | `/public/advance-notices/:buyerSlug/:noticeId/follow` | — | PUB-06 | 202 |
| `buyer.strategies.list` | GET | `/buyer/strategies` | `strategy.manage`, `strategy.approve`, `audit.view` | BUY-06 | — |
| `buyer.strategies.get` | GET | `/buyer/strategies/:strategyId` | `strategy.manage`, `strategy.approve`, `audit.view` | BUY-06 | — |
| `buyer.strategies.create` | POST | `/buyer/strategies` | `strategy.manage` | BUY-06 | idempotent, 201 |
| `buyer.strategies.update` | PUT | `/buyer/strategies/:strategyId` | `strategy.manage` | BUY-06 | — |
| `buyer.strategies.procedureOptions` | GET | `/buyer/strategies/:strategyId/procedure-options` | `strategy.manage`, `strategy.approve`, `audit.view` | BUY-06 | — |
| `buyer.strategies.addResearch` | POST | `/buyer/strategies/:strategyId/market-research` | `strategy.manage` | BUY-06 | idempotent, 201 |
| `buyer.strategies.decideFairness` | POST | `/buyer/strategies/:strategyId/fairness-reviews/:reviewId/decision` | `strategy.approve` | BUY-06 | — |
| `buyer.strategies.submit` | POST | `/buyer/strategies/:strategyId/submit` | `strategy.manage` | BUY-06 | — |
| `buyer.strategies.decide` | POST | `/buyer/strategies/:strategyId/decision` | `strategy.approve` | BUY-06 | — |

## 06 Tenders

### `src/contracts/tenders.ts` (39 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.tenders.list` | GET | `/buyer/tenders` | `tender.view` | BUY-07 | — |
| `buyer.tenders.creationSources` | GET | `/buyer/tender-sources` | `tender.create` | BUY-07 | — |
| `buyer.tenders.create` | POST | `/buyer/tenders` | `tender.create` | BUY-07 | idempotent, 201 |
| `buyer.tenders.saveAsTemplate` | POST | `/buyer/tenders/:tenderId/templates` | `tender.create` | BUY-07, BUY-08 | idempotent, 201 |
| `buyer.tenders.link` | POST | `/buyer/tenders/:tenderId/link` | `tender.edit` | BUY-07, BUY-08 | — |
| `buyer.tenders.get` | GET | `/buyer/tenders/:tenderId` | `tender.view` | BUY-08, BUY-09, BUY-10, BUY-11, BUY-12, BUY-13 | — |
| `buyer.tenders.update` | PATCH | `/buyer/tenders/:tenderId` | `tender.edit` | BUY-08, BUY-10, BUY-12 | — |
| `buyer.tenders.team` | GET | `/buyer/tenders/:tenderId/team` | `tender.view` | BUY-08 | — |
| `buyer.tenders.teamCandidates` | GET | `/buyer/tenders/:tenderId/team-candidates` | `tender.edit` | BUY-08 | — |
| `buyer.tenders.assignTeamMember` | POST | `/buyer/tenders/:tenderId/team` | `tender.edit` | BUY-08 | idempotent, 201 |
| `buyer.tenders.removeTeamMember` | POST | `/buyer/tenders/:tenderId/team/:memberId/remove` | `tender.edit` | BUY-08 | — |
| `buyer.tenders.readiness` | GET | `/buyer/tenders/:tenderId/readiness` | `tender.view` | BUY-08, BUY-13 | — |
| `buyer.tenders.lots` | GET | `/buyer/tenders/:tenderId/lots` | `tender.view` | BUY-09 | — |
| `buyer.tenders.createLot` | POST | `/buyer/tenders/:tenderId/lots` | `tender.edit` | BUY-09 | idempotent, 201 |
| `buyer.tenders.updateLot` | PATCH | `/buyer/tenders/:tenderId/lots/:lotId` | `tender.edit` | BUY-09 | — |
| `buyer.tenders.requirements` | GET | `/buyer/tenders/:tenderId/requirements` | `tender.view` | BUY-09 | — |
| `buyer.tenders.createRequirement` | POST | `/buyer/tenders/:tenderId/requirements` | `tender.edit` | BUY-09 | idempotent, 201 |
| `buyer.tenders.updateRequirement` | PATCH | `/buyer/tenders/:tenderId/requirements/:requirementId` | `tender.edit` | BUY-09 | — |
| `buyer.tenders.removeRequirement` | DELETE | `/buyer/tenders/:tenderId/requirements/:requirementId` | `tender.edit` | BUY-09 | — |
| `buyer.tenders.pricing` | GET | `/buyer/tenders/:tenderId/pricing` | `tender.view` | BUY-10 | — |
| `buyer.tenders.createPricingSchedule` | POST | `/buyer/tenders/:tenderId/pricing-schedules` | `tender.edit` | BUY-10 | idempotent, 201 |
| `buyer.tenders.updatePricingSchedule` | PATCH | `/buyer/tenders/:tenderId/pricing-schedules/:scheduleId` | `tender.edit` | BUY-10 | — |
| `buyer.tenders.createPricingItem` | POST | `/buyer/tenders/:tenderId/pricing-schedules/:scheduleId/items` | `tender.edit` | BUY-10 | idempotent, 201 |
| `buyer.tenders.updatePricingItem` | PATCH | `/buyer/tenders/:tenderId/pricing-schedules/:scheduleId/items/:itemId` | `tender.edit` | BUY-10 | — |
| `buyer.tenders.upsertTerm` | PUT | `/buyer/tenders/:tenderId/terms/:termType` | `tender.edit` | BUY-10 | — |
| `buyer.tenders.evaluationPlans` | GET | `/buyer/tenders/:tenderId/evaluation-plans` | `tender.view` | BUY-11 | — |
| `buyer.tenders.updateEvaluationPlan` | PUT | `/buyer/tenders/:tenderId/evaluation-plans/:planId` | `tender.edit` | BUY-11 | — |
| `buyer.tenders.approveEvaluationPlan` | POST | `/buyer/tenders/:tenderId/evaluation-plans/:planId/approve` | `tender.release_approve` | BUY-11 | — |
| `buyer.tenders.timetable` | GET | `/buyer/tenders/:tenderId/timetable` | `tender.view` | BUY-12 | — |
| `buyer.tenders.updateTimetable` | PUT | `/buyer/tenders/:tenderId/timetable` | `tender.edit` | BUY-12 | — |
| `buyer.tenders.updateEnvelopes` | PUT | `/buyer/tenders/:tenderId/envelopes` | `tender.edit` | BUY-12 | — |
| `buyer.tenders.createCondition` | POST | `/buyer/tenders/:tenderId/participation-conditions` | `tender.edit` | BUY-12 | idempotent, 201 |
| `buyer.tenders.updateCondition` | PATCH | `/buyer/tenders/:tenderId/participation-conditions/:conditionId` | `tender.edit` | BUY-12 | — |
| `buyer.tenders.removeCondition` | DELETE | `/buyer/tenders/:tenderId/participation-conditions/:conditionId` | `tender.edit` | BUY-12 | — |
| `buyer.tenders.releaseReview` | GET | `/buyer/tenders/:tenderId/release-review` | `tender.view` | BUY-13 | — |
| `buyer.tenders.recordReleaseCheck` | PUT | `/buyer/tenders/:tenderId/release-checks/:checkArea` | `tender.edit`, `tender.release_approve` | BUY-13 | — |
| `buyer.tenders.preview` | GET | `/buyer/tenders/:tenderId/preview` | `tender.view` | BUY-13 | — |
| `buyer.tenders.requestCorrection` | POST | `/buyer/tenders/:tenderId/corrections` | `tender.edit`, `tender.release_approve` | BUY-13 | idempotent, 201 |
| `buyer.tenders.requestReleaseApproval` | POST | `/buyer/tenders/:tenderId/release-approval` | `tender.edit` | BUY-13 | idempotent, 201 |

## 07 Publication and participation

### `src/contracts/publication.ts` (62 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `public.publication.home` | GET | `/public/portal` | — | PUB-01 | — |
| `public.publication.buyerHome` | GET | `/public/buyers/:buyerSlug` | — | PUB-01 | — |
| `public.publication.search` | GET | `/public/opportunities` | — | PUB-02, PUB-01 | — |
| `public.publication.filters` | GET | `/public/opportunity-filters` | — | PUB-02 | — |
| `public.publication.notice` | GET | `/public/opportunities/:buyerSlug/:reference` | — | PUB-03 | — |
| `public.publication.documentDownload` | GET | `/public/opportunities/:buyerSlug/:reference/documents/:documentId/download` | — | PUB-03 | — |
| `public.publication.registerInterest` | POST | `/public/opportunities/:buyerSlug/:reference/interest` | — | PUB-03 | idempotent, 201 |
| `public.publication.guidance` | GET | `/public/guidance` | — | PUB-07, PUB-01 | — |
| `public.publication.guidanceArticle` | GET | `/public/guidance/:articleSlug` | — | PUB-07 | — |
| `buyer.publication.list` | GET | `/buyer/publications` | `tender.view`, `tender.publish` | BUY-14 | — |
| `buyer.publication.overview` | GET | `/buyer/tenders/:tenderId/publication` | `tender.view`, `tender.publish` | BUY-14 | — |
| `buyer.publication.publish` | POST | `/buyer/tenders/:tenderId/publication/publish` | `tender.publish` | BUY-14 | idempotent, 201 |
| `buyer.publication.cancelSchedule` | POST | `/buyer/tenders/:tenderId/publication/cancel-schedule` | `tender.publish` | BUY-14 | — |
| `buyer.publication.retry` | POST | `/buyer/publications/:publicationId/retry` | `tender.publish` | BUY-14 | — |
| `buyer.publication.reconcile` | POST | `/buyer/publications/:publicationId/reconcile` | `tender.publish` | BUY-14 | — |
| `buyer.publication.distributeInvitations` | POST | `/buyer/tenders/:tenderId/invitations/distribute` | `tender.publish`, `tender.participants.manage` | BUY-14, BUY-15 | — |
| `buyer.participants.list` | GET | `/buyer/tenders/:tenderId/participants` | `tender.view`, `tender.participants.manage` | BUY-15 | — |
| `buyer.participants.summary` | GET | `/buyer/tenders/:tenderId/participant-summary` | `tender.view`, `tender.participants.manage` | BUY-15, BUY-14 | — |
| `buyer.participants.get` | GET | `/buyer/tenders/:tenderId/participants/:participantId` | `tender.view`, `tender.participants.manage` | BUY-15 | — |
| `buyer.participants.candidates` | GET | `/buyer/tenders/:tenderId/invitation-candidates` | `tender.participants.manage` | BUY-15 | — |
| `buyer.participants.invite` | POST | `/buyer/tenders/:tenderId/participants` | `tender.participants.manage` | BUY-15 | idempotent, 201 |
| `buyer.participants.replaceContact` | POST | `/buyer/tenders/:tenderId/participants/:participantId/contact` | `tender.participants.manage` | BUY-15 | — |
| `buyer.participants.decideAccess` | POST | `/buyer/tenders/:tenderId/participants/:participantId/access-decision` | `tender.participants.manage` | BUY-15 | — |
| `buyer.participants.resendInvitation` | POST | `/buyer/tenders/:tenderId/participants/:participantId/resend` | `tender.participants.manage` | BUY-15 | — |
| `buyer.participants.remind` | POST | `/buyer/tenders/:tenderId/participants/:participantId/reminders` | `tender.participants.manage` | BUY-15 | — |
| `supplier.opportunities.list` | GET | `/supplier/opportunities` | `supplier.opportunities.view` | SUP-06 | — |
| `supplier.opportunities.filters` | GET | `/supplier/opportunity-filters` | `supplier.opportunities.view` | SUP-06 | — |
| `supplier.opportunities.dismiss` | POST | `/supplier/opportunities/:tenderId/dismiss` | `supplier.opportunities.view` | SUP-06 | — |
| `supplier.opportunities.restore` | DELETE | `/supplier/opportunities/:tenderId/dismiss` | `supplier.opportunities.view` | SUP-06 | — |
| `supplier.watchlist.list` | GET | `/supplier/watchlist` | `supplier.opportunities.view` | SUP-06 | — |
| `supplier.watchlist.add` | POST | `/supplier/watchlist` | `supplier.opportunities.view` | SUP-06, SUP-08 | idempotent, 201 |
| `supplier.watchlist.remove` | DELETE | `/supplier/watchlist/:watchlistItemId` | `supplier.opportunities.view` | SUP-06, SUP-08 | 204 |
| `supplier.savedSearches.list` | GET | `/supplier/saved-searches` | `supplier.opportunities.view` | SUP-06 | — |
| `supplier.savedSearches.create` | POST | `/supplier/saved-searches` | `supplier.opportunities.view` | SUP-06 | idempotent, 201 |
| `supplier.savedSearches.update` | PUT | `/supplier/saved-searches/:savedSearchId` | `supplier.opportunities.view` | SUP-06 | — |
| `supplier.savedSearches.delete` | DELETE | `/supplier/saved-searches/:savedSearchId` | `supplier.opportunities.view` | SUP-06 | 204 |
| `supplier.subscriptions.list` | GET | `/supplier/notice-subscriptions` | `supplier.opportunities.view` | SUP-06 | — |
| `supplier.subscriptions.create` | POST | `/supplier/notice-subscriptions` | `supplier.opportunities.view` | SUP-06, PUB-02 | idempotent, 201 |
| `supplier.subscriptions.update` | PUT | `/supplier/notice-subscriptions/:subscriptionId` | `supplier.opportunities.view` | SUP-06 | — |
| `supplier.subscriptions.delete` | DELETE | `/supplier/notice-subscriptions/:subscriptionId` | `supplier.opportunities.view` | SUP-06 | 204 |
| `supplier.invitations.list` | GET | `/supplier/invitations` | `supplier.opportunities.view` | SUP-07 | — |
| `supplier.invitations.get` | GET | `/supplier/invitations/:participantId` | `supplier.opportunities.view` | SUP-07 | — |
| `supplier.invitations.accept` | POST | `/supplier/invitations/:participantId/accept` | `supplier.notices.acknowledge` | SUP-07 | — |
| `supplier.invitations.decline` | POST | `/supplier/invitations/:participantId/decline` | `supplier.notices.acknowledge` | SUP-07 | — |
| `supplier.opportunities.requestAccess` | POST | `/supplier/opportunities/:tenderId/access-request` | `supplier.notices.acknowledge` | SUP-07, SUP-08, PUB-03 | idempotent, 201 |
| `supplier.opportunities.acceptConfidentiality` | POST | `/supplier/opportunities/:tenderId/confidentiality` | `supplier.notices.acknowledge` | SUP-07, SUP-08 | — |
| `supplier.opportunities.get` | GET | `/supplier/opportunities/:tenderId` | `supplier.opportunities.view` | SUP-08 | — |
| `supplier.opportunities.registerInterest` | POST | `/supplier/opportunities/:tenderId/interest` | `supplier.pursuit.manage`, `supplier.notices.acknowledge` | SUP-08, SUP-06, PUB-03 | idempotent, 201 |
| `supplier.opportunities.acknowledge` | POST | `/supplier/opportunities/:tenderId/acknowledgments` | `supplier.notices.acknowledge` | SUP-08 | idempotent, 201 |
| `supplier.opportunities.selectLots` | PUT | `/supplier/opportunities/:tenderId/lots` | `supplier.pursuit.manage` | SUP-08 | — |
| `supplier.opportunities.documentDownload` | GET | `/supplier/opportunities/:tenderId/documents/:documentId/download` | `supplier.opportunities.view` | SUP-08 | — |
| `supplier.opportunities.startResponse` | POST | `/supplier/opportunities/:tenderId/start-response` | `supplier.response.edit`, `supplier.pursuit.manage` | SUP-08 | — |
| `supplier.pursuits.list` | GET | `/supplier/pursuits` | `supplier.pursuit.manage`, `supplier.opportunities.view` | SUP-09, SUP-06 | — |
| `supplier.pursuits.teamCandidates` | GET | `/supplier/pursuit-team-candidates` | `supplier.pursuit.manage` | SUP-09 | — |
| `supplier.pursuits.get` | GET | `/supplier/opportunities/:tenderId/pursuit` | `supplier.pursuit.manage`, `supplier.opportunities.view` | SUP-09 | — |
| `supplier.pursuits.save` | PUT | `/supplier/opportunities/:tenderId/pursuit` | `supplier.pursuit.manage` | SUP-09 | — |
| `supplier.pursuits.decide` | POST | `/supplier/opportunities/:tenderId/pursuit/decision` | `supplier.pursuit.manage` | SUP-09 | — |
| `supplier.pursuits.notifyBuyer` | POST | `/supplier/opportunities/:tenderId/pursuit/notify-buyer` | `supplier.pursuit.manage` | SUP-09, SUP-07 | — |
| `supplier.pursuits.addTeamMember` | POST | `/supplier/opportunities/:tenderId/pursuit/team` | `supplier.pursuit.manage` | SUP-09 | idempotent, 201 |
| `supplier.pursuits.updateTeamMember` | PUT | `/supplier/opportunities/:tenderId/pursuit/team/:memberId` | `supplier.pursuit.manage` | SUP-09 | — |
| `supplier.pursuits.removeTeamMember` | DELETE | `/supplier/opportunities/:tenderId/pursuit/team/:memberId` | `supplier.pursuit.manage` | SUP-09 | 204 |
| `supplier.pursuits.addNote` | POST | `/supplier/opportunities/:tenderId/pursuit/notes` | `supplier.pursuit.manage` | SUP-09 | idempotent, 201 |

## 08 Clarifications, addenda and sessions

### `src/contracts/clarifications.ts` (46 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.clarifications.tenders` | GET | `/buyer/clarifications/tenders` | `tender.clarifications.manage`, `tender.addenda.approve`, `tender.sessions.manage` | BUY-16, BUY-17, BUY-18 | — |
| `buyer.clarifications.tenderContext` | GET | `/buyer/clarifications/tenders/:tenderId` | `tender.clarifications.manage`, `tender.addenda.approve`, `tender.sessions.manage` | BUY-16, BUY-17, BUY-18 | — |
| `buyer.clarifications.ownerCandidates` | GET | `/buyer/clarifications/owner-candidates` | `tender.clarifications.manage` | BUY-16 | — |
| `buyer.clarifications.questionsList` | GET | `/buyer/clarifications/questions` | `tender.clarifications.manage` | BUY-16 | — |
| `buyer.clarifications.questionsGet` | GET | `/buyer/clarifications/questions/:questionId` | `tender.clarifications.manage` | BUY-16 | — |
| `buyer.clarifications.questionsAssign` | POST | `/buyer/clarifications/questions/:questionId/assign` | `tender.clarifications.manage` | BUY-16 | — |
| `buyer.clarifications.questionsLateDisposition` | POST | `/buyer/clarifications/questions/:questionId/late-disposition` | `tender.clarifications.manage` | BUY-16 | — |
| `buyer.clarifications.questionsSaveAnswer` | PUT | `/buyer/clarifications/questions/:questionId/answer` | `tender.clarifications.manage` | BUY-16 | — |
| `buyer.clarifications.questionsRequestReview` | POST | `/buyer/clarifications/questions/:questionId/review-request` | `tender.clarifications.manage` | BUY-16 | — |
| `buyer.clarifications.questionsReview` | POST | `/buyer/clarifications/questions/:questionId/confidentiality-review` | `tender.clarifications.manage` | BUY-16 | — |
| `buyer.clarifications.questionsPublish` | POST | `/buyer/clarifications/questions/:questionId/publish` | `tender.clarifications.manage` | BUY-16 | — |
| `buyer.clarifications.questionsAnswerPrivately` | POST | `/buyer/clarifications/questions/:questionId/private-answer` | `tender.clarifications.manage` | BUY-16 | — |
| `buyer.clarifications.questionsEscalate` | POST | `/buyer/clarifications/questions/:questionId/escalate` | `tender.clarifications.manage` | BUY-16, BUY-17 | — |
| `buyer.clarifications.questionsDecline` | POST | `/buyer/clarifications/questions/:questionId/decline` | `tender.clarifications.manage` | BUY-16 | — |
| `buyer.clarifications.addendaList` | GET | `/buyer/clarifications/addenda` | `tender.clarifications.manage`, `tender.addenda.approve` | BUY-17 | — |
| `buyer.clarifications.addendaGet` | GET | `/buyer/clarifications/addenda/:addendumId` | `tender.clarifications.manage`, `tender.addenda.approve` | BUY-17 | — |
| `buyer.clarifications.addendaCreate` | POST | `/buyer/clarifications/addenda` | `tender.clarifications.manage` | BUY-17 | idempotent, 201 |
| `buyer.clarifications.addendaUpdate` | PUT | `/buyer/clarifications/addenda/:addendumId` | `tender.clarifications.manage` | BUY-17 | — |
| `buyer.clarifications.addendaSubmit` | POST | `/buyer/clarifications/addenda/:addendumId/submit` | `tender.clarifications.manage` | BUY-17 | — |
| `buyer.clarifications.addendaIssue` | POST | `/buyer/clarifications/addenda/:addendumId/issue` | `tender.publish` | BUY-17 | — |
| `buyer.clarifications.addendaWithdraw` | POST | `/buyer/clarifications/addenda/:addendumId/withdraw` | `tender.clarifications.manage` | BUY-17 | — |
| `buyer.clarifications.addendaRemind` | POST | `/buyer/clarifications/addenda/:addendumId/reminders` | `tender.clarifications.manage` | BUY-17 | — |
| `buyer.clarifications.sessionsList` | GET | `/buyer/clarifications/sessions` | `tender.sessions.manage` | BUY-18 | — |
| `buyer.clarifications.sessionsGet` | GET | `/buyer/clarifications/sessions/:sessionId` | `tender.sessions.manage` | BUY-18 | — |
| `buyer.clarifications.sessionsCreate` | POST | `/buyer/clarifications/sessions` | `tender.sessions.manage` | BUY-18 | idempotent, 201 |
| `buyer.clarifications.sessionsUpdate` | PUT | `/buyer/clarifications/sessions/:sessionId` | `tender.sessions.manage` | BUY-18 | — |
| `buyer.clarifications.sessionsCancel` | POST | `/buyer/clarifications/sessions/:sessionId/cancel` | `tender.sessions.manage` | BUY-18 | — |
| `buyer.clarifications.sessionsRecordAttendance` | POST | `/buyer/clarifications/sessions/:sessionId/attendance` | `tender.sessions.manage` | BUY-18 | — |
| `buyer.clarifications.sessionsPublishMinutes` | POST | `/buyer/clarifications/sessions/:sessionId/minutes` | `tender.sessions.manage` | BUY-18 | — |
| `buyer.clarifications.sessionsResolveException` | POST | `/buyer/clarifications/sessions/:sessionId/registrations/:registrationId/exception` | `tender.sessions.manage` | BUY-18 | — |
| `supplier.clarifications.tenders` | GET | `/supplier/clarifications/tenders` | `supplier.opportunities.view` | SUP-10, SUP-11 | — |
| `supplier.clarifications.tenderContext` | GET | `/supplier/clarifications/tenders/:tenderId` | `supplier.opportunities.view` | SUP-10 | — |
| `supplier.clarifications.publishedAnswers` | GET | `/supplier/clarifications/tenders/:tenderId/answers` | `supplier.opportunities.view` | SUP-10 | — |
| `supplier.clarifications.questionsList` | GET | `/supplier/clarifications/questions` | `supplier.opportunities.view` | SUP-10 | — |
| `supplier.clarifications.questionsGet` | GET | `/supplier/clarifications/questions/:questionId` | `supplier.opportunities.view` | SUP-10 | — |
| `supplier.clarifications.questionsAsk` | POST | `/supplier/clarifications/questions` | `supplier.pursuit.manage`, `supplier.response.edit` | SUP-10 | idempotent, 201 |
| `supplier.clarifications.questionsWithdraw` | POST | `/supplier/clarifications/questions/:questionId/withdraw` | `supplier.pursuit.manage`, `supplier.response.edit` | SUP-10 | — |
| `supplier.clarifications.addendaList` | GET | `/supplier/clarifications/addenda` | `supplier.opportunities.view` | SUP-10, SUP-08 | — |
| `supplier.clarifications.addendaGet` | GET | `/supplier/clarifications/addenda/:addendumId` | `supplier.opportunities.view` | SUP-10, SUP-08 | — |
| `supplier.clarifications.addendaAcknowledge` | POST | `/supplier/clarifications/addenda/:addendumId/acknowledge` | `supplier.notices.acknowledge` | SUP-10, SUP-08 | idempotent, 201 |
| `supplier.clarifications.sessionsList` | GET | `/supplier/clarifications/sessions` | `supplier.opportunities.view` | SUP-11 | — |
| `supplier.clarifications.sessionsGet` | GET | `/supplier/clarifications/sessions/:sessionId` | `supplier.opportunities.view` | SUP-11 | — |
| `supplier.clarifications.sessionsRegister` | POST | `/supplier/clarifications/sessions/:sessionId/registrations` | `supplier.pursuit.manage`, `supplier.response.edit` | SUP-11 | idempotent, 201 |
| `supplier.clarifications.registrationUpdate` | PUT | `/supplier/clarifications/registrations/:registrationId` | `supplier.pursuit.manage`, `supplier.response.edit` | SUP-11 | — |
| `supplier.clarifications.registrationCancel` | POST | `/supplier/clarifications/registrations/:registrationId/cancel` | `supplier.pursuit.manage`, `supplier.response.edit` | SUP-11 | — |
| `public.clarifications.edition` | GET | `/public/clarifications/:buyerSlug/:reference` | — | PUB-04 | — |

## 09 Bids and submission

### `src/contracts/bids.ts` (43 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `supplier.bids.list` | GET | `/supplier/bids` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit` | SUP-12, SUP-16, SUP-17 | — |
| `supplier.bids.startOptions` | GET | `/supplier/bid-starts/:tenderId` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit` | SUP-12 | — |
| `supplier.bids.start` | POST | `/supplier/bids` | `supplier.response.edit` | SUP-12 | idempotent, 201 |
| `supplier.bids.get` | GET | `/supplier/bids/:bidId` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit` | SUP-12, SUP-13, SUP-14, SUP-15, SUP-16, SUP-17 | — |
| `supplier.bids.updateLots` | PUT | `/supplier/bids/:bidId/lots` | `supplier.response.edit` | SUP-12 | — |
| `supplier.bids.answers` | GET | `/supplier/bids/:bidId/answers` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit` | SUP-12 | — |
| `supplier.bids.getAnswer` | GET | `/supplier/bids/:bidId/answers/:requirementId` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit` | SUP-12 | — |
| `supplier.bids.saveAnswer` | PUT | `/supplier/bids/:bidId/answers/:requirementId` | `supplier.response.edit` | SUP-12 | — |
| `supplier.bids.assignAnswer` | POST | `/supplier/bids/:bidId/answers/:requirementId/assign` | `supplier.pursuit.manage` | SUP-12 | — |
| `supplier.bids.addComment` | POST | `/supplier/bids/:bidId/answers/:requirementId/comments` | `supplier.response.edit`, `supplier.response.approve` | SUP-12, SUP-15 | idempotent, 201 |
| `supplier.bids.reuseCandidates` | GET | `/supplier/bids/:bidId/answers/:requirementId/reuse-candidates` | `supplier.response.edit` | SUP-12 | — |
| `supplier.bids.reuseAnswer` | POST | `/supplier/bids/:bidId/answers/:requirementId/reuse` | `supplier.response.edit` | SUP-12 | — |
| `supplier.bids.attachDocument` | POST | `/supplier/bids/:bidId/answers/:requirementId/documents` | `supplier.response.edit` | SUP-12 | idempotent, 201 |
| `supplier.bids.detachDocument` | DELETE | `/supplier/bids/:bidId/answers/:requirementId/documents/:attachmentId` | `supplier.response.edit` | SUP-12 | — |
| `supplier.bids.pricing` | GET | `/supplier/bids/:bidId/pricing` | `supplier.pricing.edit`, `supplier.response.approve` | SUP-13, SUP-15 | — |
| `supplier.bids.savePricing` | PUT | `/supplier/bids/:bidId/pricing` | `supplier.pricing.edit` | SUP-13 | — |
| `supplier.bids.declarations` | GET | `/supplier/bids/:bidId/declarations` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit` | SUP-14 | — |
| `supplier.bids.saveDeclarations` | PUT | `/supplier/bids/:bidId/declarations` | `supplier.response.edit` | SUP-14 | — |
| `supplier.bids.saveSubcontractors` | PUT | `/supplier/bids/:bidId/subcontractors` | `supplier.response.edit` | SUP-14 | — |
| `supplier.bids.saveKeyPersonnel` | PUT | `/supplier/bids/:bidId/key-personnel` | `supplier.response.edit` | SUP-14 | — |
| `supplier.bids.saveConsortium` | PUT | `/supplier/bids/:bidId/consortium` | `supplier.response.edit` | SUP-14 | — |
| `supplier.bids.saveExceptions` | PUT | `/supplier/bids/:bidId/exceptions` | `supplier.response.edit` | SUP-14 | — |
| `supplier.bids.attachEvidence` | POST | `/supplier/bids/:bidId/evidence` | `supplier.response.edit` | SUP-14 | idempotent, 201 |
| `supplier.bids.detachEvidence` | DELETE | `/supplier/bids/:bidId/evidence/:evidenceItemId` | `supplier.response.edit` | SUP-14 | — |
| `supplier.bids.readiness` | GET | `/supplier/bids/:bidId/readiness` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit` | SUP-12, SUP-15, SUP-16 | — |
| `supplier.bids.revisions` | GET | `/supplier/bids/:bidId/revisions` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit` | SUP-15, SUP-17 | — |
| `supplier.bids.createRevision` | POST | `/supplier/bids/:bidId/revisions` | `supplier.response.edit` | SUP-17 | idempotent, 201 |
| `supplier.bids.review` | GET | `/supplier/bids/:bidId/review` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit` | SUP-15 | — |
| `supplier.bids.requestApproval` | POST | `/supplier/bids/:bidId/approvals` | `supplier.response.edit` | SUP-15 | idempotent, 201 |
| `supplier.bids.decideApproval` | POST | `/supplier/bids/:bidId/approvals/:approvalId/decide` | `supplier.response.approve` | SUP-15 | — |
| `supplier.bids.submissionPreview` | GET | `/supplier/bids/:bidId/submission` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit` | SUP-16 | — |
| `supplier.bids.submit` | POST | `/supplier/bids/:bidId/submit` | `supplier.response.submit` | SUP-16 | idempotent, 201 |
| `supplier.bids.receipts` | GET | `/supplier/bids/:bidId/receipts` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit`, `supplier.outcomes.view` | SUP-17 | — |
| `supplier.bids.attempts` | GET | `/supplier/bids/:bidId/submission-attempts` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit` | SUP-16, SUP-17 | — |
| `supplier.bids.withdrawals` | GET | `/supplier/bids/:bidId/withdrawals` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit`, `supplier.outcomes.view` | SUP-17 | — |
| `supplier.bids.withdraw` | POST | `/supplier/bids/:bidId/withdraw` | `supplier.response.submit` | SUP-17 | idempotent, 201 |
| `supplier.receipts.list` | GET | `/supplier/receipts` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit`, `supplier.outcomes.view` | SUP-17 | — |
| `supplier.receipts.get` | GET | `/supplier/receipts/:receiptId` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit`, `supplier.outcomes.view` | SUP-16, SUP-17 | — |
| `supplier.receipts.download` | GET | `/supplier/receipts/:receiptId/download` | `supplier.response.edit`, `supplier.pricing.edit`, `supplier.response.approve`, `supplier.response.submit`, `supplier.outcomes.view` | SUP-17 | — |
| `buyer.submissions.list` | GET | `/buyer/submission-monitoring` | `bid.monitor` | BUY-19 | — |
| `buyer.submissions.get` | GET | `/buyer/submission-monitoring/tenders/:tenderId` | `bid.monitor` | BUY-19 | — |
| `buyer.submissions.receipts` | GET | `/buyer/submission-monitoring/tenders/:tenderId/receipts` | `bid.monitor` | BUY-19 | — |
| `buyer.submissions.close` | POST | `/buyer/submission-monitoring/tenders/:tenderId/close` | `tender.close` | BUY-19 | — |

## 10 Opening and compliance

### `src/contracts/opening.ts` (30 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.opening.listTenders` | GET | `/buyer/opening/tenders` | `bid.open`, `bid.witness`, `compliance.assess`, `evaluation.chair`, `exclusion.approve` | BUY-20, BUY-21 | — |
| `buyer.opening.getTender` | GET | `/buyer/opening/tenders/:tenderId` | `bid.open`, `bid.witness`, `compliance.assess`, `evaluation.chair`, `exclusion.approve` | BUY-20 | — |
| `buyer.opening.getOpeningTeam` | GET | `/buyer/opening/tenders/:tenderId/opening-team` | `bid.open` | BUY-20 | — |
| `buyer.opening.listSessions` | GET | `/buyer/opening/sessions` | `bid.open`, `bid.witness`, `compliance.assess`, `evaluation.chair`, `exclusion.approve` | BUY-20 | — |
| `buyer.opening.getSession` | GET | `/buyer/opening/sessions/:sessionId` | `bid.open`, `bid.witness`, `compliance.assess`, `evaluation.chair`, `exclusion.approve` | BUY-20 | — |
| `buyer.opening.scheduleSession` | POST | `/buyer/opening/sessions` | `bid.open` | BUY-20 | idempotent, 201 |
| `buyer.opening.confirmParticipant` | POST | `/buyer/opening/sessions/:sessionId/participants/:participantId/confirm` | `bid.open`, `bid.witness` | BUY-20 | — |
| `buyer.opening.openSession` | POST | `/buyer/opening/sessions/:sessionId/open` | `bid.open` | BUY-20 | — |
| `buyer.opening.recordSession` | PUT | `/buyer/opening/sessions/:sessionId/record` | `bid.open` | BUY-20 | — |
| `buyer.opening.releasePublicSummary` | POST | `/buyer/opening/sessions/:sessionId/public-summary` | `bid.open` | BUY-20 | — |
| `buyer.opening.abortSession` | POST | `/buyer/opening/sessions/:sessionId/abort` | `bid.open` | BUY-20 | — |
| `buyer.opening.listBids` | GET | `/buyer/opening/tenders/:tenderId/bids` | `compliance.assess`, `exclusion.approve`, `evaluation.chair` | BUY-21 | — |
| `buyer.opening.getBidCompliance` | GET | `/buyer/opening/bids/:bidId/compliance` | `compliance.assess`, `exclusion.approve`, `evaluation.chair` | BUY-21 | — |
| `buyer.opening.recordCheck` | PUT | `/buyer/opening/checks/:checkId` | `compliance.assess` | BUY-21 | — |
| `buyer.opening.decideCompliance` | POST | `/buyer/opening/bids/:bidId/compliance-decision` | `compliance.assess` | BUY-21 | — |
| `buyer.opening.listClarifications` | GET | `/buyer/opening/clarifications` | `compliance.assess`, `evaluation.chair`, `exclusion.approve`, `evaluation.score` | BUY-21, EVA-03 | — |
| `buyer.opening.getClarification` | GET | `/buyer/opening/clarifications/:clarificationId` | `compliance.assess`, `evaluation.chair`, `exclusion.approve`, `evaluation.score` | BUY-21, EVA-03 | — |
| `buyer.opening.raiseClarification` | POST | `/buyer/opening/clarifications` | `compliance.assess`, `evaluation.chair`, `evaluation.score` | BUY-21, EVA-03 | idempotent, 201 |
| `buyer.opening.consolidateClarifications` | POST | `/buyer/opening/clarifications/:clarificationId/consolidate` | `evaluation.chair` | EVA-03 | — |
| `buyer.opening.approveClarification` | POST | `/buyer/opening/clarifications/:clarificationId/approve` | `evaluation.chair`, `exclusion.approve` | BUY-21, EVA-03 | — |
| `buyer.opening.issueClarification` | POST | `/buyer/opening/clarifications/:clarificationId/issue` | `compliance.assess`, `evaluation.chair` | BUY-21, EVA-03 | — |
| `buyer.opening.recordClarificationEffect` | POST | `/buyer/opening/clarifications/:clarificationId/effect` | `compliance.assess`, `evaluation.chair` | BUY-21, EVA-03 | — |
| `buyer.opening.listExclusions` | GET | `/buyer/opening/exclusions` | `compliance.assess`, `exclusion.approve` | BUY-21 | — |
| `buyer.opening.getExclusion` | GET | `/buyer/opening/exclusions/:exclusionId` | `compliance.assess`, `exclusion.approve` | BUY-21 | — |
| `buyer.opening.proposeExclusion` | POST | `/buyer/opening/exclusions` | `compliance.assess` | BUY-21 | idempotent, 201 |
| `buyer.opening.withdrawExclusion` | POST | `/buyer/opening/exclusions/:exclusionId/withdraw` | `compliance.assess` | BUY-21 | — |
| `buyer.opening.issueExclusionNotice` | POST | `/buyer/opening/exclusions/:exclusionId/notice` | `notice.issue` | BUY-21 | — |
| `supplier.opening.listAssessmentRequests` | GET | `/supplier/assessment-requests` | `supplier.response.edit`, `supplier.response.approve`, `supplier.response.submit`, `supplier.outcomes.view` | SUP-18 | — |
| `supplier.opening.getAssessmentRequest` | GET | `/supplier/assessment-requests/:requestId` | `supplier.response.edit`, `supplier.response.approve`, `supplier.response.submit`, `supplier.outcomes.view` | SUP-18 | — |
| `supplier.opening.respondAssessmentRequest` | POST | `/supplier/assessment-requests/:requestId/response` | `supplier.response.submit` | SUP-18 | — |

## 11 Evaluation

### `src/contracts/evaluation.ts` (33 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.evaluation.list` | GET | `/buyer/evaluation/tenders` | `evaluation.chair`, `evaluation.score`, `evaluation.commercial`, `evaluation.moderate`, `evaluation.signoff`, `award.recommend`, `award.approve` | EVA-01, EVA-05, EVA-06 | — |
| `buyer.evaluation.get` | GET | `/buyer/evaluation/tenders/:tenderId` | `evaluation.chair`, `evaluation.score`, `evaluation.commercial`, `evaluation.moderate`, `evaluation.signoff`, `award.recommend`, `award.approve` | EVA-01, EVA-05, EVA-06 | — |
| `buyer.evaluation.assignments.list` | GET | `/buyer/evaluation/assignments` | `evaluation.score`, `evaluation.commercial`, `evaluation.chair` | EVA-01 | — |
| `buyer.evaluation.assignments.get` | GET | `/buyer/evaluation/assignments/:assignmentId` | `evaluation.score`, `evaluation.commercial`, `evaluation.chair` | EVA-01 | — |
| `buyer.evaluation.assignments.accept` | POST | `/buyer/evaluation/assignments/:assignmentId/accept` | `evaluation.score`, `evaluation.commercial` | EVA-01 | — |
| `buyer.evaluation.assignments.declareConflict` | POST | `/buyer/evaluation/assignments/:assignmentId/conflict-declarations` | `evaluation.score`, `evaluation.commercial` | EVA-01 | idempotent, 201 |
| `buyer.evaluation.assignments.requestReassignment` | POST | `/buyer/evaluation/assignments/:assignmentId/reassignment-request` | `evaluation.score`, `evaluation.commercial` | EVA-01 | idempotent, 201 |
| `buyer.evaluation.assignments.reassignmentCandidates` | GET | `/buyer/evaluation/assignments/:assignmentId/reassignment-candidates` | `evaluation.chair` | EVA-01 | — |
| `buyer.evaluation.assignments.reassign` | POST | `/buyer/evaluation/assignments/:assignmentId/reassign` | `evaluation.chair` | EVA-01 | idempotent, 201 |
| `buyer.evaluation.conflicts.review` | POST | `/buyer/evaluation/conflict-declarations/:declarationId/review` | `evaluation.chair` | EVA-01 | — |
| `buyer.evaluation.assessment.get` | GET | `/buyer/evaluation/assignments/:assignmentId/assessment` | `evaluation.score`, `evaluation.chair` | EVA-02 | — |
| `buyer.evaluation.assessment.saveScores` | PUT | `/buyer/evaluation/assignments/:assignmentId/scores` | `evaluation.score` | EVA-02 | — |
| `buyer.evaluation.assessment.submit` | POST | `/buyer/evaluation/assignments/:assignmentId/submit` | `evaluation.score` | EVA-02 | — |
| `buyer.evaluation.assessment.correctScore` | POST | `/buyer/evaluation/assignments/:assignmentId/scores/:scoreId/corrections` | `evaluation.score` | EVA-02 | idempotent, 201 |
| `buyer.evaluation.commercial.get` | GET | `/buyer/evaluation/tenders/:tenderId/commercial` | `evaluation.commercial`, `evaluation.chair` | EVA-04 | — |
| `buyer.evaluation.commercial.proposeCorrection` | POST | `/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/corrections` | `evaluation.commercial` | EVA-04 | idempotent, 201 |
| `buyer.evaluation.commercial.approveCorrection` | POST | `/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/corrections/approve` | `evaluation.commercial` | EVA-04 | — |
| `buyer.evaluation.commercial.reviewAbnormallyLow` | POST | `/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/abnormally-low-review` | `evaluation.commercial` | EVA-04 | — |
| `buyer.evaluation.commercial.setReferenceSet` | POST | `/buyer/evaluation/commercial-evaluations/:commercialEvaluationId/reference-set` | `evaluation.commercial` | EVA-04 | — |
| `buyer.evaluation.commercial.approve` | POST | `/buyer/evaluation/tenders/:tenderId/commercial/approve` | `evaluation.commercial` | EVA-04 | — |
| `buyer.evaluation.commercial.scenario` | POST | `/buyer/evaluation/tenders/:tenderId/commercial/scenarios` | `evaluation.commercial` | EVA-04 | — |
| `buyer.evaluation.priceGate.release` | POST | `/buyer/evaluation/tenders/:tenderId/price-gate` | `evaluation.chair` | EVA-04, EVA-05 | — |
| `buyer.evaluation.moderation.get` | GET | `/buyer/evaluation/tenders/:tenderId/moderation` | `evaluation.moderate`, `evaluation.chair` | EVA-05 | — |
| `buyer.evaluation.moderation.recordScore` | POST | `/buyer/evaluation/moderation-sessions/:sessionId/scores` | `evaluation.moderate` | EVA-05 | idempotent, 201 |
| `buyer.evaluation.moderation.updateNotes` | PUT | `/buyer/evaluation/moderation-sessions/:sessionId/notes` | `evaluation.moderate` | EVA-05 | — |
| `buyer.evaluation.moderation.returnAssessment` | POST | `/buyer/evaluation/assignments/:assignmentId/return` | `evaluation.moderate` | EVA-05 | — |
| `buyer.evaluation.moderation.finalize` | POST | `/buyer/evaluation/moderation-sessions/:sessionId/finalize` | `evaluation.moderate` | EVA-05 | — |
| `buyer.evaluation.results.get` | GET | `/buyer/evaluation/tenders/:tenderId/results` | `evaluation.chair`, `evaluation.signoff`, `award.recommend`, `award.approve` | EVA-06 | — |
| `buyer.evaluation.results.validate` | POST | `/buyer/evaluation/tenders/:tenderId/results/validate` | `evaluation.chair` | EVA-06 | — |
| `buyer.evaluation.reports.submit` | POST | `/buyer/evaluation/reports/:reportId/submit` | `evaluation.chair` | EVA-06 | — |
| `buyer.evaluation.reports.signoff` | POST | `/buyer/evaluation/reports/:reportId/signoffs` | `evaluation.signoff` | EVA-06 | idempotent, 201 |
| `buyer.evaluation.reports.export` | POST | `/buyer/evaluation/reports/:reportId/exports` | `evaluation.chair`, `evaluation.signoff`, `award.recommend` | EVA-06 | idempotent, 202 |
| `buyer.evaluation.reports.handoff` | POST | `/buyer/evaluation/reports/:reportId/handoff` | `evaluation.chair` | EVA-06 | — |

## 12 Selection

### `src/contracts/selection.ts` (49 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.selection.tenders` | GET | `/buyer/selection/tenders` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-22, BUY-23, BUY-24, BUY-25, BUY-27 | — |
| `buyer.selection.tender` | GET | `/buyer/selection/tenders/:tenderId` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view`, `evaluation.chair`, `evaluation.score` | BUY-22, BUY-23, BUY-24, BUY-25, BUY-27 | — |
| `buyer.selection.sessions.list` | GET | `/buyer/selection/assessment-sessions` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view`, `evaluation.chair`, `evaluation.score` | BUY-22 | — |
| `buyer.selection.sessions.get` | GET | `/buyer/selection/assessment-sessions/:sessionId` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view`, `evaluation.chair`, `evaluation.score` | BUY-22 | — |
| `buyer.selection.sessions.create` | POST | `/buyer/selection/assessment-sessions` | `selection.manage` | BUY-22 | idempotent, 201 |
| `buyer.selection.sessions.confirmEqualTreatment` | POST | `/buyer/selection/assessment-sessions/:sessionId/equal-treatment` | `selection.manage` | BUY-22 | — |
| `buyer.selection.sessions.issueInvites` | POST | `/buyer/selection/assessment-sessions/:sessionId/invites` | `selection.manage` | BUY-22 | — |
| `buyer.selection.sessions.recordFinding` | POST | `/buyer/selection/assessment-sessions/:sessionId/findings` | `selection.manage`, `evaluation.score` | BUY-22 | idempotent, 201 |
| `buyer.selection.sessions.complete` | POST | `/buyer/selection/assessment-sessions/:sessionId/complete` | `selection.manage` | BUY-22 | — |
| `buyer.selection.sessions.cancel` | POST | `/buyer/selection/assessment-sessions/:sessionId/cancel` | `selection.manage` | BUY-22 | — |
| `buyer.selection.references.list` | GET | `/buyer/selection/reference-checks` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view`, `evaluation.chair`, `evaluation.score` | BUY-22 | — |
| `buyer.selection.references.create` | POST | `/buyer/selection/reference-checks` | `selection.manage` | BUY-22 | idempotent, 201 |
| `buyer.selection.references.recordFeedback` | POST | `/buyer/selection/reference-checks/:referenceCheckId/feedback` | `selection.manage` | BUY-22 | — |
| `buyer.selection.shortlists.list` | GET | `/buyer/selection/shortlists` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-23 | — |
| `buyer.selection.shortlists.get` | GET | `/buyer/selection/shortlists/:shortlistId` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-23 | — |
| `buyer.selection.shortlists.create` | POST | `/buyer/selection/shortlists` | `selection.manage` | BUY-23 | idempotent, 201 |
| `buyer.selection.shortlists.update` | PUT | `/buyer/selection/shortlists/:shortlistId` | `selection.manage` | BUY-23 | — |
| `buyer.selection.shortlists.change` | POST | `/buyer/selection/shortlists/:shortlistId/change` | `selection.manage` | BUY-23 | — |
| `buyer.selection.shortlists.notify` | POST | `/buyer/selection/shortlists/:shortlistId/notify` | `selection.manage` | BUY-23 | — |
| `buyer.selection.processDecisions.list` | GET | `/buyer/selection/process-decisions` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-24, BUY-25, BUY-27 | — |
| `buyer.selection.processDecisions.propose` | POST | `/buyer/selection/process-decisions` | `selection.manage`, `negotiation.conduct` | BUY-24, BUY-25, BUY-27 | idempotent, 201 |
| `buyer.selection.preferredBidders.list` | GET | `/buyer/selection/preferred-bidders` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-24 | — |
| `buyer.selection.preferredBidders.get` | GET | `/buyer/selection/preferred-bidders/:preferredBidderId` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-24 | — |
| `buyer.selection.preferredBidders.recommend` | POST | `/buyer/selection/preferred-bidders` | `selection.manage` | BUY-24 | idempotent, 201 |
| `buyer.selection.preferredBidders.withdraw` | POST | `/buyer/selection/preferred-bidders/:preferredBidderId/withdraw` | `selection.manage` | BUY-24 | — |
| `buyer.selection.preferredBidders.recordFallback` | POST | `/buyer/selection/preferred-bidders/:preferredBidderId/fallback` | `selection.manage` | BUY-24, BUY-25 | idempotent, 201 |
| `buyer.selection.diligence.list` | GET | `/buyer/selection/due-diligence-cases` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-25 | — |
| `buyer.selection.diligence.get` | GET | `/buyer/selection/due-diligence-cases/:caseId` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-25 | — |
| `buyer.selection.diligence.recordFinding` | POST | `/buyer/selection/due-diligence-cases/:caseId/findings` | `diligence.manage` | BUY-25 | idempotent, 201 |
| `buyer.selection.diligence.updateFinding` | PUT | `/buyer/selection/due-diligence-cases/:caseId/findings/:findingId` | `diligence.manage` | BUY-25 | — |
| `buyer.selection.diligence.requestEvidence` | POST | `/buyer/selection/due-diligence-cases/:caseId/evidence-requests` | `diligence.manage` | BUY-25 | idempotent, 201 |
| `buyer.selection.diligence.decide` | POST | `/buyer/selection/due-diligence-cases/:caseId/decide` | `diligence.manage`, `shortlist.approve` | BUY-25 | — |
| `buyer.selection.negotiations.list` | GET | `/buyer/selection/negotiations` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-27 | — |
| `buyer.selection.negotiations.get` | GET | `/buyer/selection/negotiations/:negotiationId` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-27 | — |
| `buyer.selection.negotiations.open` | POST | `/buyer/selection/negotiations` | `negotiation.conduct` | BUY-27 | idempotent, 201 |
| `buyer.selection.negotiations.recordRound` | POST | `/buyer/selection/negotiations/:negotiationId/rounds` | `negotiation.conduct` | BUY-27 | idempotent, 201 |
| `buyer.selection.negotiations.conclude` | POST | `/buyer/selection/negotiations/:negotiationId/conclude` | `negotiation.conduct` | BUY-27 | — |
| `buyer.selection.finalOffers.list` | GET | `/buyer/selection/final-offer-rounds` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-27 | — |
| `buyer.selection.finalOffers.get` | GET | `/buyer/selection/final-offer-rounds/:roundId` | `selection.manage`, `shortlist.approve`, `diligence.manage`, `negotiation.conduct`, `negotiation.approve`, `award.approve`, `audit.view` | BUY-27 | — |
| `buyer.selection.finalOffers.create` | POST | `/buyer/selection/final-offer-rounds` | `selection.manage` | BUY-27 | idempotent, 201 |
| `buyer.selection.finalOffers.issue` | POST | `/buyer/selection/final-offer-rounds/:roundId/issue` | `selection.manage` | BUY-27 | — |
| `buyer.selection.finalOffers.cancel` | POST | `/buyer/selection/final-offer-rounds/:roundId/cancel` | `selection.manage` | BUY-27 | — |
| `supplier.selection.invites.list` | GET | `/supplier/selection/assessment-invites` | `supplier.opportunities.view` | SUP-18 | — |
| `supplier.selection.invites.respond` | POST | `/supplier/selection/assessment-invites/:inviteId/respond` | `supplier.notices.acknowledge` | SUP-18 | — |
| `supplier.selection.negotiations.list` | GET | `/supplier/selection/negotiations` | `supplier.outcomes.view`, `supplier.pricing.edit` | SUP-19 | — |
| `supplier.selection.negotiations.get` | GET | `/supplier/selection/negotiations/:negotiationId` | `supplier.outcomes.view`, `supplier.pricing.edit` | SUP-19 | — |
| `supplier.selection.negotiations.respond` | POST | `/supplier/selection/negotiations/:negotiationId/rounds/:roundId/respond` | `supplier.response.submit` | SUP-19 | — |
| `supplier.selection.finalOffers.list` | GET | `/supplier/selection/final-offer-rounds` | `supplier.outcomes.view`, `supplier.pricing.edit` | SUP-19 | — |
| `supplier.selection.finalOffers.get` | GET | `/supplier/selection/final-offer-rounds/:roundId` | `supplier.outcomes.view`, `supplier.pricing.edit` | SUP-19 | — |

## 13 Awards, notices and complaints

### `src/contracts/awards.ts` (53 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.awards.list` | GET | `/buyer/awards` | `award.recommend`, `award.approve`, `notice.issue`, `event.closeout`, `audit.view` | BUY-26, BUY-30 | — |
| `buyer.awards.get` | GET | `/buyer/awards/:tenderId` | `award.recommend`, `award.approve`, `notice.issue`, `event.closeout`, `audit.view` | BUY-26, BUY-28 | — |
| `buyer.awards.getRecommendation` | GET | `/buyer/award-recommendations/:recommendationId` | `award.recommend`, `award.approve`, `notice.issue`, `event.closeout`, `audit.view` | BUY-26 | — |
| `buyer.awards.createRecommendation` | POST | `/buyer/awards/:tenderId/recommendations` | `award.recommend` | BUY-26 | idempotent, 201 |
| `buyer.awards.updateRecommendation` | PUT | `/buyer/award-recommendations/:recommendationId` | `award.recommend` | BUY-26 | — |
| `buyer.awards.submitRecommendation` | POST | `/buyer/award-recommendations/:recommendationId/submit` | `award.recommend` | BUY-26 | — |
| `buyer.awards.decideRecommendation` | POST | `/buyer/award-recommendations/:recommendationId/decision` | `award.approve` | BUY-26 | — |
| `buyer.awards.finalAward` | POST | `/buyer/lot-outcomes/:lotOutcomeId/final-award` | `award.recommend`, `award.approve` | BUY-26, BUY-28 | — |
| `buyer.awards.listNotices` | GET | `/buyer/awards/:tenderId/notices` | `notice.issue`, `award.recommend`, `award.approve`, `complaint.manage`, `audit.view` | BUY-28 | — |
| `buyer.awards.getNotice` | GET | `/buyer/outcome-notices/:noticeId` | `notice.issue`, `award.recommend`, `award.approve`, `complaint.manage`, `audit.view` | BUY-28 | — |
| `buyer.awards.createNotice` | POST | `/buyer/awards/:tenderId/notices` | `notice.issue` | BUY-28 | idempotent, 201 |
| `buyer.awards.issueNotice` | POST | `/buyer/outcome-notices/:noticeId/issue` | `notice.issue` | BUY-28 | — |
| `buyer.awards.resendNotice` | POST | `/buyer/outcome-notices/:noticeId/recipients/:recipientId/resend` | `notice.issue` | BUY-28 | — |
| `buyer.awards.getStandstill` | GET | `/buyer/awards/:tenderId/standstill` | `notice.issue`, `award.recommend`, `award.approve`, `complaint.manage`, `audit.view` | BUY-28 | — |
| `buyer.awards.extendStandstill` | POST | `/buyer/standstill-periods/:standstillId/extend` | `notice.issue` | BUY-28 | — |
| `buyer.awards.getPublicNotice` | GET | `/buyer/awards/:tenderId/public-notice` | `notice.issue`, `award.recommend`, `award.approve`, `complaint.manage`, `audit.view` | BUY-28 | — |
| `buyer.awards.savePublicNotice` | PUT | `/buyer/awards/:tenderId/public-notice` | `notice.issue` | BUY-28 | — |
| `buyer.awards.reviewPublicNotice` | POST | `/buyer/public-award-notices/:publicNoticeId/review` | `notice.issue` | BUY-28 | — |
| `buyer.awards.publishPublicNotice` | POST | `/buyer/public-award-notices/:publicNoticeId/publish` | `notice.issue` | BUY-28, PUB-05 | — |
| `buyer.awards.listDebriefs` | GET | `/buyer/debriefs` | `complaint.manage`, `debrief.manage`, `audit.view` | BUY-29 | — |
| `buyer.awards.getDebrief` | GET | `/buyer/debriefs/:debriefId` | `complaint.manage`, `debrief.manage`, `audit.view` | BUY-29 | — |
| `buyer.awards.scheduleDebrief` | POST | `/buyer/debriefs/:debriefId/schedule` | `debrief.manage` | BUY-29 | — |
| `buyer.awards.provideDebrief` | POST | `/buyer/debriefs/:debriefId/provide` | `debrief.manage` | BUY-29 | — |
| `buyer.awards.declineDebrief` | POST | `/buyer/debriefs/:debriefId/decline` | `debrief.manage` | BUY-29 | — |
| `buyer.awards.listComplaints` | GET | `/buyer/complaints` | `complaint.manage`, `debrief.manage`, `audit.view` | BUY-29 | — |
| `buyer.awards.getComplaint` | GET | `/buyer/complaints/:complaintId` | `complaint.manage`, `debrief.manage`, `audit.view` | BUY-29 | — |
| `buyer.awards.complaintOwnerCandidates` | GET | `/buyer/complaints/:complaintId/owner-candidates` | `complaint.manage` | BUY-29 | — |
| `buyer.awards.acknowledgeComplaint` | POST | `/buyer/complaints/:complaintId/acknowledge` | `complaint.manage` | BUY-29 | — |
| `buyer.awards.assignComplaintOwner` | POST | `/buyer/complaints/:complaintId/owner` | `complaint.manage` | BUY-29 | — |
| `buyer.awards.transitionComplaint` | POST | `/buyer/complaints/:complaintId/transition` | `complaint.manage` | BUY-29 | — |
| `buyer.awards.respondToComplaint` | POST | `/buyer/complaints/:complaintId/response` | `complaint.manage` | BUY-29 | — |
| `buyer.awards.recordAppealOutcome` | POST | `/buyer/complaints/:complaintId/appeal-outcome` | `complaint.manage` | BUY-29 | — |
| `buyer.awards.placeHold` | POST | `/buyer/complaints/:complaintId/hold` | `complaint.manage` | BUY-29 | — |
| `buyer.awards.releaseHold` | POST | `/buyer/complaints/:complaintId/hold/release` | `complaint.manage` | BUY-29 | — |
| `buyer.awards.getCloseout` | GET | `/buyer/awards/:tenderId/closeout` | `event.closeout`, `award.recommend`, `audit.view` | BUY-30 | — |
| `buyer.awards.updateCloseout` | PUT | `/buyer/awards/:tenderId/closeout` | `event.closeout` | BUY-30 | — |
| `buyer.awards.closeEvent` | POST | `/buyer/awards/:tenderId/closeout/close` | `event.closeout` | BUY-30 | — |
| `buyer.awards.archiveEvent` | POST | `/buyer/awards/:tenderId/closeout/archive` | `event.closeout` | BUY-30 | — |
| `buyer.awards.requestEvidencePack` | POST | `/buyer/awards/:tenderId/closeout/evidence-packs` | `export.create` | BUY-30 | idempotent, 201 |
| `supplier.outcomes.list` | GET | `/supplier/outcomes` | `supplier.outcomes.view` | SUP-21 | — |
| `supplier.outcomes.get` | GET | `/supplier/outcomes/:tenderId` | `supplier.outcomes.view` | SUP-21 | — |
| `supplier.outcomes.acknowledgeNotice` | POST | `/supplier/outcome-notices/:noticeId/acknowledge` | `supplier.notices.acknowledge` | SUP-21 | — |
| `supplier.outcomes.acceptTerms` | POST | `/supplier/outcome-notices/:noticeId/accept-terms` | `supplier.response.submit` | SUP-21 | — |
| `supplier.outcomes.requestDebrief` | POST | `/supplier/outcomes/:tenderId/debrief-requests` | `supplier.outcomes.view` | SUP-21 | idempotent, 201 |
| `supplier.complaints.list` | GET | `/supplier/complaints` | `supplier.complaint.submit`, `supplier.outcomes.view` | SUP-22 | — |
| `supplier.complaints.get` | GET | `/supplier/complaints/:complaintId` | `supplier.complaint.submit`, `supplier.outcomes.view` | SUP-22 | — |
| `supplier.complaints.tenders` | GET | `/supplier/complaint-tenders` | `supplier.complaint.submit` | SUP-22 | — |
| `supplier.complaints.create` | POST | `/supplier/complaints` | `supplier.complaint.submit` | SUP-22 | idempotent, 201 |
| `supplier.complaints.appeal` | POST | `/supplier/complaints/:complaintId/appeal` | `supplier.complaint.submit` | SUP-22 | — |
| `supplier.complaints.withdraw` | POST | `/supplier/complaints/:complaintId/withdraw` | `supplier.complaint.submit` | SUP-22 | — |
| `public.awards.list` | GET | `/public/awards` | — | PUB-05, PUB-01 | — |
| `public.awards.get` | GET | `/public/awards/:buyerSlug/:reference` | — | PUB-05 | — |
| `public.awards.downloadNotice` | GET | `/public/awards/:buyerSlug/:reference/notice` | — | PUB-05 | — |

## 14 Contracts

### `src/contracts/contracts.ts` (67 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.contracts.list` | GET | `/buyer/contracts` | `contract.view` | CON-01 | — |
| `buyer.contracts.get` | GET | `/buyer/contracts/:contractId` | `contract.view` | CON-05, CON-02, CON-03 | — |
| `buyer.contracts.awardSources` | GET | `/buyer/contract-award-sources` | `contract.prepare` | CON-02 | — |
| `buyer.contracts.assignees` | GET | `/buyer/contract-assignees` | `contract.view` | CON-01, CON-03, CON-05, CON-06 | — |
| `buyer.contracts.create` | POST | `/buyer/contracts` | `contract.prepare` | CON-02 | idempotent, 201 |
| `buyer.contracts.update` | PATCH | `/buyer/contracts/:contractId` | `contract.prepare` | CON-02 | — |
| `buyer.contracts.preparation` | GET | `/buyer/contracts/:contractId/preparation` | `contract.view` | CON-02 | — |
| `buyer.contracts.submitForReview` | POST | `/buyer/contracts/:contractId/submit-review` | `contract.prepare` | CON-02 | — |
| `buyer.contracts.reviewDecision` | POST | `/buyer/contracts/:contractId/review-decision` | `contract.approve` | CON-02 | — |
| `buyer.contracts.assignOwners` | POST | `/buyer/contracts/:contractId/owners` | `contract.manage`, `contract.prepare` | CON-01, CON-05 | — |
| `buyer.contracts.signature` | GET | `/buyer/contracts/:contractId/signature` | `contract.view` | CON-03 | — |
| `buyer.contracts.addSignatory` | POST | `/buyer/contracts/:contractId/signatories` | `contract.prepare` | CON-03 | idempotent, 201 |
| `buyer.contracts.sign` | POST | `/buyer/contracts/:contractId/signatories/:signatoryId/sign` | `contract.sign` | CON-03 | — |
| `buyer.contracts.recordExternalSignature` | POST | `/buyer/contracts/:contractId/signatories/:signatoryId/record-external` | `contract.prepare` | CON-03 | — |
| `buyer.contracts.returnToReview` | POST | `/buyer/contracts/:contractId/return-to-review` | `contract.prepare` | CON-03 | — |
| `buyer.contracts.authorizeCommencement` | POST | `/buyer/contracts/:contractId/commencement` | `contract.manage`, `contract.prepare` | CON-03 | — |
| `buyer.contracts.handover` | GET | `/buyer/contracts/:contractId/handover` | `contract.view` | CON-04 | — |
| `buyer.contracts.submitHandover` | POST | `/buyer/contracts/:contractId/handover/submit` | `contract.prepare` | CON-04 | — |
| `buyer.contracts.acceptHandover` | POST | `/buyer/contracts/:contractId/handover/accept` | `contract.manage` | CON-04 | — |
| `buyer.contracts.returnHandover` | POST | `/buyer/contracts/:contractId/handover/return` | `contract.manage` | CON-04 | — |
| `buyer.contracts.obligations` | GET | `/buyer/contracts/:contractId/obligations` | `contract.view` | CON-05, CON-06 | — |
| `buyer.contracts.obligation` | GET | `/buyer/contracts/:contractId/obligations/:obligationId` | `contract.view` | CON-06 | — |
| `buyer.contracts.createObligation` | POST | `/buyer/contracts/:contractId/obligations` | `contract.manage` | CON-05 | idempotent, 201 |
| `buyer.contracts.assignObligation` | POST | `/buyer/contracts/:contractId/obligations/:obligationId/assign` | `contract.manage` | CON-05 | — |
| `buyer.contracts.escalateObligation` | POST | `/buyer/contracts/:contractId/obligations/:obligationId/escalate` | `contract.manage` | CON-05 | — |
| `buyer.contracts.startObligationReview` | POST | `/buyer/contracts/:contractId/obligations/:obligationId/start-review` | `contract.manage` | CON-06 | — |
| `buyer.contracts.decideObligation` | POST | `/buyer/contracts/:contractId/obligations/:obligationId/decision` | `contract.manage` | CON-06 | — |
| `buyer.contracts.submitObligationEvidence` | POST | `/buyer/contracts/:contractId/obligations/:obligationId/evidence` | `contract.manage` | CON-05, CON-06 | idempotent, 201 |
| `buyer.contracts.releaseSecurity` | POST | `/buyer/contracts/:contractId/securities/:securityId/release` | `contract.manage` | CON-05, CON-11 | — |
| `buyer.contracts.performance` | GET | `/buyer/contracts/:contractId/performance` | `contract.view` | CON-07 | — |
| `buyer.contracts.performanceReview` | GET | `/buyer/contracts/:contractId/performance-reviews/:reviewId` | `contract.view` | CON-07 | — |
| `buyer.contracts.createPerformanceReview` | POST | `/buyer/contracts/:contractId/performance-reviews` | `contract.manage` | CON-07 | idempotent, 201 |
| `buyer.contracts.sharePerformanceReview` | POST | `/buyer/contracts/:contractId/performance-reviews/:reviewId/share` | `contract.manage` | CON-07 | — |
| `buyer.contracts.finalizePerformanceReview` | POST | `/buyer/contracts/:contractId/performance-reviews/:reviewId/finalize` | `contract.manage` | CON-07 | — |
| `buyer.contracts.recordIncident` | POST | `/buyer/contracts/:contractId/incidents` | `contract.manage` | CON-07 | idempotent, 201 |
| `buyer.contracts.createImprovementAction` | POST | `/buyer/contracts/:contractId/improvement-actions` | `contract.manage` | CON-07 | idempotent, 201 |
| `buyer.contracts.updateImprovementAction` | POST | `/buyer/contracts/:contractId/improvement-actions/:actionId/status` | `contract.manage` | CON-07 | — |
| `buyer.contracts.financials` | GET | `/buyer/contracts/:contractId/financials` | `contract.financials.view` | CON-08 | — |
| `buyer.contracts.recordInvoice` | POST | `/buyer/contracts/:contractId/invoices` | `contract.manage` | CON-08 | idempotent, 201 |
| `buyer.contracts.disputeInvoice` | POST | `/buyer/contracts/:contractId/invoices/:invoiceId/dispute` | `contract.manage` | CON-08 | — |
| `buyer.contracts.changes` | GET | `/buyer/contracts/:contractId/change-requests` | `contract.view` | CON-09 | — |
| `buyer.contracts.changeRequest` | GET | `/buyer/contracts/:contractId/change-requests/:changeId` | `contract.view` | CON-09 | — |
| `buyer.contracts.createChange` | POST | `/buyer/contracts/:contractId/change-requests` | `contract.manage` | CON-09 | idempotent, 201 |
| `buyer.contracts.assessChange` | POST | `/buyer/contracts/:contractId/change-requests/:changeId/assess` | `contract.manage` | CON-09 | — |
| `buyer.contracts.requestChangeApproval` | POST | `/buyer/contracts/:contractId/change-requests/:changeId/request-approval` | `contract.manage` | CON-09 | — |
| `buyer.contracts.decideChange` | POST | `/buyer/contracts/:contractId/change-requests/:changeId/decision` | `contract.change.approve` | CON-09 | — |
| `buyer.contracts.withdrawChange` | POST | `/buyer/contracts/:contractId/change-requests/:changeId/withdraw` | `contract.manage` | CON-09 | — |
| `buyer.contracts.incorporateChange` | POST | `/buyer/contracts/:contractId/change-requests/:changeId/incorporate` | `contract.manage` | CON-09 | — |
| `buyer.contracts.disputes` | GET | `/buyer/contracts/:contractId/disputes` | `contract.view` | CON-09 | — |
| `buyer.contracts.recordDispute` | POST | `/buyer/contracts/:contractId/disputes` | `contract.manage` | CON-09 | idempotent, 201 |
| `buyer.contracts.updateDispute` | POST | `/buyer/contracts/:contractId/disputes/:disputeId/status` | `contract.manage` | CON-09 | — |
| `buyer.contracts.renewals` | GET | `/buyer/contracts/:contractId/renewal-options` | `contract.view` | CON-10 | — |
| `buyer.contracts.decideRenewal` | POST | `/buyer/contracts/:contractId/renewal-options/:optionId/decision` | `contract.renewal.decide` | CON-10 | — |
| `buyer.contracts.notifyRenewal` | POST | `/buyer/contracts/:contractId/renewal-options/:optionId/notify` | `contract.renewal.decide` | CON-10 | — |
| `buyer.contracts.closeout` | GET | `/buyer/contracts/:contractId/closeout` | `contract.view` | CON-11 | — |
| `buyer.contracts.saveCloseout` | PUT | `/buyer/contracts/:contractId/closeout` | `contract.manage` | CON-11 | — |
| `buyer.contracts.closeContract` | POST | `/buyer/contracts/:contractId/closeout/close` | `contract.manage` | CON-11 | — |
| `supplier.contracts.list` | GET | `/supplier/contracts` | `supplier.contract.participate`, `supplier.outcomes.view` | SUP-23 | — |
| `supplier.contracts.get` | GET | `/supplier/contracts/:contractId` | `supplier.contract.participate`, `supplier.outcomes.view` | SUP-23 | — |
| `supplier.contracts.obligation` | GET | `/supplier/contracts/:contractId/obligations/:obligationId` | `supplier.contract.participate`, `supplier.outcomes.view` | SUP-23 | — |
| `supplier.contracts.sign` | POST | `/supplier/contracts/:contractId/signatories/:signatoryId/sign` | `supplier.contract.participate` | SUP-23 | — |
| `supplier.contracts.refuseSignature` | POST | `/supplier/contracts/:contractId/signatories/:signatoryId/refuse` | `supplier.contract.participate` | SUP-23 | — |
| `supplier.contracts.submitEvidence` | POST | `/supplier/contracts/:contractId/obligations/:obligationId/evidence` | `supplier.contract.participate` | SUP-23 | idempotent, 201 |
| `supplier.contracts.respondReview` | POST | `/supplier/contracts/:contractId/performance-reviews/:reviewId/response` | `supplier.contract.participate` | SUP-23 | — |
| `supplier.contracts.requestChange` | POST | `/supplier/contracts/:contractId/change-requests` | `supplier.contract.participate` | SUP-23 | idempotent, 201 |
| `supplier.contracts.agreeChange` | POST | `/supplier/contracts/:contractId/change-requests/:changeId/agree` | `supplier.contract.participate` | SUP-23 | — |
| `supplier.contracts.raiseDispute` | POST | `/supplier/contracts/:contractId/disputes` | `supplier.contract.participate` | SUP-23 | idempotent, 201 |

## 15 Reporting, records and search

### `src/contracts/reporting.ts` (21 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.dashboard.get` | GET | `/buyer/dashboard` | `dashboard.view` | BUY-01 | — |
| `supplier.dashboard.get` | GET | `/supplier/dashboard` | `supplier.dashboard.view` | SUP-01 | — |
| `buyer.reports.families` | GET | `/buyer/reports` | `report.view`, `report.manage` | REP-01, REP-02, ADM-13 | — |
| `buyer.reports.run` | GET | `/buyer/reports/:family` | `report.view`, `report.manage` | REP-01 | — |
| `buyer.reportDefinitions.list` | GET | `/buyer/report-definitions` | `report.view`, `report.manage` | ADM-13, REP-02, REP-01 | — |
| `buyer.reportDefinitions.get` | GET | `/buyer/report-definitions/:definitionId` | `report.view`, `report.manage` | ADM-13, REP-02 | — |
| `buyer.reportDefinitions.create` | POST | `/buyer/report-definitions` | `report.manage` | REP-02, ADM-13 | idempotent, 201 |
| `buyer.reportDefinitions.update` | PUT | `/buyer/report-definitions/:definitionId` | `report.manage` | REP-02, ADM-13 | — |
| `buyer.reportDefinitions.preview` | POST | `/buyer/report-definitions/preview` | `report.manage` | REP-02, ADM-13 | — |
| `buyer.reportDefinitions.setActive` | POST | `/buyer/report-definitions/:definitionId/activation` | `report.manage` | ADM-13 | — |
| `buyer.reportDefinitions.run` | POST | `/buyer/report-definitions/:definitionId/runs` | `report.manage` | ADM-13, REP-02 | idempotent, 201 |
| `buyer.reportDefinitions.recipients` | GET | `/buyer/report-recipients` | `report.manage` | REP-02, ADM-13 | — |
| `buyer.exports.list` | GET | `/buyer/exports` | `export.create`, `report.manage`, `audit.view` | ADM-13, REP-01, ADM-14 | — |
| `buyer.exports.get` | GET | `/buyer/exports/:exportId` | `export.create`, `report.manage`, `audit.view` | ADM-13, ADM-14 | — |
| `buyer.exports.create` | POST | `/buyer/exports` | `export.create` | REP-01, ADM-13 | idempotent, 201 |
| `buyer.exports.download` | GET | `/buyer/exports/:exportId/download` | `export.create`, `report.manage`, `audit.view` | ADM-13, REP-01, ADM-14 | — |
| `me.search.query` | GET | `/me/search` | — | COM-08 | — |
| `me.savedViews.list` | GET | `/me/saved-views` | — | COM-08 | — |
| `me.savedViews.create` | POST | `/me/saved-views` | — | COM-08 | idempotent, row tenant, 201 |
| `me.savedViews.update` | PUT | `/me/saved-views/:viewId` | — | COM-08 | row tenant |
| `me.savedViews.delete` | DELETE | `/me/saved-views/:viewId` | — | COM-08 | row tenant, 204 |

### `src/contracts/records.ts` (16 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `buyer.records.summary` | GET | `/buyer/records/summary` | `audit.view`, `records.retention.manage`, `records.hold.manage`, `records.disposal.approve`, `export.create` | ADM-14 | — |
| `buyer.records.auditEvents` | GET | `/buyer/records/audit-events` | `audit.view` | ADM-14 | — |
| `buyer.records.retentionClasses.list` | GET | `/buyer/records/retention-classes` | `audit.view`, `records.retention.manage`, `records.hold.manage`, `records.disposal.approve` | ADM-14 | — |
| `buyer.records.retentionClasses.update` | PUT | `/buyer/records/retention-classes/:retentionClassId` | `records.retention.manage` | ADM-14 | — |
| `buyer.records.holds.list` | GET | `/buyer/records/holds` | `audit.view`, `records.retention.manage`, `records.hold.manage`, `records.disposal.approve` | ADM-14 | — |
| `buyer.records.holds.get` | GET | `/buyer/records/holds/:holdId` | `audit.view`, `records.retention.manage`, `records.hold.manage`, `records.disposal.approve` | ADM-14 | — |
| `buyer.records.holds.create` | POST | `/buyer/records/holds` | `records.hold.manage` | ADM-14 | idempotent, 201 |
| `buyer.records.holds.release` | POST | `/buyer/records/holds/:holdId/release` | `records.hold.manage` | ADM-14 | — |
| `buyer.records.disposals.list` | GET | `/buyer/records/disposal-requests` | `audit.view`, `records.retention.manage`, `records.hold.manage`, `records.disposal.approve` | ADM-14 | — |
| `buyer.records.disposals.get` | GET | `/buyer/records/disposal-requests/:disposalRequestId` | `audit.view`, `records.retention.manage`, `records.hold.manage`, `records.disposal.approve` | ADM-14 | — |
| `buyer.records.disposals.approve` | POST | `/buyer/records/disposal-requests/:disposalRequestId/approve` | `records.disposal.approve` | ADM-14 | — |
| `buyer.records.disposals.reject` | POST | `/buyer/records/disposal-requests/:disposalRequestId/reject` | `records.disposal.approve` | ADM-14 | — |
| `buyer.records.disposals.execute` | POST | `/buyer/records/disposal-requests/:disposalRequestId/execute` | `records.disposal.approve` | ADM-14 | — |
| `buyer.records.evidencePacks.list` | GET | `/buyer/records/evidence-packs` | `audit.view`, `export.create` | ADM-14 | — |
| `buyer.records.evidencePacks.create` | POST | `/buyer/records/evidence-packs` | `export.create` | ADM-14 | idempotent, 201 |
| `buyer.records.subjects` | GET | `/buyer/records/subjects` | `records.hold.manage`, `export.create`, `audit.view` | ADM-14 | — |

## 16 Operations, help and integrations

### `src/contracts/operations.ts` (90 endpoints)

| Id | Method | Path under `/api/v1` | Permission (any of) | Screens | Flags |
|---|---|---|---|---|---|
| `ops.operations.customers.list` | GET | `/ops/customers` | `ops.customers.manage`, `ops.support.manage`, `ops.oversight.view` | OPS-01 | — |
| `ops.operations.customers.get` | GET | `/ops/customers/:customerTenantId` | `ops.customers.manage`, `ops.support.manage`, `ops.oversight.view` | OPS-01, OPS-02 | — |
| `ops.operations.customers.create` | POST | `/ops/customers` | `ops.customers.manage` | OPS-01 | idempotent, 201 |
| `ops.operations.customers.update` | PATCH | `/ops/customers/:customerTenantId` | `ops.customers.manage` | OPS-01 | — |
| `ops.operations.customers.changeStatus` | POST | `/ops/customers/:customerTenantId/status` | `ops.customers.manage` | OPS-01, OPS-02 | — |
| `ops.operations.onboarding.get` | GET | `/ops/customers/:customerTenantId/onboarding` | `ops.customers.manage`, `ops.support.manage`, `ops.oversight.view` | OPS-02 | — |
| `ops.operations.onboarding.updateItem` | POST | `/ops/customers/:customerTenantId/onboarding/items/:itemId` | `ops.customers.manage` | OPS-02 | — |
| `ops.operations.onboarding.advance` | POST | `/ops/customers/:customerTenantId/onboarding/advance` | `ops.customers.manage` | OPS-02 | — |
| `ops.operations.offboarding.list` | GET | `/ops/offboarding-plans` | `ops.customers.manage`, `ops.support.manage`, `ops.oversight.view` | OPS-02 | — |
| `ops.operations.offboarding.get` | GET | `/ops/offboarding-plans/:planId` | `ops.customers.manage`, `ops.support.manage`, `ops.oversight.view` | OPS-02 | — |
| `ops.operations.offboarding.create` | POST | `/ops/customers/:customerTenantId/offboarding-plan` | `ops.customers.manage` | OPS-02 | idempotent, 201 |
| `ops.operations.offboarding.update` | PATCH | `/ops/offboarding-plans/:planId` | `ops.customers.manage` | OPS-02 | — |
| `ops.operations.offboarding.transition` | POST | `/ops/offboarding-plans/:planId/transition` | `ops.customers.manage` | OPS-02 | — |
| `ops.operations.plans.list` | GET | `/ops/plans` | `ops.subscriptions.manage`, `ops.customers.manage`, `ops.oversight.view` | OPS-03 | — |
| `ops.operations.subscriptions.list` | GET | `/ops/subscriptions` | `ops.subscriptions.manage`, `ops.oversight.view` | OPS-03 | — |
| `ops.operations.subscriptions.get` | GET | `/ops/subscriptions/:subscriptionId` | `ops.subscriptions.manage`, `ops.oversight.view` | OPS-03 | — |
| `ops.operations.subscriptions.update` | PATCH | `/ops/subscriptions/:subscriptionId` | `ops.subscriptions.manage` | OPS-03 | — |
| `ops.operations.subscriptions.updateEntitlement` | PUT | `/ops/subscriptions/:subscriptionId/entitlements/:featureCode` | `ops.subscriptions.manage` | OPS-03 | — |
| `ops.operations.serviceActions.resolve` | POST | `/ops/service-actions/:actionId/resolve` | `ops.subscriptions.manage` | OPS-03 | — |
| `ops.operations.supportCases.list` | GET | `/ops/support-cases` | `ops.support.manage`, `ops.oversight.view` | OPS-04 | — |
| `ops.operations.supportCases.get` | GET | `/ops/support-cases/:caseId` | `ops.support.manage`, `ops.oversight.view` | OPS-04 | — |
| `ops.operations.supportCases.create` | POST | `/ops/support-cases` | `ops.support.manage` | OPS-04 | idempotent, 201 |
| `ops.operations.supportCases.assign` | POST | `/ops/support-cases/:caseId/assign` | `ops.support.manage` | OPS-04 | — |
| `ops.operations.supportCases.transition` | POST | `/ops/support-cases/:caseId/status` | `ops.support.manage` | OPS-04 | — |
| `ops.operations.supportCases.addMessage` | POST | `/ops/support-cases/:caseId/messages` | `ops.support.manage` | OPS-04 | idempotent, 201 |
| `ops.operations.supportCases.routeToBuyer` | POST | `/ops/support-cases/:caseId/route-to-buyer` | `ops.support.manage` | OPS-04 | — |
| `ops.operations.supportGrants.request` | POST | `/ops/support-cases/:caseId/access-grants` | `ops.support.manage` | OPS-04 | idempotent, 201 |
| `ops.operations.supportGrants.list` | GET | `/ops/support-access-grants` | `ops.support.manage`, `ops.oversight.view` | OPS-04, OPS-06 | — |
| `ops.operations.supportGrants.end` | POST | `/ops/support-access-grants/:grantId/end` | `ops.support.manage` | OPS-04 | — |
| `buyer.operations.supportAccess.list` | GET | `/buyer/support-access-grants` | `org.support_access.authorize` | OPS-04, ADM-17 | — |
| `buyer.operations.supportAccess.get` | GET | `/buyer/support-access-grants/:grantId` | `org.support_access.authorize` | OPS-04, ADM-17 | — |
| `buyer.operations.supportAccess.authorize` | POST | `/buyer/support-access-grants/:grantId/authorize` | `org.support_access.authorize` | OPS-04, ADM-17 | — |
| `buyer.operations.supportAccess.deny` | POST | `/buyer/support-access-grants/:grantId/deny` | `org.support_access.authorize` | OPS-04, ADM-17 | — |
| `buyer.operations.supportAccess.revoke` | POST | `/buyer/support-access-grants/:grantId/revoke` | `org.support_access.authorize` | OPS-04, ADM-17 | — |
| `me.operations.supportCases.list` | GET | `/me/support-cases` | — | COM-09 | — |
| `me.operations.supportCases.get` | GET | `/me/support-cases/:caseId` | — | COM-09 | — |
| `me.operations.supportCases.open` | POST | `/me/support-cases` | — | COM-09 | idempotent, row tenant, 201 |
| `me.operations.supportCases.reply` | POST | `/me/support-cases/:caseId/messages` | — | COM-09 | idempotent, row tenant, 201 |
| `me.operations.accommodations.request` | POST | `/me/accommodation-requests` | — | COM-09 | idempotent, row tenant, 201 |
| `ops.operations.incidents.list` | GET | `/ops/incidents` | `ops.incidents.manage`, `ops.oversight.view` | OPS-05 | — |
| `ops.operations.incidents.get` | GET | `/ops/incidents/:incidentId` | `ops.incidents.manage`, `ops.oversight.view` | OPS-05 | — |
| `ops.operations.incidents.create` | POST | `/ops/incidents` | `ops.incidents.manage` | OPS-05 | idempotent, 201 |
| `ops.operations.incidents.update` | POST | `/ops/incidents/:incidentId/updates` | `ops.incidents.manage` | OPS-05 | — |
| `ops.operations.incidents.addImpact` | POST | `/ops/incidents/:incidentId/impacts` | `ops.incidents.manage` | OPS-05 | idempotent, 201 |
| `ops.operations.oversight.summary` | GET | `/ops/oversight` | `ops.oversight.view` | OPS-06 | — |
| `ops.operations.accessReviews.list` | GET | `/ops/privileged-access-reviews` | `ops.oversight.view` | OPS-06 | — |
| `ops.operations.accessReviews.complete` | POST | `/ops/privileged-access-reviews/:reviewId/complete` | `ops.oversight.view` | OPS-06 | — |
| `ops.operations.conductCases.list` | GET | `/ops/conduct-cases` | `ops.oversight.view` | OPS-06 | — |
| `ops.operations.conductCases.review` | POST | `/ops/conduct-cases/:conductCaseId/review` | `ops.oversight.view` | OPS-06 | — |
| `ops.operations.announcements.list` | GET | `/ops/announcements` | `ops.content.manage`, `ops.oversight.view` | OPS-07 | — |
| `ops.operations.announcements.get` | GET | `/ops/announcements/:announcementId` | `ops.content.manage`, `ops.oversight.view` | OPS-07 | — |
| `ops.operations.announcements.create` | POST | `/ops/announcements` | `ops.content.manage` | OPS-07 | idempotent, 201 |
| `ops.operations.announcements.update` | PATCH | `/ops/announcements/:announcementId` | `ops.content.manage` | OPS-07 | — |
| `ops.operations.announcements.publish` | POST | `/ops/announcements/:announcementId/publish` | `ops.content.manage` | OPS-07 | — |
| `ops.operations.announcements.archive` | POST | `/ops/announcements/:announcementId/archive` | `ops.content.manage` | OPS-07 | — |
| `ops.operations.helpArticles.list` | GET | `/ops/help-articles` | `ops.content.manage`, `ops.oversight.view` | OPS-07 | — |
| `ops.operations.helpArticles.get` | GET | `/ops/help-articles/:articleId` | `ops.content.manage`, `ops.oversight.view` | OPS-07 | — |
| `ops.operations.helpArticles.create` | POST | `/ops/help-articles` | `ops.content.manage` | OPS-07 | idempotent, 201 |
| `ops.operations.helpArticles.update` | PATCH | `/ops/help-articles/:articleId` | `ops.content.manage` | OPS-07 | — |
| `ops.operations.helpArticles.publish` | POST | `/ops/help-articles/:articleId/publish` | `ops.content.manage` | OPS-07 | — |
| `ops.operations.helpArticles.archive` | POST | `/ops/help-articles/:articleId/archive` | `ops.content.manage` | OPS-07 | — |
| `me.operations.help.list` | GET | `/me/help-articles` | — | COM-09 | — |
| `me.operations.help.get` | GET | `/me/help-articles/:articleSlug` | — | COM-09 | — |
| `me.operations.help.contacts` | GET | `/me/help-contacts` | — | COM-09 | — |
| `me.operations.serviceNotices.list` | GET | `/me/service-notices` | — | COM-09 | — |
| `public.operations.serviceNotices.list` | GET | `/public/service-notices` | — | COM-09 | — |
| `public.operations.help.contacts` | GET | `/public/help-contacts` | — | COM-09 | — |
| `buyer.operations.integrations.list` | GET | `/buyer/integrations` | `org.integrations.manage` | ADM-15 | — |
| `buyer.operations.integrations.get` | GET | `/buyer/integrations/:connectionId` | `org.integrations.manage` | ADM-15 | — |
| `buyer.operations.integrations.create` | POST | `/buyer/integrations` | `org.integrations.manage` | ADM-15 | idempotent, 201 |
| `buyer.operations.integrations.update` | PATCH | `/buyer/integrations/:connectionId` | `org.integrations.manage` | ADM-15 | — |
| `buyer.operations.integrations.changeStatus` | POST | `/buyer/integrations/:connectionId/status` | `org.integrations.manage` | ADM-15 | — |
| `buyer.operations.integrations.confirm` | POST | `/buyer/integrations/:connectionId/confirm` | `org.integrations.manage` | ADM-15 | — |
| `buyer.operations.integrationExceptions.list` | GET | `/buyer/integration-exceptions` | `org.integrations.manage`, `tender.publish` | ADM-15 | — |
| `buyer.operations.integrationExceptions.get` | GET | `/buyer/integration-exceptions/:exceptionId` | `org.integrations.manage`, `tender.publish` | ADM-15 | — |
| `buyer.operations.integrationExceptions.assign` | POST | `/buyer/integration-exceptions/:exceptionId/assign` | `org.integrations.manage` | ADM-15 | — |
| `buyer.operations.integrationExceptions.investigate` | POST | `/buyer/integration-exceptions/:exceptionId/investigate` | `org.integrations.manage`, `tender.publish` | ADM-15 | — |
| `buyer.operations.integrationExceptions.resolve` | POST | `/buyer/integration-exceptions/:exceptionId/resolve` | `org.integrations.manage`, `tender.publish` | ADM-15 | — |
| `buyer.operations.imports.list` | GET | `/buyer/imports` | `org.imports.manage` | ADM-16 | — |
| `buyer.operations.imports.get` | GET | `/buyer/imports/:batchId` | `org.imports.manage` | ADM-16 | — |
| `buyer.operations.imports.records` | GET | `/buyer/imports/:batchId/records` | `org.imports.manage` | ADM-16 | — |
| `buyer.operations.imports.create` | POST | `/buyer/imports` | `org.imports.manage` | ADM-16 | idempotent, 201 |
| `buyer.operations.imports.decideRecord` | POST | `/buyer/imports/:batchId/records/:recordId/decide` | `org.imports.manage` | ADM-16 | — |
| `buyer.operations.imports.complete` | POST | `/buyer/imports/:batchId/complete` | `org.imports.manage` | ADM-16 | — |
| `buyer.operations.subscription.get` | GET | `/buyer/subscription` | `org.subscription.view` | ADM-17 | — |
| `buyer.operations.subscription.requestOffboarding` | POST | `/buyer/subscription/offboarding-request` | `org.settings.manage` | ADM-17 | idempotent, 201 |
| `buyer.operations.subscription.agreePlan` | POST | `/buyer/subscription/offboarding-plan/agree` | `org.settings.manage` | ADM-17 | — |
| `buyer.operations.subscription.requestExport` | POST | `/buyer/subscription/exit-exports` | `org.settings.manage` | ADM-17 | idempotent, 201 |
| `ops.operations.staff.list` | GET | `/ops/staff` | `ops.customers.manage`, `ops.subscriptions.manage`, `ops.support.manage`, `ops.incidents.manage`, `ops.content.manage`, `ops.oversight.view` | OPS-01, OPS-02, OPS-04, OPS-05 | — |
| `buyer.operations.people.list` | GET | `/buyer/operations-people` | `org.integrations.manage`, `org.imports.manage`, `tender.publish` | ADM-15, ADM-16 | — |
