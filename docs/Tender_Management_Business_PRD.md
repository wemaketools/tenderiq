# Tender Management Web Application

## Business Product Requirements Document

| Document attribute | Value |
| --- | --- |
| Version | 1.0 |
| Date | September 29, 2026 |
| Status | Proposed business baseline for stakeholder review |
| Product working name | Tender Management |
| Intended readers | Product owners, procurement leaders, business sponsors, supplier representatives, evaluators, finance, legal, compliance, contract managers, and business analysts |
| Source process | The 16-step tender process discussed in the Tender Basics conversation on September 26, 2026, including the subsequent discussion of supplier qualification |
| Scope of this document | Business capabilities, responsibilities, information, user journeys, screens, decisions, business rules, integrations, and business acceptance criteria |

This PRD expands the source process into a proposed product definition. The 16 steps are paraphrased in Section 6; they are not presented as a verbatim reproduction. Capabilities beyond those steps are proposed requirements, not previously confirmed user decisions. No technology choices, system architecture, programming details, or implementation design are prescribed.

“Must” describes required behavior within the proposed scope. “Configurable” means an authorized organization administrator can choose an approved business policy. “Extension” means an optional business module; its rules become mandatory when that module is offered. No procurement law, approval threshold, retention period, or standstill duration is assumed to apply universally.

## Contents

1. [Purpose, objectives, and success measures](#1-purpose-objectives-and-success-measures)
2. [Product scope and operating model](#2-product-scope-and-operating-model)
3. [Business concepts and records](#3-business-concepts-and-records)
4. [People, responsibilities, and access](#4-people-responsibilities-and-access)
5. [Organization and user management](#5-organization-and-user-management)
6. [Coverage of the original 16-step process](#6-coverage-of-the-original-16-step-process)
7. [End-to-end functional requirements](#7-end-to-end-functional-requirements)
8. [Lifecycle states and transition gates](#8-lifecycle-states-and-transition-gates)
9. [Evaluation and commercial comparison rules](#9-evaluation-and-commercial-comparison-rules)
10. [Cross-cutting business rules](#10-cross-cutting-business-rules)
11. [Public and supplier screens](#11-public-and-supplier-screens)
12. [Buyer and evaluator screens](#12-buyer-and-evaluator-screens)
13. [Contract, administration, and operator screens](#13-contract-administration-and-operator-screens)
14. [Documents, communication, and notifications](#14-documents-communication-and-notifications)
15. [Reporting and business measures](#15-reporting-and-business-measures)
16. [Potential business integrations](#16-potential-business-integrations)
17. [Business configuration and templates](#17-business-configuration-and-templates)
18. [Privacy, fairness, records, and oversight](#18-privacy-fairness-records-and-oversight)
19. [Service expectations and accessibility](#19-service-expectations-and-accessibility)
20. [Exceptional and alternate journeys](#20-exceptional-and-alternate-journeys)
21. [Product packaging and platform operations](#21-product-packaging-and-platform-operations)
22. [Proposed delivery priorities](#22-proposed-delivery-priorities)
23. [Business acceptance scenarios](#23-business-acceptance-scenarios)
24. [Launch readiness and adoption](#24-launch-readiness-and-adoption)
25. [Assumptions, decisions, risks, and references](#25-assumptions-decisions-risks-and-references)

## 1. Purpose, objectives, and success measures

### 1.1 Product purpose

Provide one accountable workspace for an organization to identify a purchasing need, obtain approval, invite competition, assess suppliers and offers, select a supplier, establish a contract, and manage the resulting obligations. Give suppliers a clear, accessible way to discover opportunities, understand requirements, prove their qualifications, prepare responses, submit on time, and follow the outcome.

The application must serve both sides of a tender while preserving the separation between the buyer's internal deliberations, each supplier's confidential work, and information intentionally released to the public.

### 1.2 Problems to solve

- Purchasing requests arrive without complete requirements, budget ownership, or a clear decision process.
- Tender documents, clarifications, approvals, and bid versions become scattered across email and shared files.
- Suppliers repeatedly provide the same evidence and may misunderstand deadlines or submission requirements.
- Buyers have difficulty demonstrating that bidders received equivalent information and were assessed consistently.
- Supplier qualification is confused with bid quality, or is treated as a one-time check despite changing circumstances.
- Award decisions lose their supporting evidence, and contract managers inherit incomplete commitments.
- Management cannot reliably measure cycle time, participation, commercial outcomes, workload, or supplier performance.

### 1.3 Business objectives

| Objective | Desired result | Measurement approach |
| --- | --- | --- |
| Improve control | Every procurement has an accountable owner, appropriate approvals, and a complete decision record. | Percentage of completed procurements with all required gates and evidence. |
| Reduce administrative effort | Reuse approved requirements, questionnaires, supplier evidence, and document templates. | Time spent preparing tenders and responding to repeat qualification requests. |
| Improve supplier participation | Suppliers can discover, understand, and successfully respond to relevant opportunities. | Qualified participation, abandonment reasons, submission support requests, and no-bid reasons. |
| Improve decision quality | Evaluations use declared criteria and documented reasoning. | Evaluation completeness, unresolved scoring differences, and justified exceptions. |
| Reduce unmanaged risk | Financial, capability, compliance, and performance concerns have owners and dispositions. | Expired evidence, overdue reassessments, unresolved high-risk conditions, and contract issues. |
| Preserve fairness and confidentiality | Information is released to the appropriate audience at the appropriate stage. | Confirmed disclosure incidents, substantiated process complaints, and unauthorized opening attempts. |
| Improve contract outcomes | Awarded commitments become tracked deliverables and obligations. | Handover completeness, milestone acceptance, service performance, and realized commercial results. |

Targets must be agreed after establishing a customer baseline. Business acceptance must not depend on invented savings percentages or participation benchmarks. Zero unauthorized disclosure of sealed bid content and complete evidence for formal award decisions are baseline control expectations.

## 2. Product scope and operating model

### 2.1 Proposed market and organizational model

The product supports private companies, public bodies, nonprofit organizations, and procurement service organizations. The core workflow is shared, but each buyer adopts a policy profile suitable for its own procurement obligations. Public-sector requirements must not automatically become mandatory for every private-sector customer.

A buyer organization is the primary boundary for its procurement policies, users, confidential records, supplier assessments, and reporting. It may contain legal entities, business units, departments, projects, locations, and purchasing categories. An umbrella organization may authorize consolidated reporting across its own entities.

A supplier is a business organization, not merely an individual login. One supplier may respond to multiple buyers, using a reusable profile and selectively shared evidence. Each buyer owns its own qualification decisions, internal assessments, communications, and procurement records. Those assessments are not visible to other buyers by default.

An individual may represent more than one organization or act in different capacities. The current organization and capacity must be obvious before any consequential action. Being an employee of a buyer does not authorize that person to see another organization's information when acting as a supplier.

### 2.2 Included in the core business scope

- Procurement planning, intake, business justification, budget confirmation, and approvals.
- RFI, RFQ, RFP, and formal tender events, with open or invitation-only participation.
- Supplier registration, reusable qualification, tender-specific eligibility, and ongoing qualification monitoring.
- Tender authoring, lots, requirements, pricing schedules, evaluation plans, publication, and amendments.
- Supplier questions, buyer clarifications, site visits, briefing sessions, and official notices.
- Supplier response preparation, internal collaboration, authorization to submit, bid receipt, and withdrawal.
- Controlled bid opening, compliance review, individual evaluation, moderation, shortlist, and preferred bidder selection.
- Presentations, demonstrations, references, due diligence, and permitted negotiation or final-offer rounds.
- Award approval, bidder notification, debriefing, applicable challenge periods, complaints, and public award notices.
- Contract finalization, handover, obligations, performance, changes, renewals, and closeout.
- Organization administration, user management, permission controls, records, reporting, and business integrations.

### 2.3 Optional extensions

- Framework agreements, supplier panels, call-offs, and mini-competitions.
- Joint procurement by multiple buying organizations.
- Specialized dialogue procedures and electronic reverse auctions.
- Construction-specific schedules, bonds, progress claims, defects, and retention obligations.
- Category-specific qualification programs and supplier development plans.
- Assisted drafting, summarization, and evidence comparison, with human accountability.
- Advanced portfolio forecasting and approved anonymized benchmarking.

### 2.4 Scope boundaries

The app must track procurement and contract business outcomes, but need not replace a full accounting, payment, inventory, payroll, project delivery, document editing, credit-rating, or legal case-management product. It may exchange relevant records and statuses with those products.

For example, it may record a contract payment milestone, evidence of acceptance, an invoice reference, and payment status. It is not required to operate a general ledger or execute bank payments. It may record supplier financial evidence and an assessor's conclusion; it must not represent a screening result as a guarantee of solvency.

## 3. Business concepts and records

These are business concepts and their minimum information needs, not a technical data model.

| Concept | Meaning and important business information |
| --- | --- |
| Procurement request | An internal need: requester, sponsor, purpose, scope, category, estimated value, currency, required dates, funding, risks, and attachments. |
| Procurement project | The overarching purchasing initiative. It may contain several linked events, such as market research, prequalification, and a final competition. |
| Tender or sourcing event | A defined invitation for information, quotations, proposals, or bids, with an owner, procedure, participants, documents, dates, rules, and outcome. |
| RFI | Request for Information: market research that does not itself promise a contract award. |
| RFQ | Request for Quotation: a request for commercial offers against reasonably defined requirements. |
| RFP | Request for Proposal: a request for a proposed solution, often assessed using quality and commercial criteria. |
| Lot | A separately identifiable part of a procurement, potentially with its own eligibility, response, evaluation, award, and contract outcome. |
| Tender version and addendum | The issued tender and a formally published amendment. An addendum records what changed, why, when, and whom it affects. |
| Requirement | A buyer need or question, including its applicability, mandatory or rated status, response instructions, evidence, and evaluation treatment. |
| Evaluation criterion | A declared basis for assessment, including weight, scale, scoring guidance, threshold, and responsible evaluators. |
| Supplier organization | The legal or recognized business submitting an offer: legal name, identifiers, locations, contacts, ownership disclosures where required, and categories served. |
| Buyer-supplier relationship | The buyer's record of a supplier, including invitations, qualification status, restrictions, contacts, contracts, and private assessments. |
| Consortium or joint venture | A bidding group with named members, a lead party, agreed responsibilities, and evidence of authority. It is assessed according to the tender's stated rules. |
| Subcontractor | A proposed delivery party whose scope, qualifications, and changes may need buyer approval; it is not automatically a bidder or portal participant. |
| Qualification program | Reusable eligibility requirements for a category, geography, contract scale, or buyer, with defined review and renewal rules. |
| Qualification application | A supplier's submitted evidence and declarations for a particular program or scope. |
| Qualification decision | The buyer's approved conclusion, scope, limitations, validity dates, conditions, rationale, and appeal options. |
| Evidence item | A financial statement, certificate, insurance record, license, reference, declaration, or other substantiation, including issuer, period, expiry, and sharing restrictions. |
| Participation record | Invitation, expression of interest, document access, acknowledgments, attendance, and supplier bid/no-bid status. |
| Bid or response | A supplier's offer for an event or one or more lots, including substantive responses, commercial terms, declarations, and supporting evidence. |
| Bid revision | A distinguishable edition of a response. Submitted revisions and receipts remain part of the record even if a later revision becomes effective. |
| Envelope | A business separation of response material, such as qualification, delivery proposal, and price, opened at different permitted stages. |
| Clarification | A formal question and answer about tender requirements or a submitted response; its purpose and audience are recorded. |
| Evaluation | An assessor's documented assessment of an eligible response against the approved criteria. |
| Moderated result | The approved committee result after any permitted reconciliation of individual assessments. |
| Approval | A decision by an authorized person or committee against a specific version, amount, scope, and supporting evidence. |
| Award | The approved allocation of all or part of a procurement to one or more suppliers. A preferred-bidder decision is not itself an award. |
| Contract | The binding commercial arrangement and its agreed scope, parties, values, dates, documents, obligations, and change history. |
| Obligation and milestone | A commitment or dated outcome with an accountable party, evidence of completion, acceptance criteria, and consequence for nonperformance. |
| Complaint or challenge | A formal objection with a complainant, grounds, dates, evidence, independent owner, decision, and effect on the procurement. |
| Audit record | Evidence of a business action or decision, identifying the actor, capacity, time, affected record, reason, and relevant previous state. |

Amounts must distinguish estimate, approved budget, submitted price, evaluated cost, intended award, actual award, contract ceiling, committed spend, and paid spend. These are different business measures and must not be presented interchangeably.

## 4. People, responsibilities, and access

### 4.1 User roles

| Role | Main responsibilities | Important restrictions |
| --- | --- | --- |
| Public visitor | Browse public notices, released documents, awards, and guidance. | No access to confidential responses, deliberations, or private supplier records. |
| Supplier organization administrator | Maintain organization profile, invite members, assign supplier responsibilities, manage evidence sharing. | Cannot grant buyer privileges or inspect other suppliers' information. |
| Supplier bid manager | Decide participation, coordinate responses, assign work, request internal approval. | Submission authority must be explicitly assigned. |
| Supplier contributor | Prepare assigned answers, evidence, or pricing. | Access may be limited by tender, section, or commercial sensitivity. |
| Supplier approver or authorized signatory | Approve a response, submit where authorized, accept commitments, or sign agreements. | Authority may be limited by entity, value, tender, or dates. |
| Internal requester | Describe a need, answer procurement questions, review fulfillment. | Cannot assume authority to publish or award. |
| Procurement officer or tender owner | Run the event, manage suppliers and communications, coordinate evaluation and recommendation. | Cannot bypass sealed-bid rules or required independent approvals. |
| Procurement manager | Approve strategy and process exceptions, supervise workload, authorize assigned decisions. | Authority is constrained by delegation limits and conflicts. |
| Budget owner or finance reviewer | Confirm funding, evaluate commercial affordability, assess financial evidence as assigned. | Financial-review access does not imply access to all procurement material. |
| Supplier qualification assessor | Review corporate, financial, capability, and compliance evidence. | Sees only assigned evidence and cannot silently alter supplier declarations. |
| Evaluation committee chair | Assign evaluators, manage conflicts, monitor completion, lead moderation. | Cannot overwrite individual submitted scores without a recorded correction process. |
| Evaluator or subject-matter expert | Assess assigned criteria and evidence, declare conflicts, provide reasons. | No unrelated bids, premature prices, or other assessors' scores before the permitted stage. |
| Bid-opening officer or witness | Authorize and record opening of eligible envelopes. | Opening rights are separate from authoring, evaluation, and award rights. |
| Legal or compliance reviewer | Review terms, procedure, exceptions, challenges, and sensitive decisions. | Access is based on assignment and business need. |
| Award approver or committee | Approve, reject, or return a documented award recommendation. | May not approve beyond delegated authority or through an unresolved conflict. |
| Contract manager | Accept handover, oversee obligations, changes, performance, renewal, and closeout. | Cannot rewrite the historical competition or award decision. |
| Auditor or oversight reviewer | Inspect permitted records and obtain controlled evidence exports. | Read-only business access; sealed contents remain unavailable before authorized opening. |
| Buyer organization administrator | Manage organizational settings, users, roles, and approved policy configuration. | Administration alone does not grant bid, evaluation, or financial-evidence access. |
| Platform operator or support agent | Manage customer accounts, service cases, subscriptions, and service incidents. | No routine entitlement to confidential procurement content or sealed bids. |

### 4.2 Permission principles

- Permissions must distinguish viewing, creating, editing, submitting, opening, evaluating, approving, publishing, exporting, and administering.
- A role may be scoped to an organization, legal entity, department, category, project, event, lot, or contract.
- User groups simplify assignment but cannot bypass restrictions on conflicts, authority limits, confidentiality, or process stage.
- Direct exceptional access grants must have an owner, reason, start date, and expiry. The effective permissions must be inspectable.
- Explicit restrictions, active suspensions, conflict restrictions, and sealed-envelope rules take precedence over broad role membership.
- The ability to assign privileges must itself be constrained; users cannot grant authority they are not permitted to delegate.
- Support access to unsealed customer content requires a documented business need, permitted customer authorization, limited duration, and an audit record. Support cannot submit, score, approve, or sign on behalf of a customer.

### 4.3 Audience and confidentiality matrix

| Information | Public visitor | Participating supplier | Assigned buyer team | Administrator or operator |
| --- | --- | --- | --- | --- |
| Public notice and released award summary | Visible when published | Visible | Visible | Public visibility only unless separately authorized |
| Restricted tender documents | Hidden | Visible only after required invitation or access approval | Visible within assignment | No automatic content access |
| General clarification and addendum | According to notice visibility | Same official version for all affected eligible participants | Visible within assignment | No special disclosure rights |
| Supplier draft response | Hidden | Own authorized team only | Hidden | Hidden |
| Submitted sealed response | Hidden | Own authorized team and receipt | Receipt metadata only until permitted opening | No early access |
| Opened response | Hidden unless a specific disclosure is approved | Own response only | Only assigned permitted sections and stages | No automatic access |
| Supplier financial evidence | Hidden | Own authorized financial users | Assigned qualification or financial reviewers | No automatic access |
| Individual evaluator scores | Hidden | Hidden | Author and specifically authorized oversight; committee access only at permitted stage | No automatic access |
| Buyer internal budget and deliberations | Hidden unless intentionally released | Hidden unless intentionally released | According to business assignment | No automatic access |
| Bidder identities and participation counts | Only where release policy allows | Only where release policy allows | Limited by event policy and stage | Operational metadata only as authorized |
| Complaint documents | Released redacted summary, if approved | Own case and permitted response | Case owner and authorized reviewers | Service metadata only |
| Contract and performance records | Approved public extract only | Own supplier-shared records | Assigned contract team | No automatic access |

An export, notification, search result, dashboard, or printed view must respect the same business access rules as the underlying record.

## 5. Organization and user management

### 5.1 Buyer organization onboarding

**FR-01 — Establish and maintain buying organizations.**

The onboarding process must identify the organization, contracting entities, procurement owner, administrator, currencies, working languages, official time zone, working calendar, and initial policy profile. It must establish responsible people for budget approval, publication, complaints, records retention, and contract ownership.

Administrators must maintain departments, locations, categories, cost centers, funding sources, committees, delegations, and reporting hierarchies. Deactivated values remain interpretable on historical records. A customer can use a simpler structure without inventing unnecessary departments or committees.

Joint procurement, if enabled, must identify the lead buyer, contributing organizations, funding shares, approval obligations, visibility boundaries, and eventual contracting parties. Participation does not give one organization unrestricted access to another's unrelated tenders.

### 5.2 Supplier registration and ownership

**FR-02 — Establish accountable supplier organizations.**

- Support open registration, invitation-led registration, and buyer-created provisional records.
- Collect business identity, registration jurisdiction and identifiers where applicable, trading names, contacts, locations, categories, service areas, and preferred languages.
- Separate contact verification, organization membership approval, identity verification, and procurement qualification. One does not prove the others.
- Suggest possible duplicate organizations for review; a shared email domain or similar name is insufficient evidence to merge records.
- Allow a supplier to request membership in an existing organization through a controlled approval process.
- Require evidence and review for ownership disputes, administrator recovery, legal-name changes, merger, succession, and transfer of representation.
- Preserve historic legal parties and submitted representations when a supplier changes its name or ownership.
- Let suppliers control which reusable evidence is shared with each buyer. A withdrawal of future sharing does not erase evidence already submitted into a legitimate procurement record.
- Keep supplier payment-account onboarding separate from tender participation; collect banking details only when needed for an authorized downstream purpose.

### 5.3 User lifecycle

**FR-03 — Manage individual access and authority.**

Users may be invited, pending acceptance, active, temporarily suspended, or deactivated. Invitation expiry, acceptance, membership approval, and role assignment must be visible to administrators. Expired invitations can be reissued without creating duplicate business identities.

Users must manage their name, contact details, language, notification preferences, and organization memberships within allowed limits. Changes to key contact or recovery details require appropriate confirmation. Stronger sign-in assurance may be required for administrators, bid openers, approvers, and signatories as a business policy.

When a person leaves, the organization must revoke access, review delegations, and reassign open tasks. Historical actions remain attributed to that person. Deactivation must not silently withdraw the organization's submitted bid, cancel its contract, or remove the evidence behind its decisions.

Temporary delegation must specify which decisions can be made, for whom, during what dates, and up to what authority. The record must show both the acting person and the delegated capacity. A delegate cannot approve a conflicting decision or expand the original authority. Emergency administrator recovery must not compromise sealed-bid or approval controls.

### 5.4 Segregation of duties and conflicts

The organization must be able to require different people for drafting and final approval, submission custody and opening authorization, individual evaluation and final award approval, or supplier assessment and approval of an exception. Small organizations may adopt documented alternative oversight, but may not silently disable the control.

Conflict declarations must cover financial interests, personal relationships, prior employment, involvement in preparing a supplier response, and other relevant circumstances. A declared conflict triggers review, possible recusal, reassignment, and a recorded disposition. Membership of both buyer and supplier organizations must be visible to the appropriate conflict reviewer without publicly exposing unrelated personal information.

## 6. Coverage of the original 16-step process

| Source step, paraphrased | Required application support | Main requirement groups | Main screens |
| --- | --- | --- | --- |
| 1. Buyer identifies a need. | Intake, justification, scope, budget, ownership, and approval. | FR-04 | BUY-02 to BUY-04 |
| 2. Buyer decides how to approach the market. | Procedure selection, market research, timetable, risk, and sourcing strategy. | FR-05 | BUY-05, BUY-06 |
| 3. Buyer prepares tender documents. | Requirements, lots, pricing schedules, terms, evaluation criteria, and approvals. | FR-07 | BUY-07 to BUY-13 |
| 4. Buyer issues the tender. | Public notices, controlled invitations, registration, document access, and publication history. | FR-08 | PUB-01 to PUB-03, BUY-14, BUY-15 |
| 5. Suppliers study the tender and decide whether to bid. | Opportunity review, qualification readiness, bid/no-bid decision, and team setup. | FR-09 | SUP-06 to SUP-09 |
| 6. Suppliers ask questions and buyers clarify or amend. | Formal questions, moderated answers, addenda, equal release, and acknowledgments. | FR-10 | SUP-10, BUY-16, BUY-17 |
| 7. Suppliers prepare bids. | Collaborative answers, evidence, pricing, declarations, and internal approval. | FR-11 | SUP-09, SUP-12 to SUP-15 |
| 8. Suppliers submit before the deadline. | Final review, authorized submission, receipts, revisions, withdrawal, and closure. | FR-12 | SUP-16, SUP-17, BUY-19 |
| 9. Buyer checks compliance. | Authorized opening, mandatory checks, permitted clarifications, and exclusion decisions. | FR-13 | BUY-20, BUY-21 |
| 10. Buyer evaluates bids against weighted criteria. | Independent scoring, commercial comparison, moderation, ranking, and evidence. | FR-14 | EVA-01 to EVA-06 |
| 11. Buyer conducts demonstrations, interviews, or references. | Comparable sessions, approved questions, evidence, and recorded assessments. | FR-15 | BUY-22, SUP-18 |
| 12. Buyer shortlists suppliers. | Approved shortlist, rationale, next-stage invitations, and supplier notifications. | FR-15 | BUY-23 |
| 13. Buyer identifies a preferred bidder. | Recommendation, comparative rationale, unresolved conditions, and approval. | FR-16 | BUY-24, BUY-26 |
| 14. Buyer conducts due diligence and negotiations. | Financial and capability checks, negotiation records, final offers, and conditions. | FR-06, FR-16 | BUY-25, BUY-27, SUP-19 |
| 15. Buyer awards the contract. | Approval, applicable intent notice and standstill, complaints, award, and contract finalization. | FR-17, FR-18 | BUY-28 to BUY-30, CON-02, CON-03 |
| 16. Delivery begins and the contract is managed. | Handover, obligations, performance, changes, payment-status visibility, renewal, and closure. | FR-18, FR-19 | CON-04 to CON-11 |

Qualification can occur before invitation, during response assessment, before award, and during contract performance. It must not be confined to a single step. Steps such as demonstrations, negotiation, or standstill are included when the approved procedure calls for them; a workflow records why an optional step does not apply.

## 7. End-to-end functional requirements

### 7.1 Intake, planning, and approval

**FR-04 — Convert a business need into an authorized procurement.**

Requesters must describe the problem or opportunity, expected outcomes, scope, quantities or service volumes, delivery locations, target dates, known constraints, stakeholders, and consequences of delay. They must identify whether the need replaces an existing contract, extends an existing service, or represents new expenditure.

The request must include estimated value and currency, the estimation basis, funding source, budget owner, relevant accounting or project references, proposed contract term, renewal options, and estimated total commitment. Options, related lots, and associated purchases must be visible when deciding the applicable approval route.

Procurement may request more information, combine related requests, divide work into justified lots, route to an existing contract, defer, or reject with reasons. Combining requests must preserve the original requesters, funding interests, and requirements. Splitting work must not hide the overall value used for the approved procurement policy.

Approvals must record the business case, funding status, authority, conditions, and version approved. The app must distinguish indicative funding, approved budget, and a firm spending commitment. A change in material scope, amount, funding, risk, or contracting entity must trigger the relevant reconsideration.

### 7.2 Market approach and procurement strategy

**FR-05 — Select and authorize an appropriate procedure.**

| Procedure | Business purpose | Required distinctions |
| --- | --- | --- |
| RFI or market consultation | Understand suppliers, approaches, and market conditions. | State that participation does not itself create an award entitlement; control future use of shared information. |
| Open competition | Invite any supplier meeting published conditions. | Public discovery, consistent access conditions, and objective eligibility. |
| Restricted or prequalified competition | Invite suppliers selected through an approved eligibility process. | Link the qualification or shortlist decision and preserve reasons for selection. |
| Invitation-only quotation or proposal | Seek responses from named suppliers. | Approved invite list, additions, refusals, and sufficient-competition review where policy requires it. |
| Multi-stage competition | Progress from initial response to selected subsequent stages. | Announced stage rules, promotion decisions, distinct deadlines, and preserved stage submissions. |
| Direct or sole-source procurement | Buy from a specified source under an approved exception. | Exception grounds, approver, value, justification, and any required disclosure; no fabricated competitive history. |
| Framework call-off or mini-competition | Purchase through an existing approved arrangement. | Framework scope, eligible members, term, ceiling, and agreed ordering or competition rules. |

The strategy must define the intended procurement outcome, procedure, competition rationale, category, risks, qualification approach, lot structure, award model, evaluation method, negotiation permissions, approval route, and timetable. It must identify any external oversight or funding-body approvals.

Market research must record its sources and distinguish unverified estimates from supplier commitments. Prior supplier involvement in shaping specifications must trigger a fairness review where relevant. Unsuccessful RFI participants are not automatically excluded from later competitions.

An information-only event must be able to conclude with reviewed market findings and a next-step decision, without inventing an award, signed contract, or failed competition. Any later RFQ, RFP, or tender must be a separately identified linked event with its own issued conditions and approvals.

### 7.3 Supplier qualification and ongoing eligibility

**FR-06 — Assess whether a supplier is suitable for the relevant business scope.**

Qualification must be reusable, scoped, dated, reviewable, and separate from the score of a particular bid. A supplier may be qualified for one category or contract size and unqualified for another. Registration or acceptance of portal terms does not mean the supplier is qualified.

| Assessment area | Potential evidence | Business assessment |
| --- | --- | --- |
| Corporate standing | Registration, legal identity, ownership disclosures, authorized representatives. | Whether the supplier exists, can act, and has disclosed required relationships. |
| Financial capacity | Financial statements, turnover, liquidity or leverage measures, credit assessments, parent support, insolvency declarations. | Whether the supplier can sustain the contemplated commitment, with limitations recorded. |
| Capability and capacity | Comparable contracts, staffing, qualifications, equipment, delivery footprint, current workload. | Whether the supplier can perform the work at the required scale and time. |
| Quality and operational controls | Certifications, quality practices, continuity plans, incident history. | Whether required operational controls and resilience are evidenced. |
| Insurance and security | Policy certificates, coverage limits, expiry dates, guarantees, bonds where applicable. | Whether required coverage or security is valid for the proposed scope. |
| Regulatory and professional eligibility | Licenses, permits, professional registrations, relevant declarations. | Whether relevant conditions are met for the locations and activities concerned. |
| Integrity and restrictions | Exclusion declarations, approved sanctions or debarment checks, conflict disclosures. | Whether a reviewed restriction or integrity concern affects eligibility. |
| Social and environmental requirements | Declared practices, relevant certifications, substantiation of requested commitments. | Whether published, proportionate category-specific requirements are met. |
| References and past performance | Reference responses and permitted historical performance records. | Whether verified experience supports the requested qualification. |

Questionnaires must support mandatory evidence, explanatory answers, applicability choices, document validity periods, and assessor findings. “Not applicable” requires a reason where relevant; missing evidence is not silently treated as a pass. A financial ratio or screening match may flag a review but must not independently create an unexplained rejection.

Financial evidence must record the financial period, reporting currency, whether figures are consolidated or entity-specific, source, review date, and material qualifications. A parent company's strength cannot automatically qualify a subsidiary without the support required by the program. Consortia must follow declared rules for combined and member-specific capacity.

The review process must allow questions, requests for evidence, specialist assessment, independent approval where required, and outcomes of qualified, qualified with conditions, not qualified, suspended, expired, or withdrawn. Conditional approval must state exactly which activities remain allowed and which future gate is blocked until the condition is satisfied.

Qualification decisions must record the applicable criteria version, evidence considered, scope, effective dates, reviewer, approver, reasons, restrictions, and reassessment date. Suppliers receive an appropriate explanation and any review or appeal route, without disclosure of protected internal material.

Expiry reminders, ownership changes, significant financial changes, expired insurance, adverse findings, and poor performance can trigger reassessment. New information does not silently rewrite eligibility at an earlier submission deadline. The buyer must assess its effect on active bids and contracts and record any authorized action.

### 7.4 Tender authoring and release approval

**FR-07 — Produce a complete, internally consistent invitation.**

The tender owner must be able to create an event from an approved template, a prior event, or a blank business form. Reuse must copy content for review without copying past bids, confidential deliberations, approvals, or supplier-specific outcomes into a new competition.

The issued package must identify:

- Buyer and contracting entity; event reference, title, summary, category, scope, and contacts.
- Procedure, eligibility, geographic or delivery requirements, participation restrictions, and award model.
- Lots, quantities, service volumes, delivery dates, optional items, alternatives, and partial-bid rules.
- Required answers, documents, declarations, evidence, pricing schedules, and contract exceptions.
- Mandatory requirements versus rated criteria; weights, thresholds, scoring approach, cost comparison, and tie rules at the level required for disclosure.
- Dates for questions, briefings, visits, submissions, opening where disclosed, expected award, and contract start.
- Official time zone, relevant working-day calendar, bid validity, accepted languages and currencies.
- Rules for submission, revision, withdrawal, late material, acknowledgments, and authorized representatives.
- Whether negotiation, demonstrations, reference checks, final offers, or alternative proposals are permitted.
- Draft contract terms, insurances, securities, confidentiality conditions, and applicable complaint process.
- Document precedence, official communication channel, public/private classifications, and amendment process.

Each requirement must identify its owner, applicability, response form, evidence, mandatory or rated treatment, and evaluation association. The tender must identify the consequence of a missing item; business eligibility requirements must not be confused with simple response-completeness warnings.

Pricing schedules must distinguish one-time and recurring charges, quantities, unit prices, taxes, duties, shipping, discounts, options, provisional items, assumptions, and evaluation periods where applicable. Terms such as “included,” “not offered,” and zero price must have distinct meanings.

Before release, reviewers must verify scope, funding, terms, evaluation readiness, dates, accessibility, languages, supplier burden, permissions, and approval authority. Publication must be blocked if required approvals or material tender information are incomplete.

### 7.5 Publication, invitation, and participation

**FR-08 — Release the opportunity to the approved audience.**

Open tenders must have a searchable public notice and a clear route to documents and participation. Access to public notices must not require an account. Registration may be required for restricted documents, questions, subscriptions, or submission according to the published conditions.

Invitation-only events must be visible only to intended organizations and authorized buyer users. Invitations must record the organization, intended contact, delivery status, response, and any expiry. Replacing a contact does not change the invited legal supplier. Forwarding an invitation does not automatically authorize another organization.

Document-access conditions, such as a confidentiality undertaking or eligibility review, must be clearly disclosed and applied consistently. The tender owner must track interested suppliers, invitations, access decisions, required acknowledgments, and participation readiness without seeing supplier drafts.

The public notice must make current status, deadline, official time zone, amendment history, cancellation, and outcome clear. An event published on an external notice service must have publication confirmation and a reconciled official version before being treated as successfully advertised.

### 7.6 Supplier opportunity review and bid/no-bid

**FR-09 — Help a supplier make and manage a participation decision.**

Suppliers must discover relevant opportunities by buyer, category, geography, procedure, status, and deadline; save searches; subscribe to notices; and maintain a watchlist. Matches are suggestions, not qualification decisions or invitations to restricted events.

The opportunity workspace must summarize requirements, dates, document versions, required qualification, contract conditions, visits, and outstanding acknowledgments. A supplier can record internal attractiveness, capacity, estimated effort, risks, pursuit owner, and a bid/no-bid decision. Private pursuit notes and draft progress remain invisible to the buyer.

Suppliers may explicitly decline an invitation and optionally share a reason. Declining must not remove access to a previously submitted bid or contractual record. If reconsideration is permitted before closing, the decision can be revised without altering the audit history.

### 7.7 Questions, briefings, visits, and amendments

**FR-10 — Maintain a fair and authoritative clarification process.**

Suppliers must submit questions against a tender, lot, requirement, or document. The buyer assigns an owner, prepares an answer, reviews confidentiality, and publishes to the correct audience. Shared answers must normally omit the questioner's identity and commercially sensitive wording.

An answer that changes scope, terms, submission requirements, or evaluation must become a formal addendum. The buyer must identify affected lots and participants, decide whether more response time is needed, obtain approval where required, and issue the change to all affected eligible participants.

The event must retain every issued version, a description of changes, release time, audience, delivery status, and acknowledgments. Later registrants must receive the complete current package and relevant amendment history. Mandatory acknowledgment of an addendum must be visible in submission readiness.

Briefings and site visits must support session details, registration, capacity, attendance, accessibility needs, minutes, and any permitted alternative session. Mandatory attendance requirements must be declared in advance. Material answers given during a visit or meeting must be formally shared with the relevant competition audience.

Questions after the question deadline require an explicit disposition. Private supplier-specific clarifications may remain private where legitimate, but material information that changes the competition must be shared consistently. Unrecorded personal email must not become the authoritative source of changed tender terms.

### 7.8 Supplier response preparation and internal authorization

**FR-11 — Prepare a complete, controlled supplier response.**

The supplier must be able to select eligible lots, assign response owners and reviewers, set internal due dates, and maintain private comments. Commercial sections and sensitive financial evidence may have narrower access than general proposal material.

Responses must support structured answers, offered quantities, proposed methods, supporting documents, references, key personnel, subcontractors, deviations, alternatives where allowed, and declarations. Reusable supplier content must be reviewed for relevance and currency before inclusion; reuse is not a fresh certification by itself.

The workspace must distinguish unfinished, ready for review, internally approved, and formally submitted work. A completeness review must identify missing required answers, unacknowledged addenda, inconsistent pricing, expired evidence, missing authority, and unmet participation conditions. Warnings and submission-blocking errors must be clearly distinguished.

Internal supplier approval may be optional or required by the supplier's policy. The supplier may require approval by commercial, financial, delivery, or executive representatives. Approval applies to a particular response revision. Material changes afterward require the applicable reapproval before submission.

The final declaration must identify the submitting legal party, authorized representative, offered lots, response revision, relevant terms, bid validity, and outstanding exceptions. Supplier users must understand that saving or internally approving a draft is not submission.

### 7.9 Submission, receipts, revisions, and withdrawal

**FR-12 — Establish an unambiguous official response record.**

The supplier must deliberately authorize submission. A successful submission produces a receipt identifying the event, supplier, lots, revision, officially recorded receipt time, status, and submitted document inventory. The receipt confirms receipt, not compliance, qualification, evaluation success, or award.

Only material received and finalized within the applicable submission window counts as submitted. Beginning a transfer or pressing a button before the deadline is insufficient if final receipt occurs afterward. The app must give clear progress and failure information and must not imply success when no official receipt exists.

The proposed default allows replacement before closing. The previously submitted revision remains effective while a replacement is being prepared; it is superseded only after a complete replacement submission succeeds. A failed replacement must not destroy the earlier valid submission. The supplier may instead explicitly withdraw, with a clear confirmation of its effect.

The receipt and submission history must distinguish received, superseded, withdrawn, late/rejected, and selected-for-evaluation revisions. At closing, each supplier has at most one effective primary response per allowed bidding combination and lot; permitted alternatives remain explicitly related offers. Joint and overlapping bids follow the tender's declared rules.

An addendum must state whether existing submissions need acknowledgment, supplementary material, or replacement. Where a new mandatory condition applies, an earlier receipt alone does not satisfy it. Suppliers must be notified of the required action; the historical submission remains preserved, and the later compliance decision is explicit.

Late submissions and post-deadline replacements are rejected by default. Any exceptional treatment requires an applicable policy basis, an authorized decision, evidence, and equal-treatment review. A general administrator cannot simply change a timestamp or declare a late response timely.

### 7.10 Closing, opening, and compliance review

**FR-13 — Protect submissions and determine admissibility.**

Closing must stop ordinary submissions according to the official deadline. Tender owners may see permitted receipt metadata but cannot read sealed content before the authorized opening. The app must support one-stage opening and staged opening of qualification, delivery-proposal, and commercial material.

Opening must require the assigned officer and any required second person or committee quorum. The opening record must identify participants, authority, time, envelopes opened, any irregularities, and the permitted minutes. A public opening, where required, releases only the information allowed by the procedure.

A compliance checklist must assess submission timeliness, authorized declarations, required documents, eligibility, mandatory requirements, attendance, acknowledgments, securities, and lot restrictions. Each finding must cite evidence and have a disposition: pass, fail, clarification required, or not applicable with a reason.

The buyer must distinguish an administrative omission, substantive noncompliance, and a matter that may lawfully or contractually be clarified. A clarification cannot quietly become an improved offer after closing. Its permitted scope, deadline, response, and effect on compliance must be recorded.

Exclusion decisions require reasons and the applicable approval. Suppliers receive the permitted notification and challenge route. Excluded responses remain in the record but do not appear as ordinary ranked competitors. Unopened price envelopes of failed bidders remain closed unless the approved procedure permits later release.

### 7.11 Evaluation and moderation

**FR-14 — Produce a defensible assessment under the issued rules.**

The chair must establish the committee, assignments, deadlines, scoring guide, confidentiality acknowledgments, and conflict declarations. Assessors must see the response sections relevant to their assignment and the correct tender and bid versions.

Evaluators must record a score, reasons, evidence references, and clarification needs for each assigned criterion. The app must make missing work visible without substituting zero for an unanswered assessment. Submitted individual assessments become formal records; corrections require a reason and retained history.

Where independent evaluation is required, an evaluator must not see others' scores before submitting their own. Commercial prices must remain unavailable until the required non-price review gate is met. Any permitted concealment of bidder identity must state its limitations when proposal content can identify the bidder.

Moderation must show differences, support discussion, and record the agreed result or permitted aggregation method. Original assessments remain available for authorized oversight. A chair cannot silently replace committee opinions with a different result.

Commercial comparison must use the issued basis for taxes, currency, quantities, options, discounts, and whole-life costs. The app must distinguish submitted totals, authorized arithmetic corrections, evaluated costs, scores, and affordability findings. Section 9 specifies the calculation and ranking requirements.

### 7.12 Demonstrations, references, and shortlist

**FR-15 — Conduct consistent supplementary assessment and stage selection.**

Where included in the announced procedure, the buyer must schedule demonstrations, interviews, presentations, samples, site inspections, or reference checks. The process must specify purpose, attendees, agenda, assessment basis, evidence, and whether the outcome changes scores or only verifies claims.

Equivalent candidates must receive comparable instructions, preparation time, opportunity, and evaluation treatment. Supplier-specific follow-ups may investigate particular claims but must not introduce undisclosed award criteria. Reference contacts must be authorized and their feedback treated according to the stated confidentiality rules.

The shortlist must identify included and excluded suppliers, selection rules, ranking or threshold basis, reasons, approval, and any conditions. Suppliers must receive the appropriate outcome and next-stage instructions. A shortlist change after approval requires a recorded decision and review of affected invitations and deadlines.

### 7.13 Preferred bidder, due diligence, negotiation, and final offers

**FR-16 — Resolve material risks and complete the selection recommendation.**

Preferred-bidder status is a conditional selection outcome. It must identify the scope, proposed value, rationale, remaining checks, authorized negotiation topics, decision owner, and contingency if the preferred bidder cannot proceed.

Due diligence must verify the claims relevant to the proposed award: financial position, delivery capacity, references, current insurance, licenses, restrictions, ownership, key personnel, subcontractors, contract exceptions, and any required security. Previously qualified suppliers may require a proportionate refresh. Every finding needs a disposition, owner, and due date if unresolved.

Negotiation is available only when permitted by the selected procedure and issued conditions. The record must state who may negotiate, with whom, the allowed topics, commercial authority, rounds, meetings, proposals, concessions, unresolved issues, and approvals. Competitors' confidential prices or solutions must not be disclosed to improve another supplier's offer.

A best and final offer (BAFO) is a formally requested final response round. It must have an eligible audience, consistent instructions, permitted changes, submission deadline, receipt, opening rules, and declared evaluation treatment. Earlier offers remain visible to authorized reviewers for comparison; the final round does not rewrite them.

If negotiation changes material scope or undermines the basis of competition, the owner must seek a process decision, which may require a new competition. If the preferred supplier withdraws, fails diligence, or rejects terms, the buyer follows the declared contingency and approval path before approaching another supplier.

### 7.14 Award, notices, standstill, debriefing, and complaints

**FR-17 — Make and communicate an authorized award decision.**

The recommendation must bring together compliant offers, evaluation outcomes, commercial comparison, affordability, qualification, due diligence, proposed allocation, conflicts, exceptions, negotiation results, and unresolved conditions. Approvers may approve, reject, or return it; they must not replace the assessment with an unexplained choice.

The product must support a single award, separate lot awards, multiple winners, and no award. It must identify whether an award is full, partial, conditional, or limited to selected lots. Financial totals must reconcile with the selected offer and approved negotiation changes.

An intention-to-award notice must be distinct from a final award notice. Where applicable, the notice starts a standstill or challenge period governed by the chosen policy. The product must show its calendar, end date, extensions, unresolved complaints, and actions currently blocked. It must not assume one universal duration or one universal legal moment at which a contract is formed.

Unsuccessful suppliers must receive timely, consistent outcome communications and an appropriate route to debriefing. Debriefing content must explain the recipient's result at the permitted level while protecting other suppliers' confidential information. Requests, meetings, written responses, and any effect on deadlines must be recorded.

Complaints may relate to tender terms, eligibility, exclusion, evaluation, or award. The app must record standing to complain where required, grounds, relevant dates, acknowledgment, case owner, evidence, independence checks, process hold, response, appeal, and closure. A complaint must not be handled solely by the person whose conduct is challenged when policy requires independent review.

Final award requires all applicable approvals, satisfied award conditions, resolution of blocking complaints, and completion of any applicable waiting period. Public publication must use an approved redacted notice. Publication of an award does not by itself prove that the contract is signed, effective, or ready to start.

### 7.15 Contract finalization and handover

**FR-18 — Turn the approved award into an accountable contract.**

The contract workspace must identify legal parties, authorized signatories, awarded scope and lots, value and ceiling, currency, term, options, service locations, agreed documents and precedence, payment terms, securities, insurance, and key obligations. The signed version must be distinguishable from drafts and negotiation copies.

Changes between the approved award and proposed contract require an explanation and the relevant approval. Signature completion, effective date, notice to proceed, and delivery start are separate milestones. A contract cannot be marked active merely because a draft has been sent for signature.

The handover package must contain the final scope, winning commitments, negotiated exceptions, performance measures, deliverables, milestones, commercial terms, risks, outstanding conditions, renewal dates, security expiry, and key contacts. A named contract manager must accept the handover or return it with omissions. Procurement closure must not hide an incomplete handover.

Unsuccessful suppliers' proposals and internal score deliberations must not automatically be included in the supplier-shared contract workspace. Multiple contracts may result from a tender, and a contract may include several awarded lots, provided allocation and financial totals remain traceable.

### 7.16 Contract performance, changes, and closeout

**FR-19 — Manage obligations throughout the commercial relationship.**

- Maintain buyer and supplier obligations, owners, dates, dependencies, evidence, acceptance criteria, and escalation paths.
- Track kickoff readiness, deliverables, milestones, inspection or service acceptance, rejected work, corrective actions, and revised commitments.
- Record service measures, review meetings, supplier scorecards, complaints, incidents, breaches, and improvement plans. Suppliers may respond to disputed performance assessments before they are finalized where policy requires it.
- Track committed value, approved changes, consumption, invoice references, acceptance status, and payment status at the agreed level. Identify whether figures are entered locally or supplied by the designated financial record owner.
- Monitor insurance, licenses, bonds, guarantees, and qualification conditions throughout delivery.
- Manage change requests with reason, scope, cost, schedule impact, funding, cumulative value, approvals, supplier agreement, and impact on the original procurement basis.
- Track renewal and termination notice windows, available options, performance justification, funding, approvals, and decisions to renew, recompete, extend, or terminate.
- Record disputes, remedies, credits, penalties, and settlements only under the agreed terms and authorized decisions; a missed measure does not automatically authorize a deduction.
- Support closeout evidence, final acceptance, outstanding claims, final financial reconciliation, return or release of securities, warranty responsibilities, lessons learned, and retention start dates.

Renewal or extension must not be automatic because a date arrives. The business must explicitly authorize the option and confirm its contractual and policy basis. Contract expiry must not erase unresolved obligations, warranties, disputes, or record-retention duties.

### 7.17 Frameworks, panels, and other optional procurement methods

**FR-20 — Support extended procedures without weakening event controls.**

Frameworks must record participating buyers, suppliers, eligible categories, geographic scope, dates, ceiling, price arrangements, and call-off rules. Membership alone does not guarantee orders. A call-off must use the applicable direct-allocation or mini-competition rule and retain its own approval, award, and performance record. Orders outside the framework term, scope, or remaining ceiling require another authorized route.

Reverse auctions, if offered, require separate published rules for eligible participants, starting positions, bid increments, ranking visibility, tie treatment, ending conditions, extensions, and final award review. An auction result must not bypass qualification or award approval.

Specialized dialogue procedures must define participation, confidentiality of proposed solutions, equal access to common information, stage selection, and final-response conditions. Construction extensions may add bills of quantities, bidder bonds, performance bonds, progress certification, retention release, and defects periods without making them mandatory for service procurements.

### 7.18 Shared business services

**FR-21 — Support work across the lifecycle.**

Provide tasks, calendars, approvals, official communications, evidence management, reminders, search, reporting, and controlled exports. Every task must identify an owner, due date, status, source record, and escalation route. An internal discussion must be clearly distinguishable from a supplier-facing message or formal decision.

**FR-22 — Administer policy, records, and service operations.**

Provide the organization settings, supplier relationships, templates, policy versions, permissions, records controls, integration oversight, subscriptions, and support functions described in later sections. Changes to policy must not silently change the rules of an already issued tender.

## 8. Lifecycle states and transition gates

### 8.1 Procurement request

| State | Permitted next outcome | Gate or evidence |
| --- | --- | --- |
| Draft | Submitted or abandoned | Requester and minimum business information. |
| Submitted / under review | Information requested, approved, rejected, or deferred | Assigned procurement and budget reviewers. |
| Information requested | Resubmitted or withdrawn | Responses linked to the requested changes. |
| Approved | Converted to an event, routed to an existing arrangement, or rescinded | Strategy and funding approval appropriate to the chosen route. |
| Rejected / withdrawn / deferred | Closed or reconsidered | Reason retained; reconsideration requires review of the changed basis. |

### 8.2 Tender lifecycle

| State | Meaning | Transition requirements |
| --- | --- | --- |
| Draft | Preparation is in progress. | Required information, evaluation plan, and review assignments before approval request. |
| Awaiting release approval | Reviewers are considering a specific package. | All required approvals; material edits return affected approvals for reconsideration. |
| Ready / scheduled | Approved for release now or on an agreed date. | Approved audience, dates, notice, and release authority. |
| Open | The response window is active. | Published conditions govern access, questions, amendments, and submissions. |
| Closed / awaiting opening | Ordinary submissions have stopped. | Deadline passed or approved closure; sealed content remains protected. |
| Under assessment | Opening, compliance, evaluation, optional shortlist, and due diligence are in progress. | Each envelope and substage observes its own gates. |
| Award decision pending | Recommendation is being approved, notified, or held for challenges. | Evaluation complete, funding current, conditions and waiting periods resolved. |
| Awarded / partially awarded | At least one award has been formally approved and issued. | Each lot has an explicit outcome; remaining lots may continue or end without award. |
| Completed without award / information collected | The event ended with no award, or achieved its intended information-only purpose. | Approved outcome, market findings where relevant, and appropriate participant communication. |
| Cancelled | The competition has been formally stopped. | Authority, reason, treatment of bids, notices, and any refund or security actions. |
| Archived | Active work is complete and records are retained. | Applicable handover, outcome, outstanding-case, and retention conditions satisfied. |

Publication, evaluation, award, and contract stages must be visible per lot where lots follow different timelines. The overall tender status must not falsely imply that every lot has the same outcome.

A suspension or hold is a separate condition with an owner, reason, scope, start, review date, and released date. It must state which actions are blocked. It does not automatically stop clocks, extend deadlines, or cancel supplier obligations. Any date change requires its own decision and communication.

### 8.3 Related record lifecycles

| Record | Required business states and distinctions |
| --- | --- |
| Qualification application | Draft, submitted, under review, more information required, decision pending, decided, withdrawn. |
| Qualification status | Not assessed, qualified, qualified with conditions, not qualified, suspended, expired. The scope and effective dates are always included. |
| Supplier response | Draft, internal review, approved internally, submitted, superseded, withdrawn, late/rejected. Compliance and evaluation outcomes are separate attributes. |
| Evaluation assignment | Not started, in progress, submitted, returned for correction, finalized, recused/reassigned. |
| Approval request | Pending, approved, approved with permitted conditions, returned, rejected, withdrawn, invalidated by change, expired. |
| Complaint | Received, acknowledged, admissibility review, under investigation, response issued, appealed, resolved, withdrawn, closed. A procurement hold is separately visible. |
| Contract | Draft, under review, awaiting signature, signed but not effective, active, suspended, expired, terminated, closed. |
| Obligation or milestone | Planned, due, evidence submitted, under review, accepted, rejected, overdue, waived by authorized decision, cancelled. |
| Change request | Draft, submitted, impact assessment, approval pending, agreed, rejected, withdrawn, incorporated. |

State labels may be localized, but their business meaning and transition controls must remain consistent. Backward transitions must retain the original decision and reason; they must not erase history.

## 9. Evaluation and commercial comparison rules

### 9.1 Evaluation plan

The approved plan must define eligibility and mandatory gates separately from scored criteria. It must state the permitted scoring scales, weights, minimum scores, assessors, moderation method, price treatment, tie rules, and any lot-level or overall award constraints. Weights must total 100% for the applicable evaluation model, or an explicitly equivalent total of points.

The issued plan must specify whether a threshold applies to each criterion, a section total, the overall non-price score, or the combined score. A strong price score cannot compensate for a failed mandatory requirement unless the published requirement was expressly designed as rated rather than mandatory.

### 9.2 Illustrative weighted model

This is an example of a supported business method, not a required default for every customer.

| Criterion | Maximum points | Supplier A result | Supplier B result |
| --- | --- | --- | --- |
| Solution quality | 35 | 28.00 | 31.50 |
| Delivery approach | 20 | 16.00 | 18.00 |
| Relevant experience | 15 | 12.00 | 13.50 |
| Price | 30 | 30.00 | 25.00 |
| Total | 100 | 86.00 | 88.00 |

For a criterion rated from 0 to 5, weighted points equal the final rating divided by 5, multiplied by that criterion's maximum points. A quality rating of 4 out of 5 on a 35-point criterion produces 28 points.

In this example, Supplier A's evaluated cost is 100,000 and Supplier B's is 120,000 in the same comparison currency. If the published price rule is “lowest eligible evaluated cost divided by this offer's evaluated cost, multiplied by 30,” the price scores are 30 and 25. Supplier B wins on total points despite the higher evaluated cost, provided both meet all applicable gates and award constraints.

### 9.3 Required calculation and ranking behavior

- Use only eligible, comparable offers in a relative price formula. Record why any offer is excluded from the reference set.
- Declare the treatment of zero, negative, missing, or noncomparable prices before release. A ratio-based price rule is not applicable to every commercial model.
- Define scale anchors, such as what “meets requirements” means, and require justification proportionate to the decision.
- Do not treat missing evaluator work as zero, exclude an assessor silently, or change the denominator without the approved method.
- Specify whether the final result uses agreed consensus, an average, a permitted weighted assessor result, or another declared method. Preserve the underlying individual work.
- Establish the number of decimal places used for calculations, displayed values, and tie decisions. A display-rounded tie must not obscure different decision values.
- Determine permitted “not applicable” criteria before responses are assessed. Any normalization must be disclosed and applied consistently.
- Define whether demonstrations or references affect a scored criterion, validate a claim, or constitute an eligibility gate; avoid unannounced double counting.
- Record arithmetic corrections separately from submitted figures, including the correction rule, approval, supplier acknowledgment if required, and evaluation impact.
- Specify the exchange-rate source, date, comparison currency, and treatment of later movement. The supplier's original currency and amount remain visible.
- State which taxes, duties, recurring charges, options, quantities, discounts, and lifecycle costs enter comparison. Show excluded items and assumptions.
- Handle conditional discounts and packages according to the announced award combinations; do not apply a package discount to an award that does not meet its conditions.
- Flag abnormally low or unbalanced offers for documented review under the applicable policy; do not automatically reject them without the required process.
- Display affordability separately from ranking. The top-ranked offer may still require additional budget approval or a no-award decision.
- Apply the published tie sequence. Do not invent an extra criterion after scores are known.
- Explain multiple-lot allocations, limits on lots per supplier, capacity constraints, and any diversification rule established before release.
- Treat rank as decision support. Final selection requires the approved governance process; departures from the prescribed selection method require a valid policy basis and may require cancellation or a new competition.

## 10. Cross-cutting business rules

The following rules apply across screens and processes. Organization configuration can select legitimate policy options but cannot remove historical evidence or make an undisclosed rule change appear to have existed earlier.

| ID | Rule |
| --- | --- |
| BR-01 | Every procurement, lot, qualification review, complaint, and contract must have an accountable business owner. |
| BR-02 | Users act in an identified organization and capacity. Changing organizations does not transfer permissions or confidential information. |
| BR-03 | Supplier registration, identity verification, qualification, bid compliance, evaluation success, and award are distinct decisions. |
| BR-04 | The contracting legal entity and supplier legal party must be identified before a binding commitment is authorized. |
| BR-05 | Release, opening, evaluation, award, contract signature, and contract start are separate authorities. |
| BR-06 | An approver cannot exceed the value, scope, period, or entity covered by their delegation. |
| BR-07 | Self-approval and incompatible duties are blocked where the adopted policy requires independent review. Any permitted alternative oversight is documented. |
| BR-08 | Required conflict declarations and confidentiality undertakings must precede access to restricted assessment material. |
| BR-09 | The approved policy and document versions applicable to an event must remain identifiable throughout its life. |
| BR-10 | Material changes invalidate affected approvals; a prior approval cannot be reused for a different commercial decision. |
| BR-11 | The official deadline includes date, time, named time zone, and applicable offset. Displaying a local conversion must not obscure the official deadline. |
| BR-12 | Working-day calculations use the event's approved calendar. Changes to holidays or calendars require review of affected deadlines. |
| BR-13 | A hold does not change dates unless an authorized amendment explicitly changes them. |
| BR-14 | All eligible affected participants must have access to the same issued requirements and general clarifications. |
| BR-15 | Public notice, invitation, restricted-document access, and permission to submit may have different conditions and audiences. |
| BR-16 | Published requirements or evaluation rules cannot be silently edited. Material changes require an addendum and assessment of response time. |
| BR-17 | Buyer personnel cannot inspect supplier drafts. Submitted content remains sealed until the relevant opening gate. |
| BR-18 | A successful official receipt is required to establish submission. Draft saving, file transfer, and internal supplier approval do not establish it. |
| BR-19 | An incomplete or failed replacement does not supersede an earlier accepted submission. Explicit withdrawal does remove the effective submission. |
| BR-20 | Submission deadlines apply consistently to all affected suppliers. Late acceptance cannot be achieved by changing a recorded time. |
| BR-21 | A late or withdrawn response remains identifiable in the history but is excluded from ordinary evaluation unless an authorized policy route provides otherwise. |
| BR-22 | Post-closing clarifications cannot become unauthorized substantive improvements to an offer. |
| BR-23 | Mandatory failures and qualification restrictions are resolved before the affected evaluation or award gate. |
| BR-24 | A qualification decision is limited to its recorded scope and validity period; it is not a universal endorsement of the supplier. |
| BR-25 | Evidence expiry or an adverse event triggers the configured review; it does not erase earlier evidence or retroactively relabel the submission. |
| BR-26 | Evaluator assignments and stage restrictions determine access. Organization administration does not override them. |
| BR-27 | Individual assessments and subsequent moderation must both be preserved. |
| BR-28 | Evaluation uses the issued method and approved response version, with transparent calculations and assumptions. |
| BR-29 | Price corrections, exchange-rate conversions, discounts, and adjustments must be visible and distinguishable from the supplier's original offer. |
| BR-30 | Negotiation and final-offer rounds require explicit procedural authority and documented participant treatment. |
| BR-31 | Preferred-bidder status must not be communicated as an unconditional award. |
| BR-32 | A waiting period or unresolved blocking complaint prevents the award or contracting actions specified by the applicable policy. |
| BR-33 | Each lot must have an explicit outcome. Lot awards and contract allocations must reconcile to the approved award totals without double counting. |
| BR-34 | Public award disclosure requires review of confidentiality, personal information, and required publication content. |
| BR-35 | Signature, effective date, handover acceptance, and permission to begin work must each satisfy their own prerequisites. |
| BR-36 | Contract changes and renewals require authority, funding review where applicable, and preservation of original terms. |
| BR-37 | No renewal, qualification renewal, security release, or financial remedy occurs solely because a reminder date has arrived. |
| BR-38 | Deactivation of a user or account does not erase formal submissions, approvals, contracts, or audit records. |
| BR-39 | Personal account deletion and business-record retention are separate decisions. Retained records must have a defined purpose and access policy. |
| BR-40 | Legal or investigation holds prevent disposal of affected records, even after an ordinary retention period ends. |
| BR-41 | Email delivery, opening a notice, acknowledging a notice, and accepting its terms are distinct events. |
| BR-42 | A notification failure does not silently alter a deadline; it creates a delivery exception for review under the applicable notice policy. |
| BR-43 | Sensitive information must not become visible through search, totals, exports, activity summaries, or notifications to unauthorized users. |
| BR-44 | Duplicate supplier records may be merged only after review; historical bids and legal parties must remain traceable and properly segregated. |
| BR-45 | Buyer-specific supplier assessments are not shared with unrelated buyers without an explicit permitted basis. |
| BR-46 | Public eligibility and access conditions must not be changed by a supplier's subscription tier or willingness to buy optional services. |
| BR-47 | Service suspension, customer offboarding, or commercial disputes must follow a continuity plan for live procurements and retained records. |
| BR-48 | Suggestions, screening matches, or automated assistance do not independently approve qualification, exclude suppliers, finalize scores, or award contracts. |

## 11. Public and supplier screens

The screen catalog defines business destinations, not a prescribed visual layout. Related destinations may appear as tabs or workspaces provided their information, permissions, and actions remain clear. Every list must offer relevant search, filters, status, ownership, dates, and an appropriate empty or restricted-access explanation. Every consequential action must show its scope and result. Extension screens are explicitly identified.

### 11.1 Shared account and work screens

| ID and screen | Intended users | Required information and actions |
| --- | --- | --- |
| COM-01 — Sign-in, invitation acceptance, and account recovery | All account holders | Enter the relevant organization experience, accept invitations, verify contact details, recover access, and complete any required additional assurance. Explain pending membership or suspended access without exposing another organization. |
| COM-02 — Organization and capacity selection | Users with multiple memberships | List authorized organizations and capacities, pending memberships, and current context. Confirm the context before submission, approval, publication, or signature. |
| COM-03 — Personal profile and preferences | All account holders | Name, contacts, language, local time display, notification choices, memberships, and personal access settings. Essential process notices remain mandatory where policy requires them. |
| COM-04 — Task and approval inbox | Buyer and supplier users | Assigned tasks, source record, owner, due date, urgency, delegation, and overdue status. Open, complete, return, or reassign within authority; never expose unrelated task details. |
| COM-05 — Approval decision | Assigned approvers | Exact version, amount, scope, justification, evidence, previous decisions, conflicts, and authority. Approve, conditionally approve if permitted, reject, or return with reasons. |
| COM-06 — Notification center | All account holders | Official notices, reminders, delivery exceptions relevant to the user, unread state, and required acknowledgment. Reading is distinct from acknowledgment or agreement. |
| COM-07 — Document and evidence viewer | Authorized record users | Document title, owner, version, classification, validity, related record, and change history. View or download if permitted; released originals remain distinguishable from redacted copies. |
| COM-08 — Global search and saved views | Account holders | Search authorized tenders, suppliers, tasks, contracts, and documents; save relevant filters. Results and counts must not reveal restricted records. |
| COM-09 — Help, accessibility, and service cases | Public and signed-in users as applicable | Guidance, terminology, participation instructions, service notices, accessibility assistance, and support cases. Service support cannot become an informal bid-submission channel. |

### 11.2 Public-facing screens

| ID and screen | Purpose and information | Actions and business boundaries |
| --- | --- | --- |
| PUB-01 — Public procurement home | Buyer identity, active opportunities, future notices if enabled, recent awards, and participation guidance. | Browse without an account, choose language, and navigate to registration; confidential tenders remain absent. |
| PUB-02 — Opportunity search | Title, buyer, category, region, procedure, status, published date, and closing date. | Filter, sort, open notices, and subscribe through the appropriate route. Closed and cancelled notices must be clearly labeled. |
| PUB-03 — Tender notice and public documents | Scope, lots, eligibility, deadlines, official time zone, contact channel, documents, addenda, and current status. | Read public material, register interest, request restricted access, or start participation. Display the current amendment history prominently. |
| PUB-04 — Public clarifications and amendments | Released questions, answers, addenda, issue dates, and affected lots. | Read or download the public edition. Omit supplier identities or commercial details unless disclosure is explicitly authorized. |
| PUB-05 — Award search and award detail | Buyer, event, awarded lots, supplier names, disclosed values, dates, and approved outcome explanation. | Search and download the approved public notice. Protect unpublished contract schedules and losing bids. |
| PUB-06 — Procurement plans and advance notices | Planned categories, indicative timing, status, and expression-of-interest instructions. | Follow future opportunities; make clear that forecasts may change and are not invitations to submit a bid. |
| PUB-07 — Supplier participation guidance | Registration, qualification, submission, complaint, accessibility, and contact guidance. | Find rules and help. Distinguish general guidance from binding conditions in a particular tender. |

### 11.3 Supplier-facing screens

| ID and screen | Purpose and information | Actions and business boundaries |
| --- | --- | --- |
| SUP-01 — Supplier dashboard | Invitations, active pursuits, submission status, deadlines, qualifications, expiring evidence, awards, and contract tasks. | Open prioritized work; show only the current supplier's authorized records. |
| SUP-02 — Organization registration and membership | Business identity, contacts, candidate duplicate organizations, invitation details, and pending verification. | Register, request membership, claim an invited organization, or resolve missing evidence. Do not disclose confidential information from possible duplicates. |
| SUP-03 — Organization profile | Legal and trading names, registrations, locations, categories, capacity overview, ownership declarations, and buyer-sharing choices. | Maintain current information and request reviewed legal-identity changes. Historical submissions retain their original representations. |
| SUP-04 — Supplier users and authority | Members, groups, roles, tender assignments, signing limits, delegated authority, and invitation status. | Invite, approve membership, assign, suspend, or deactivate within supplier-administrator authority. Reassign open responsibilities. |
| SUP-05 — Evidence library | Certificates, statements, licenses, references, issuer, reporting period, expiry, and sharing audiences. | Add, replace prospectively, withdraw future sharing, and renew evidence. Show where an earlier edition was formally submitted. |
| SUP-06 — Opportunity discovery and watchlist | Matched opportunities, saved filters, watched tenders, deadlines, and buyer categories. | Save, subscribe, dismiss, and open an opportunity. A match does not guarantee eligibility. |
| SUP-07 — Invitations and access requests | Inviting buyer, event, intended legal supplier, confidentiality conditions, response status, and access decisions. | Accept or decline participation, request document access, and acknowledge conditions using an authorized representative. |
| SUP-08 — Opportunity workspace | Current tender package, lots, dates, eligibility, addenda, attendance, acknowledgments, and participation readiness. | Review, download, acknowledge, select eligible lots, and move to response preparation. Keep private preparation progress hidden from the buyer. |
| SUP-09 — Bid/no-bid and pursuit team | Pursuit rationale, internal risk, capacity, effort, owners, assignments, and internal dates. | Decide to bid or decline, allocate work, and record internal notes. Only an explicitly shared decline reason goes to the buyer. |
| SUP-10 — Tender questions and clarifications | Supplier's questions, buyer replies, published answers, question deadline, and affected requirements. | Ask, track, and read clarifications. Prevent access to other suppliers' private clarification cases. |
| SUP-11 — Briefings and site visits | Sessions, venue or attendance instructions, available places, mandatory status, accessibility needs, and attendance evidence. | Register, cancel a booking, request accommodation, and review official minutes. |
| SUP-12 — Response answers and attachments | Requirements by lot or section, answers, evidence references, progress, assigned contributors, and review comments. | Prepare and review responses, reuse approved content, identify deviations, and check completeness. |
| SUP-13 — Pricing and commercial offer | Quantities, rates, one-time and recurring charges, taxes, currencies, discounts, options, assumptions, and totals. | Enter and review offers under the tender's pricing rules. Restrict sensitive prices to authorized supplier users. |
| SUP-14 — Declarations, qualifications, and exceptions | Authority, eligibility declarations, subcontractors, conflicts, tender-specific evidence, contract exceptions, and current addenda. | Confirm or explain requirements and submit supporting evidence for the response. Clearly distinguish supplier statements from buyer verification. |
| SUP-15 — Internal bid review and approval | Proposed revision, unresolved issues, commercial exposure, required approvers, and approval history. | Approve, reject, return, or delegate within authority. Reopen affected reviews after material changes. |
| SUP-16 — Final review and submission | Exact revision, legal party, lots, final declaration, readiness checks, deadline, and consequences of submission. | Submit with authority and obtain the receipt. Show failures clearly; never display draft readiness as successful submission. |
| SUP-17 — Receipts, revision history, and withdrawal | Official receipts, submission times, inventories, effective revision, superseded editions, and withdrawal status. | Download receipts, prepare a replacement while permitted, or explicitly withdraw. Explain the current effective offer. |
| SUP-18 — Assessment requests and appointments | Compliance questions, presentations, demonstrations, reference requests, deadlines, and response history. | Respond or confirm participation within the allowed scope. Do not allow an ordinary clarification to replace the original bid. |
| SUP-19 — Negotiation and final-offer rounds | Authorized topics, meeting records, proposed terms, concessions, round instructions, deadlines, and final offers. | Respond, review terms, approve internally, and submit the required round. Other suppliers' negotiation records remain hidden. |
| SUP-20 — Qualification applications | Programs, categories, thresholds, questions, evidence, review status, and requests for information. | Apply, respond, withdraw, renew, or request review of a decision. |
| SUP-21 — Outcomes and debriefings | Preferred or final award status, unsuccessful notices, permitted reasons, waiting periods, and debriefing instructions. | Acknowledge, accept permitted next steps, request debriefing, and access approved feedback. |
| SUP-22 — Complaints and appeals | Own cases, grounds, deadlines, evidence, case status, responses, and any appeal route. | Submit and track a complaint without viewing other suppliers' cases or private buyer deliberations. |
| SUP-23 — Supplier contracts and performance | Own contracts, signatures, obligations, milestones, change requests, reviews, and shared financial status. | Participate in permitted contract screens, submit evidence, dispute findings, and request changes. |
| SUP-24 — Qualification decisions and renewals | Decision scope, effective dates, conditions, evidence expiry, review reasons, and renewal deadlines. | Track actions, supply updated evidence, and request reconsideration. Distinguish buyer-specific decisions. |

## 12. Buyer and evaluator screens

### 12.1 Buyer procurement screens

| ID and screen | Required information | Principal actions and controls |
| --- | --- | --- |
| BUY-01 — Procurement dashboard | Pipeline, active events, deadlines, workload, approvals, exceptions, and upcoming renewals. | Filter by authorized entity, department, owner, category, value, and stage; open underlying records. |
| BUY-02 — Request register | Requests, requester, purpose, estimate, funding, priority, status, and age. | Create, assign, group, filter, defer, or route a request; preserve ownership and history. |
| BUY-03 — Request and business case | Need, outcomes, scope, quantities, dates, locations, budget, risk, stakeholders, and supporting evidence. | Draft, submit, clarify, revise, withdraw, and review. |
| BUY-04 — Request and funding decision | Requested authority, funding confirmation, review comments, conditions, and approved version. | Approve, reject, return, or route to an existing contract within delegation limits. |
| BUY-05 — Procurement plan and calendar | Planned events, dependencies, budget periods, expiries, expected release, and resource demand. | Schedule, prioritize, allocate owners, and publish approved advance notices. |
| BUY-06 — Market research and strategy | Research, procedure rationale, competition approach, lot strategy, risks, evaluation approach, and timetable. | Compare approaches, record consultations, propose exceptions, and obtain strategy approval. |
| BUY-07 — Tender register and creation | Events, methods, status, owner, category, value, dates, and source request. | Create from approved template or prior content, link stages, and establish the event. |
| BUY-08 — Tender overview and team | Summary, current version, stage, lots, dates, approval status, owners, evaluators, and outstanding decisions. | Assign responsibilities, inspect readiness, and navigate the event with appropriate permissions. |
| BUY-09 — Scope, lots, and requirements | Requirements, quantities, locations, lots, applicability, response instructions, mandatory status, and evidence. | Author and review; identify contradictions and missing ownership. |
| BUY-10 — Pricing and commercial terms | Pricing schedules, units, currencies, taxes, options, discounts, validity, and draft contract terms. | Define the requested offer and evaluation basis; review affordability assumptions. |
| BUY-11 — Evaluation plan | Criteria, weights, scales, thresholds, assignments, moderation, price method, and tie rules. | Establish and approve the plan before release; show any later amendment explicitly. |
| BUY-12 — Timetable and participation rules | Official time zone, calendar, opening plan, question dates, visits, deadlines, qualification, and submission rules. | Set a coherent schedule, define envelope stages, and specify participation conditions. |
| BUY-13 — Document package and release review | Issued documents, classifications, language editions, precedence, completeness, and release approvals. | Review the supplier/public view, request corrections, and approve the exact release package. |
| BUY-14 — Publication and distribution | Notice, audience, approved date, channels, publication confirmations, and failures. | Publish or schedule, distribute invitations, verify external advertising, and correct publication exceptions. |
| BUY-15 — Participants and document access | Invited and interested suppliers, access requests, confidentiality acceptance, qualification, acknowledgments, and delivery status. | Invite approved suppliers, decide access, correct contacts, and manage participation conditions without viewing drafts. |
| BUY-16 — Tender Q&A | Questions, category, supplier confidentiality, owner, response deadline, draft reply, and publication status. | Assign, answer, review, publish to the correct audience, or escalate to an addendum. |
| BUY-17 — Addenda and date changes | Proposed change, affected requirements and lots, materiality, approval, revised dates, recipients, and acknowledgment status. | Approve and issue; explain consequences for existing submissions and participant response time. |
| BUY-18 — Briefings and visits | Sessions, logistics, registered suppliers, attendance, mandatory status, accommodations, and minutes. | Schedule, record attendance, issue shared answers, and resolve attendance exceptions consistently. |
| BUY-19 — Submission monitoring and closing | Permitted receipt metadata, effective submission count, deadlines, closing status, and service incidents. | Monitor and close under approved rules; no access to sealed content or supplier drafts. |
| BUY-20 — Opening session | Opening authority, required participants, eligible envelopes, recorded time, exceptions, and minutes. | Authorize the appropriate stage, record witnesses, and issue permitted opening information. |
| BUY-21 — Compliance and exclusions | Bid checklist, requirement evidence, findings, clarification requests, exclusion rationale, and approval. | Pass, seek permissible clarification, or reject with documented reasons and notification. |
| BUY-22 — Demonstrations and references | Session purpose, agenda, participants, equal-treatment checks, reference consent, evidence, and assessment. | Schedule, record findings, and apply the announced evaluation treatment. |
| BUY-23 — Shortlist and stage progression | Eligible candidates, scores or thresholds, conditions, stage rules, selection rationale, and approvals. | Approve a shortlist, issue next-stage invitations, and notify eliminated suppliers. |
| BUY-24 — Preferred-bidder recommendation | Comparison, proposed supplier and lots, value, rationale, risks, diligence plan, and contingencies. | Recommend, approve conditional preferred status, or return for further work. |
| BUY-25 — Due-diligence case | Financial, capacity, ownership, insurance, restrictions, references, and contract exceptions; findings and owners. | Request evidence, record verification, resolve concerns, and approve or reject readiness. |
| BUY-26 — Award recommendation and approval | Final evaluation, diligence, funding, exceptions, allocations, proposed contracts, and approvals. | Approve, reject, return, or choose no award with an authorized rationale. |
| BUY-27 — Negotiation and final offers | Authorized scope, participants, round history, concessions, minutes, unresolved terms, deadlines, and revised offers. | Conduct permitted negotiations, request final offers, compare results, and seek new approval where needed. |
| BUY-28 — Outcome notices and waiting period | Draft notices, disclosure review, recipients, delivery, acknowledgments, waiting-period dates, holds, and readiness. | Issue the appropriate intent or final notice, manage extensions, and publish approved outcomes. |
| BUY-29 — Debriefings and complaints | Requests, cases, deadlines, independent owners, evidence, decisions, appeals, and procurement effect. | Schedule debriefs, investigate, issue responses, record remedies, and release holds with authority. |
| BUY-30 — Event closeout and archive | Lot outcomes, signed-contract links, accepted handovers, outstanding cases, securities, lessons, and retention classification. | Confirm closure, link re-tenders, create controlled evidence packs, and archive when permitted. |
| BUY-31 — Supplier directory | Supplier identities, categories, relationship contacts, qualification scope, restrictions, contracts, and evidence freshness. | Search, invite, request qualification, flag duplicates, and open authorized supplier records. |
| BUY-32 — Supplier relationship record | Buyer-specific profile, assessments, history, risks, contacts, restrictions, and performance. | Maintain the relationship and review identity changes without revealing other buyers' private assessments. |
| BUY-33 — Qualification review queue | Applications, category, risk, completeness, assessors, deadlines, and renewal status. | Assign and prioritize reviews; request missing material and specialist assessment. |
| BUY-34 — Qualification assessment | Criteria, evidence, reporting periods, findings, financial review, capacity, conditions, and proposed outcome. | Assess, clarify, verify, and recommend within the reviewer's authority. |
| BUY-35 — Qualification decision and monitoring | Approved scope, dates, limits, conditions, reasons, expiry, triggers, and active-event impacts. | Approve, suspend, renew, reject, notify, or initiate reassessment with an explicit decision. |

### 12.2 Evaluation workspaces

| ID and screen | Intended users and information | Actions and controls |
| --- | --- | --- |
| EVA-01 — Evaluator assignments | Evaluators and chair: assigned events, bids, criteria, due dates, declarations, and completion. | Accept assignment, disclose a conflict, request reassignment, and begin permitted work. |
| EVA-02 — Individual assessment | Assigned evaluator: requirement, response, relevant evidence, scoring guide, and own notes. | Score, explain, request clarification, save work, and submit. Enforce staged price access and independent assessment. |
| EVA-03 — Clarification coordination | Chair and authorized reviewers: questions from assessors, duplication, permitted scope, supplier response, and effect. | Consolidate and issue approved questions; distribute answers to affected assessors consistently. |
| EVA-04 — Commercial comparison | Authorized commercial reviewers: original prices, adjustments, exchange basis, total cost, scenarios, and affordability. | Compare on the issued basis, approve corrections, and explain assumptions. Private sensitivity scenarios do not alter official scores. |
| EVA-05 — Moderation | Chair and permitted committee: submitted assessments, divergences, reasons, evidence, and proposed final results. | Discuss, record consensus or declared aggregation, return assessments, and finalize with preserved history. |
| EVA-06 — Ranking and evaluation report | Authorized selection team: eligibility, scores, gates, ties, lot constraints, explanations, and committee sign-off. | Validate outcomes, produce the evaluation record, and pass a supported recommendation to approvers. |

## 13. Contract, administration, and operator screens

### 13.1 Contract workspaces

Supplier access to these destinations is limited to its own contracts and explicitly shared information.

| ID and screen | Required information | Actions and controls |
| --- | --- | --- |
| CON-01 — Contract register | Parties, owner, scope, value, remaining ceiling, term, status, and renewal dates. | Filter, open, assign owners, and identify upcoming decisions. |
| CON-02 — Contract preparation and review | Awarded scope, final terms, parties, schedules, exceptions, approval history, and differences from the award. | Prepare, review, negotiate authorized changes, and approve the final agreement. |
| CON-03 — Signature and commencement | Signatories, authority, issued version, signature status, effective date, preconditions, and start authorization. | Request or record signatures, resolve rejection, and authorize commencement when ready. |
| CON-04 — Procurement handover | Winning commitments, risks, obligations, pricing, milestones, conditions, contacts, and supporting award evidence. | Accept or return handover; do not share losing bids with the successful supplier. |
| CON-05 — Contract overview and obligations | Agreed scope, contacts, commitments, insurance, licenses, securities, dates, owners, and status. | Assign and track obligations; submit and review evidence; escalate overdue commitments. |
| CON-06 — Milestones and acceptance | Deliverables, criteria, due dates, inspection evidence, acceptance decisions, and rejected work. | Submit completion, inspect, accept, reject, and track remediation with authority. |
| CON-07 — Performance and improvement | Measures, service reviews, incidents, complaints, supplier response, scorecards, and corrective actions. | Assess, discuss, finalize ratings, and manage improvement plans with supporting evidence. |
| CON-08 — Contract financial view | Award, original value, approved changes, ceiling, commitments, accepted milestones, invoices, payments, and sources. | Reconcile and investigate; avoid presenting estimated or disputed figures as paid spend. |
| CON-09 — Changes, disputes, and remedies | Change requests, cumulative impact, authority, supplier agreement, claims, disputes, and permitted remedies. | Assess, approve, reject, negotiate, and track the agreed change or resolution. |
| CON-10 — Renewal, extension, and termination | Options, notice windows, performance, budget, business justification, approvals, and transition needs. | Decide and notify; an elapsed date alone cannot authorize renewal. |
| CON-11 — Closeout and continuing obligations | Final acceptance, reconciliation, claims, security release, warranties, lessons, and retention. | Close the contract while separately tracking surviving obligations. |
| CON-12 — Framework and call-off management — extension | Members, scope, term, ceiling, pricing, allocation rules, and drawdown. | Create eligible call-offs or mini-competitions; check authority and remaining scope/value. |

### 13.2 Buyer organization administration

| ID and screen | Required information | Actions and controls |
| --- | --- | --- |
| ADM-01 — Organization and legal entities | Identity, entities, branding, working languages, time zone, contacts, and policy ownership. | Maintain settings and review effects on public notices and active work. |
| ADM-02 — Departments, locations, and business classifications | Departments, projects, cost centers, categories, funding, locations, and reporting relationships. | Add, revise, deactivate, and control scope; preserve historic descriptions. |
| ADM-03 — User directory and user detail | Memberships, roles, scope, invitations, status, delegations, and outstanding work. | Invite, activate, suspend, deactivate, recover membership, and reassign responsibilities. |
| ADM-04 — Roles, groups, and access review | Roles, permissions, groups, scope, direct grants, restrictions, and effective access. | Create approved role combinations, manage membership, review expiry, and identify excessive or conflicting authority. |
| ADM-05 — Authority, committees, and delegations | Approval limits, entities, categories, quorum, substitutes, incompatibilities, and effective dates. | Maintain approved authority; prevent delegation beyond the grantor's permitted scope. |
| ADM-06 — Procurement policy profiles | Procedures, thresholds, gates, exceptions, publication, opening, waiting periods, and complaint rules. | Review, approve, version, and retire profiles; identify which events use each version. |
| ADM-07 — Forms and business fields | Field labels, purpose, applicability, required status, allowed values, audience, and reporting needs. | Configure request, tender, qualification, and contract information without changing issued forms silently. |
| ADM-08 — Template and content library | Tender packages, questionnaires, criteria, scales, clauses, letters, checklists, and contract templates. | Author, review, approve, publish for reuse, and retire obsolete material. |
| ADM-09 — Qualification programs | Scope, evidence, criteria, thresholds, assessors, decision authority, validity, and monitoring triggers. | Establish and revise programs; manage category-specific or risk-specific requirements. |
| ADM-10 — Calendars and deadline policies | Working days, holidays, official zones, reminder periods, and notice rules. | Maintain approved calendars and review the impact of changes on active events. |
| ADM-11 — Public portal and publication policy | Released branding, notice fields, document access, public awards, languages, guidance, and channels. | Review public-facing content and approve disclosure settings. |
| ADM-12 — Notification rules and messages | Event types, recipients, mandatory notices, templates, reminders, and escalations. | Maintain audience-specific messages without embedding confidential bid content in general alerts. |
| ADM-13 — Reports and controlled exports | Report definitions, authorized audiences, filters, scheduled delivery, export contents, and history. | Create and share business views; apply underlying access and confidentiality restrictions. |
| ADM-14 — Audit, retention, and legal holds | Business actions, access events, classifications, retention schedules, holds, and disposal eligibility. | Inspect records, authorize evidence packs, impose holds, and approve permitted disposal. |
| ADM-15 — Integration register and reconciliation | Business connections, record owners, exchanged information, outstanding exceptions, last confirmation, and responsible contacts. | Enable approved business exchanges, reconcile disagreements, and document manual fallback. |
| ADM-16 — Imports, duplicate review, and historical onboarding | Proposed records, origin, quality issues, duplicate candidates, missing evidence, and approval. | Review and accept valid business records, reject errors, and preserve original dates and provenance. |
| ADM-17 — Subscription and organization offboarding | Entitlements, contacts, renewal, usage, active-event obligations, export requests, and closure plan. | Review service arrangements and coordinate closure without abandoning live procurements. |

### 13.3 Platform operator screens

| ID and screen | Required information | Actions and controls |
| --- | --- | --- |
| OPS-01 — Customer organization register | Customer identity, service owner, onboarding stage, plan, account status, and designated administrators. | Establish and manage customer relationships; no automatic visibility of customer tender content. |
| OPS-02 — Customer onboarding and offboarding | Agreed setup, ownership checks, adoption tasks, unresolved issues, active events, and export/retention obligations. | Coordinate authorized account changes and continuity arrangements. |
| OPS-03 — Plans, entitlements, and commercial accounts | Buyer plans, optional services, subscription dates, agreed limits, invoices, and disputes. | Manage service entitlements without changing competition results or supplier eligibility. |
| OPS-04 — Support cases and temporary access | Case purpose, customer authorization, permitted records, access duration, actions, and resolution. | Assist within the grant, end access, and preserve support activity history; no business impersonation. |
| OPS-05 — Service incidents and continuity | Incident scope, affected customers/events, times, notices, recovery status, and customer decisions. | Communicate, coordinate evidence, and support fair deadline decisions by the responsible buyer. |
| OPS-06 — Platform oversight | Account administration, privileged-access reviews, service complaints, misuse cases, and aggregate usage. | Review service conduct without exposing confidential procurement information or enabling sealed-bid access. |
| OPS-07 — Product announcements and help content | Release notices, guidance, training, service messages, audience, and languages. | Publish reviewed information; distinguish product announcements from formal tender notices. |

### 13.4 Business reporting and optional workspaces

| ID and screen | Purpose and controls |
| --- | --- |
| REP-01 — Management reports | Authorized pipeline, workload, cycle time, supplier participation, qualification, awards, and contract performance; drill through to supporting records. |
| REP-02 — Report definition and export review | Select business fields, filters, reporting period, currency basis, audience, redactions, and scheduled delivery; preview scope before sharing. |
| EXT-01 — Joint procurement workspace | Contributing buyers, lead authority, funding shares, common requirements, participant approvals, and visibility agreements. |
| EXT-02 — Reverse-auction event | Published auction rules, eligible offers, permitted ranking view, remaining time, offers, and result review. |
| EXT-03 — Assisted content review | Draft suggestions, summaries, source evidence, reviewer decisions, and corrections. Assistance remains clearly distinguishable from an official business decision. |

## 14. Documents, communication, and notifications

### 14.1 Document control

Every formal document must have an understandable name, business owner, purpose, version, date, classification, language, status, and related procurement or contract. Evidence additionally needs its issuer, coverage or reporting period, expiry if applicable, and verification status.

Draft, approved, published, submitted, superseded, signed, and redacted documents must be clearly distinguishable. A correction creates a new recorded edition; it does not replace history without explanation. The applicable tender or contract must state document precedence where conflicting content is possible.

The supplier's submitted document set must remain available as submitted, including the evidence versions used at that time. A later profile update must not change the content of a historical bid. Redaction produces an audience-specific disclosure copy while retaining the controlled original.

Tender packages, submission receipts, evaluation reports, award reports, and contract handovers must be downloadable in business-readable forms. Evidence exports must identify their contents, versions, omissions, redactions, creator, and creation date. An export must not expose material unavailable to the requesting user.

### 14.2 Communication categories

| Category | Audience and business effect |
| --- | --- |
| Internal collaboration | Authorized buyer or supplier colleagues; does not change issued conditions or constitute a formal supplier notice. |
| General tender clarification | All eligible affected participants, or the public if the event's disclosure policy permits it. |
| Supplier-specific process correspondence | One supplier and assigned buyer reviewers; may clarify a specific response within permitted limits. |
| Formal addendum or decision notice | An approved, versioned communication with a defined audience, issue time, and required acknowledgment where applicable. |
| Contract correspondence | Authorized parties to the relevant agreement; distinguish routine discussion from a formal contractual notice. |
| Service support | Assistance with using the product; does not amend deadlines, accept bids, or decide complaints about procurement merits. |

Offline meetings, telephone decisions, and external correspondence that affect the competition must be recorded with source, participants, date, relevant content, and formal confirmation where necessary. The app must make the official event communication channel clear.

### 14.3 Notification events

| Trigger | Recipients | Required content or action |
| --- | --- | --- |
| User invitation or authority change | Affected user and responsible administrator | Organization, role or action, acceptance requirements, and expiry. |
| Request submitted or returned | Requester, owner, and assigned reviewers | Required decision or missing information and due date. |
| Tender issued or invitation received | Approved supplier audience and relevant buyer owners | Event, current deadline, official zone, and participation instructions. |
| Addendum or deadline change | All affected eligible participants and buyer stakeholders | What changed, applicable version, new dates, and required response action. |
| Question answered or clarification requested | Appropriate participant or assigned reviewer | Response deadline and authorized location of the content. |
| Qualification evidence expiring | Supplier evidence owner and buyer reviewer as configured | Evidence, scope, expiry, renewal action, and potential business consequence. |
| Submission succeeded, failed, replaced, or withdrawn | Supplier bid manager and submitter | Official outcome and reference to the receipt or corrective action. |
| Closing approaching | Interested supplier users according to settings | Official deadline and readiness reminder; no implied guarantee of receipt. |
| Evaluation assigned or overdue | Assessor, chair, and escalation owner | Assignment, due date, required declarations, and outstanding work. |
| Approval needed, returned, or expired | Assigned approver and record owner | Decision scope, value, due date, and version under review. |
| Preferred selection, intent, exclusion, or award | Approved bidder audience | Exact decision status, permitted explanation, relevant deadlines, and next steps. |
| Complaint or waiting-period change | Case parties and responsible buyer roles | Case action, revised date, and any blocked procurement action. |
| Contract milestone, expiry, or renewal window | Contract owners and assigned supplier contacts | Commitment, date, evidence, decision, and escalation. |
| Service incident affecting participation | Affected users and buyer decision owners | Known impact, service status, support route, and separately issued deadline decisions. |

Mandatory formal notices cannot be disabled by an ordinary preference. Promotional messages and optional digests must be separately controllable. Repeated reminders should be consolidated where doing so does not obscure distinct obligations.

The app must track notice issue, attempted delivery, failure, and acknowledgment where required. A failed delivery creates an action for the responsible owner. The adopted policy must define whether publication, transmission, receipt, or acknowledgment starts a notice period.

## 15. Reporting and business measures

### 15.1 Required reporting families

| Report | Questions answered | Main dimensions |
| --- | --- | --- |
| Procurement pipeline | What is planned, approved, active, delayed, or awaiting a decision? | Entity, department, category, owner, stage, dates, and estimated value. |
| Cycle time and workload | Where does work wait and who needs support? | Request-to-release, release-to-close, evaluation, approval, award, and handover durations. |
| Competition and participation | How many relevant suppliers were invited, participated, declined, or submitted compliant offers? | Procedure, category, region, tender, lot, and no-bid reason. |
| Qualification and risk | Which suppliers, documents, or conditions need review? | Program, scope, risk, validity, assessor, condition, and active-contract exposure. |
| Evaluation integrity | Are assessments complete and do differences have explanations? | Assignment, missing evidence, score variance, moderation, conflicts, and overrides. |
| Awards and commitments | What was awarded, to whom, and against which approved budget? | Supplier, legal entity, category, lot, funding, value, currency, and date. |
| Commercial outcomes | What changed from estimate to offer, award, and actual delivery? | Approved comparison basis, quantities, scope, price effects, and realized results. |
| Contract performance | Are obligations, service measures, changes, and renewals under control? | Supplier, contract owner, milestone, period, risk, and corrective action. |
| Complaints and exceptions | What is challenged or proceeding through an exception? | Grounds, owner, stage, age, resolution, hold, and authorized departure. |
| Audit and records | Can decisions be reconstructed and are retention duties being met? | Event, actor, decision, version, disclosure, retention classification, and legal hold. |

### 15.2 Metric definitions and safeguards

- Distinguish invited organizations, registered interest, unique bidding organizations, submitted revisions, and compliant bids. Multiple revisions do not count as additional competing suppliers.
- For multi-lot tenders, identify whether counts and durations are event-level or lot-level. Do not add whole-event values to their included lot values.
- Show calendar elapsed time and, where useful, approved hold-adjusted time separately. Delays must not disappear because a clock was administratively paused.
- Define savings against an approved, dated baseline with equivalent quantities and scope. Separate price reduction, avoided future cost, budget variance, and realized savings.
- Separate contract ceiling, committed spend, accepted work, invoiced amounts, and paid amounts. State the source and freshness of financial information.
- State the currency basis and conversion date for consolidated totals. Avoid adding unlike currencies as if they were directly comparable.
- Display completeness and missing information, especially for imported historical records. Missing records do not imply zero activity or zero risk.
- Allow authorized drill-through to evidence, saved filters, date comparisons, exports, and scheduled reports. Scheduled recipients must still be authorized when the report is issued.
- Public transparency reports must be reviewed and redacted separately from internal management reports. Cross-customer benchmarking requires an explicitly permitted, non-identifying basis.

## 16. Potential business integrations

Integrations are described by business purpose, information exchanged, and ownership. Availability of a specific provider is not assumed. Each customer selects the integrations it needs; a reviewed manual handoff must remain possible where an external service is unavailable.

| Business system or service | Purpose and information exchanged | Ownership and exception requirements |
| --- | --- | --- |
| Corporate employee directory and sign-in service | Confirm employee identity, organization membership, contact information, and employment status. | Employment status comes from the designated employer record; procurement authority still requires approved role and delegation assignment. |
| Finance and budget management | Obtain cost centers, funding, budgets, approvals, commitments, and available amounts; send approved commitments. | Finance owns official balances. A stale or unavailable balance requires an explicit funding disposition, not assumed approval. |
| Purchasing and accounts payable | Hand off suppliers, contract references, awarded items, purchase requests, and commitments; receive order, invoice, and payment status. | Identify the official supplier and financial records. Repeated handoffs must not create duplicate orders or commitments. |
| Supplier master or vendor management | Reconcile legal supplier identity, status, business identifiers, and contacts. | Confirm ownership of each field and review duplicates; a financial-system vendor status does not automatically equal tender qualification. |
| Public notice and e-tender portals | Publish opportunities, amendments, cancellations, and award notices; receive publication references and confirmations. | The procurement owner resolves mismatched editions or failed publication and decides any timetable impact. |
| Business and professional registries | Verify business standing, registration, ownership information where available, and professional licenses. | Retain source, date, scope, and reviewer conclusion; stale or ambiguous results require review. |
| Credit and financial assessment providers | Obtain authorized credit reports, indicators, monitoring notices, and financial-risk evidence. | Apply access and permitted-use conditions; findings support a documented human assessment rather than an unexplained automatic exclusion. |
| Sanctions, debarment, and integrity screening | Obtain potential matches or restriction information for relevant parties. | Distinguish a possible name match from a confirmed restriction; document review, scope, and applicable effect. |
| Insurance, certification, and bond verification | Verify issuer, coverage, validity, authenticity, and required guarantees. | Track source availability and verification limits. Supplier-provided evidence remains distinguishable from independent confirmation. |
| Electronic signature services | Issue approved agreements and obtain signature progress, completed agreements, and signing evidence. | Reconcile signatories, authority, and document version; a failed or refused signature leaves the contract unexecuted. |
| Document and records management | Exchange approved packages, evidence, signed agreements, and retention classifications. | Identify the authoritative edition, permitted audience, and legal-hold obligations; uncontrolled copies do not amend official documents. |
| Email and organizational messaging | Deliver notices and reminders, with delivery status and a reference to the authoritative business record. | Essential content must remain available in the product; external messages do not bypass access or formal notice rules. |
| Calendars and meeting services | Coordinate evaluation meetings, briefings, site visits, negotiations, and contract reviews. | Record the official event time zone and formal minutes; a calendar change alone does not amend the tender deadline. |
| Contract management and project delivery | Transfer awarded obligations, milestones, owners, risks, changes, and performance results. | Agree which product owns each lifecycle step. Do not let competing records silently diverge. |
| Currency and reference information services | Supply dated exchange rates and approved business classifications. | Preserve the selected comparison basis for the event even if later reference values change. |
| Business intelligence and management reporting | Share approved business measures and supporting classifications. | Respect confidentiality and record scope; report definitions and financial measures must remain consistent. |
| Customer support and service management | Track service cases, incidents, users affected, and resolution status. | Share only necessary context; supplier bids and confidential evidence are excluded unless specifically authorized for the case. |

Every integration agreement must identify the business owner, purpose, information scope, permitted recipients, record of authority, expected timeliness, consent or other sharing basis, exception owner, reconciliation process, and cessation obligations. Failed transfers must remain visible until resolved. A failure must not silently mark an external approval, publication, signature, or payment as completed.

## 17. Business configuration and templates

### 17.1 Configurable areas

| Area | Configurable business choices | Guardrails |
| --- | --- | --- |
| Organization | Legal entities, departments, categories, locations, currencies, languages, and reporting groups. | Historical references remain understandable after changes. |
| Procedure profiles | Permitted methods, thresholds, required reviews, negotiation, opening, qualification, and exception paths. | Each issued event retains its approved profile version. |
| Approvals | Value bands, risk triggers, entity scope, stages, committees, quorum, alternates, and delegation. | Authority cannot be self-expanded or exceeded. |
| Supplier qualification | Programs, categories, evidence, financial/capacity requirements, limits, validity, and monitoring. | Criteria must be documented, relevant, and applied consistently. |
| Forms and questionnaires | Questions, field labels, guidance, required status, choices, applicability, and evidence needs. | Published or submitted forms cannot be silently rewritten. |
| Evaluation | Scales, criteria, weights, gates, moderation, prices, ties, and lot constraints. | The announced assessment method governs the competition. |
| Documents and messages | Tender packages, contract clauses, notices, debriefs, declarations, and language editions. | Approved content has owners, review dates, and versions. |
| Dates and notices | Time zones, calendars, notice periods, reminders, acknowledgments, and escalation. | Active deadlines change only through an authorized decision. |
| Records and disclosure | Confidentiality classes, export rights, public fields, retention, holds, and disposal approval. | Sealed content and protected records retain their restrictions. |
| Contract management | Obligation types, service measures, change authority, review frequency, and renewal reminders. | Configuration cannot create remedies or renewal rights absent an agreement. |

### 17.2 Proposed starting defaults

These defaults make the initial product coherent and remain subject to buyer policy approval:

- Public notices can be browsed without signing in; submission requires verified individual access and authority to represent the supplier.
- Suppliers may participate without paying a participation fee to the platform.
- Each event has one clearly stated official time zone, with optional local-time assistance.
- The last successfully submitted, non-withdrawn revision before closing is effective, subject to declared alternative-bid and addendum rules.
- Ordinary late submission is disallowed; substantive amendments and deadline changes require formal notice.
- Individual evaluation is private until submission and the permitted moderation stage.
- Buyer-specific qualification decisions and supplier financial evidence are restricted by assignment.
- Ranking does not trigger an automatic award, and expiry does not trigger automatic renewal.
- Customer administrators receive administrative authority without automatic access to restricted bid content.
- Procurement rules, record-retention durations, approval limits, and challenge periods require explicit customer setup rather than an assumed jurisdictional default.

### 17.3 Template governance

Every reusable template must have an owner, intended procedure and category, applicable audience, approval status, effective date, review date, and revision history. Retired templates cannot be selected for new work without authorized review. Existing events retain their adopted version.

Additional business fields must be labeled, explained, assigned an audience, and included in relevant review and reporting views. A field's required status can depend on a declared business condition, such as the selected procurement category or proposed contract value. Customization must not hide a mandatory control or introduce undisclosed scoring.

## 18. Privacy, fairness, records, and oversight

### 18.1 Information governance

Information must be classified by business audience, including public, participating suppliers, supplier-private, buyer-internal, restricted assessment, commercially confidential, and sealed. Certain records may require an additional restricted legal or investigation audience. The same document may have a protected original and a separately approved disclosure edition.

Collect personal, financial, ownership, and banking information only for a stated business purpose. Inform suppliers and users of its intended audience, retention, and applicable rights. Record necessary permissions for references, third-party verification, sharing, or optional services. Buying organizations must approve the policies that apply to their jurisdiction and procurement circumstances.

Suppliers may identify commercially sensitive material, but the buyer must review disclosure requests under the applicable obligations. A supplier's confidentiality label is neither ignored nor treated as an unconditional promise that disclosure can never be required.

### 18.2 Decision evidence and oversight

The business record must show who acted, on behalf of whom, under which authority, when, against which version, and with what reason. Important events include access grants, opening, submissions, withdrawals, amendments, approvals, score changes, exclusions, award decisions, contract changes, exports, public disclosures, and records disposal.

Formal history must not be editable merely to conceal an error. Corrections must retain the original event and explain the correction. Auditors must be able to reconstruct the issued conditions, effective responses, assessments, approvals, notices, and final result without relying on a former employee's mailbox.

Risk flags for possible favoritism, collusion, unusual price patterns, or conflicts may prompt investigation; they are not findings of wrongdoing. Decisions must use reviewed evidence and appropriate procedure. Oversight access must not break the confidentiality of a live sealed competition.

### 18.3 Retention, disclosure, and exit

Retention policy must cover tenders, bids, financial evidence, communications, evaluations, contracts, complaints, personal accounts, and audit records. Each class needs a retention trigger, duration, owner, and disposition. The app must account for competing retention obligations and longer-lived contracts or disputes.

Legal and investigation holds must identify scope, authority, reason, and review date. When a hold is released, disposal still requires ordinary eligibility review. Record destruction must have approval and a retained disposition record where required.

Customer departure must include a defined export package, open-work transition, permitted supplier access, retention responsibilities, and disposal timetable. Removing a customer account must not silently destroy evidence needed by the parties to a live contract or complaint.

## 19. Service expectations and accessibility

- Procurement teams and suppliers must be able to complete core journeys without specialist training in the product. Explain unfamiliar terms where decisions are made.
- Navigation must show the current organization, event or contract, stage, deadline, and next required action. Clearly separate warnings, blocking conditions, and completed decisions.
- Support keyboard operation, assistive reading, understandable labels, readable contrast, accessible documents where provided, and meaningful error explanations. Provide a channel for accommodation requests.
- Allow work to be saved and resumed without losing completed business information. Warn before a user abandons unsaved work and make the saved/submitted distinction clear.
- Make deadlines and progress usable for people working in different time zones. Never rely on a countdown alone to communicate the official closing time.
- Provide consistent languages for the public journey, supplier instructions, notices, and key decisions where the buyer operates bilingually or multilingually. Identify the controlling language and document edition if legally meaningful differences arise; resolve discrepancies through a formal clarification.
- Support practical use on common workplace and mobile devices for reading, approvals, and notifications. Complex tender authoring and large pricing schedules must remain usable for their intended business users.
- Make large tenders manageable through sections, progress, assigned responsibilities, search, and clear validation rather than a single overwhelming form.
- Define customer service hours, submission-period support, accessibility assistance, incident escalation, and expected recovery communication before launch.
- Agree measurable service commitments for availability, response handling, evidence preservation, and recovery with customers. The product must not promise that a disrupted procurement can resume fairly without an explicit buyer decision.
- Preserve consistent business records during service incidents. Provide evidence of incident timing and affected actions so the buyer can make an accountable deadline or competition decision.

## 20. Exceptional and alternate journeys

| Situation | Required business response |
| --- | --- |
| No responses received | Record closure and participation history; assess timing, scope, market interest, and next steps. Authorize cancellation, redesign, or a linked new event. |
| Only one response received | Assess compliance, value, policy requirements, and approval. Do not equate being the only bidder with automatic award or automatically declare the tender invalid. |
| No compliant responses | Record findings and permitted remedies; do not retrospectively remove mandatory conditions to create a winner. |
| All offers exceed budget | Confirm comparison basis and funding; consider permitted budget approval, scope reconsideration, negotiation, or no award. Material scope changes may require a new competition. |
| Service outage near closing | Record incident timing and impact; preserve submissions; obtain an authorized decision on extensions or restart and notify affected participants consistently. |
| Supplier-local connection problem | Provide available evidence and support. Apply the published submission rule; do not automatically create a private extension. |
| Deadline extension before closing | Approve the extension, amend the official date, notify all affected participants, and preserve prior receipts and versions. |
| Proposed reopening after closing | Apply a specific approved procedure and fairness review. Once bids have been opened, default to a formally permitted new round or linked new competition, rather than reopening the original sealed round. |
| Cancellation after opening | Preserve bids, opening records, and assessment work; document authority and reasons, issue appropriate notices, and resolve securities or fees. |
| Bid validity or security expires before award | Request extensions under the permitted process, record each supplier's response, assess equal treatment, and block an unsupported commitment. Never extend consent on a supplier's behalf. |
| Required document is unreadable or incomplete | Record the received item and apply published clarification or rejection rules. A later copy must not silently replace the original. |
| Addendum issued after some bids were submitted | Explain which acknowledgments or revisions are required, provide appropriate response time, preserve original receipts, and assess final compliance explicitly. |
| New supplier lacks conventional history | Apply any published equivalent-evidence route, such as relevant team experience or permitted support. Do not invent an exception after reviewing competing bids. |
| Consortium member or key subcontractor changes | Assess eligibility, capacity, conflict, and contractual effect; require approval and any updated evidence. Preserve the originally proposed parties. |
| Supplier merger, insolvency, or ownership change | Reassess legal party, qualification, guarantees, active bids, and contract continuity with responsible reviewers. Do not automatically transfer an award. |
| Evaluator leaves or becomes conflicted | Reassign with a reason, preserve prior work, determine whether re-evaluation is needed, and prevent continued restricted access. |
| Preferred bidder fails due diligence or withdraws | Apply the declared fallback, document reasons and approvals, and reassess validity and conditions before approaching another bidder. |
| Partial award or different lot timelines | Keep independent lot decisions, deadlines where permitted, notices, and contract mappings; show an accurate aggregate event status. |
| Complaint succeeds | Record the remedy, affected decisions, notices, and any reassessment or restart. Retain superseded decisions and their reasons. |
| Agreement signed outside the app | Record the executed edition, signatories, dates, authority, and verification. Do not manufacture evidence of an in-app signing process. |
| Contract ends with open warranties or disputes | Close completed delivery work while retaining owners, dates, access, and records for surviving obligations. |
| Duplicate or fraudulent supplier claim | Restrict the disputed new access, investigate ownership, preserve existing legitimate access where appropriate, and record the resolution. |
| Customer subscription ends during an active competition | Apply the agreed continuity and offboarding plan; do not strand bidders or invalidate accepted submissions because of a commercial account change. |

## 21. Product packaging and platform operations

### 21.1 Proposed commercial model

The proposed starting model is a paid service for buying organizations, with free access for suppliers to view available public notices and participate in eligible competitions. This is a product recommendation, not a confirmed pricing decision.

Buyer packages may differ by organization size, number of legal entities, procurement volume, contract-management breadth, optional integrations, reporting services, onboarding, and support. Entitlements must be visible before a customer relies on a capability. Reaching a commercial usage limit must create a service-management action rather than silently blocking an already invited supplier's submission near closing.

Optional supplier services, if introduced, must be separate from basic eligibility and fair access to a competition. Payment must not buy improved evaluation, preferred ranking, qualification, or private access to competitors' information. Sponsored discovery must be clearly labeled and separate from formal tender ranking.

If a buyer's approved procedure requires document charges, deposits, or other participation-related fees, treat these as an optional business capability. Disclose purpose, amount, currency, payer, exemptions, receipt, refund rules, and effect on participation before payment. Financial settlement may be handled by the designated external service. Bid and performance securities must remain distinct from participation fees.

### 21.2 Operating responsibilities

The platform operator must own customer onboarding, service communications, account administration, commercial support, service incidents, help content, and orderly offboarding. Buyers remain accountable for procurement decisions and supplier treatment. Suppliers remain accountable for the authority and accuracy of their responses.

Support cases must identify whether the matter concerns product usage, access, submission evidence, supplier qualification, procurement merits, or contract performance. Product support must route business disputes to the responsible buyer and must not make unofficial deadline or award decisions.

## 22. Proposed delivery priorities

The full product described here is broader than a single initial release. A pilot should use a deliberately limited set of procedures while still exercising the complete lifecycle. Controls protecting submission integrity, fairness, authority, and evidence are not optional features to postpone for a supported procedure.

| Delivery scope | Capabilities | Business completion condition |
| --- | --- | --- |
| Core end-to-end release | Buyer and supplier organizations; users and scoped roles; requests and approvals; open and invited events; lots; qualification; document packages; Q&A and addenda; bids, revisions, receipts and opening; compliance; evaluation and moderation; optional demonstrations and negotiation within supported profiles; award and complaints; contract handover, obligations, changes, renewal, closeout; audit and basic reporting. | A real representative procurement can proceed from need to managed contract without relying on undocumented business decisions or bypassing supported controls. |
| Operational breadth | More category templates; deeper reusable qualification; specialist financial assessment; expanded dashboards; multilingual publication; more policy profiles; richer financial and external-publication handoffs; historical onboarding. | Additional buyers and categories can operate consistently using approved local policies and reconciled records. |
| Optional extensions | Frameworks and call-offs; joint procurement; reverse auctions; specialized dialogue; construction-specific commercial administration; advanced supplier development and forecasting. | Each procedure has its own approved rules, screen support, training, and business acceptance. |
| Optional assistance | Drafting, summarization, requirement comparison, and evidence-location suggestions. | Users can inspect source material, correct suggestions, and retain responsibility for all consequential decisions. |

The pilot may use one contracting entity, a small number of categories, one evaluation method, and a controlled group of suppliers. Expansion must be based on demonstrated completion and adoption, not merely on the existence of screens.

### 22.1 Controls required before any live competitive pilot

- Verified responsibility for the buyer and supplier organizations and their administrators.
- Approved procedure, authority limits, official dates, and publication package.
- Separation of drafts, sealed responses, evaluation material, and public information.
- Unambiguous submission receipts, effective revisions, deadline treatment, and opening controls.
- Stable evaluation rules, conflict handling, approvals, and preserved decision evidence.
- Complete outcome communication, complaint handling appropriate to the procedure, and accepted contract handover.
- Support, incident handling, records retention, and continuity arrangements.

## 23. Business acceptance scenarios

These scenarios define observable business outcomes for stakeholder review. They do not prescribe implementation or an engineering test framework. Each applicable scenario must be demonstrated with representative buyer, supplier, evaluator, approver, and administrator roles.

| ID | Scenario | Required outcome | Coverage |
| --- | --- | --- | --- |
| AC-01 | A visitor searches for public and invitation-only events. | Public events are discoverable without an account; private event identities and content are not exposed. | FR-08; PUB-01 to PUB-03; BR-15 |
| AC-02 | One person belongs to a buyer and two suppliers. | The current capacity is clear, records remain separated, and relevant conflicts are routed for review. | FR-01 to FR-03; COM-02; BR-02, BR-08 |
| AC-03 | A supplier invites a contributor without submission authority. | The contributor can complete assigned work but cannot submit or grant themselves additional authority. | FR-03, FR-11; SUP-04, SUP-12; BR-05 |
| AC-04 | An employee leaves during an active event. | Access ends, responsibilities can be reassigned, and past approvals or submissions remain attributable and intact. | FR-03; ADM-03; BR-38 |
| AC-05 | A request exceeds a manager's authority. | The manager cannot approve beyond the grant; the correct approval route is available and documented. | FR-04; BUY-04; BR-06 |
| AC-06 | Scope and value change after release approval. | Affected approval is invalidated or returned for reconsideration before the changed package is released. | FR-07; BUY-13; BR-10 |
| AC-07 | A supplier is registered but not qualified for a required category. | The app distinguishes the statuses and applies the declared participation gate; registration is not shown as qualification. | FR-02, FR-06; SUP-20; BR-03, BR-24 |
| AC-08 | A qualification application contains unclear financial evidence. | A restricted financial reviewer requests clarification, records sources and reporting periods, and produces an explained decision. | FR-06; BUY-34, BUY-35 |
| AC-09 | Insurance expires while a bid is being assessed. | Relevant users are alerted, the historical evidence remains unchanged, and an explicit eligibility or award decision is recorded. | FR-06; SUP-24, BUY-35; BR-25 |
| AC-10 | An addendum changes a mandatory requirement after some submissions. | All affected participants receive the change, understand any required resubmission or acknowledgment, and retain prior receipts. | FR-10, FR-12; BUY-17, SUP-08; BR-14, BR-16 |
| AC-11 | A supplier saves and internally approves a response. | It remains visibly unsubmitted until an authorized submission succeeds and produces a receipt. | FR-11, FR-12; SUP-15 to SUP-17; BR-18 |
| AC-12 | A submitted supplier prepares a replacement that fails before closing. | The earlier successful non-withdrawn submission remains effective; no false replacement receipt is issued. | FR-12; SUP-17; BR-19 |
| AC-13 | A response completes after the deadline. | Ordinary submission is rejected as late, preserving the true receipt time and any authorized exception record. | FR-12; SUP-16; BR-20 |
| AC-14 | A supplier explicitly withdraws its effective response. | A withdrawal confirmation is produced and the response is excluded from ordinary evaluation while history remains. | FR-12; SUP-17; BR-21 |
| AC-15 | A buyer administrator or support agent tries to inspect a sealed bid. | Administrative status provides no early access; opening still requires the prescribed stage and authority. | FR-03, FR-13; BUY-20; BR-17, BR-26 |
| AC-16 | A non-price assessment must precede price opening. | Prices remain unavailable until the required assessment gate and opening authorization are complete. | FR-13, FR-14; EVA-02, BUY-20 |
| AC-17 | A mandatory requirement is failed. | The decision cites evidence, follows approval rules, and prevents ordinary ranking unless a permitted clarification resolves it. | FR-13; BUY-21; BR-23 |
| AC-18 | An evaluator has not scored one criterion. | The assessment remains incomplete; missing work is not treated as zero or silently omitted. | FR-14; EVA-02; Section 9 |
| AC-19 | The worked example in Section 9 is assessed. | Results are 86 points and 88 points, with the 120,000 offer ranked first under that declared model. | FR-14; EVA-04 to EVA-06 |
| AC-20 | Moderation changes a committee result. | Original individual assessments remain available and the final result includes the permitted method and reasons. | FR-14; EVA-05; BR-27 |
| AC-21 | A demonstration or reference affects selection. | The effect follows the announced assessment basis and the supporting evidence is recorded. | FR-15; BUY-22 |
| AC-22 | A shortlist advances suppliers into a further stage. | Selection and exclusions have reasons and approval, and only the authorized audience receives the next-stage invitation. | FR-15; BUY-23 |
| AC-23 | The buyer seeks a final offer where negotiation is not permitted. | The action is blocked pending a valid procedural decision; an ordinary clarification cannot serve as a hidden negotiation round. | FR-16; BUY-27; BR-22, BR-30 |
| AC-24 | The preferred bidder fails a required diligence condition. | Award is blocked and an authorized fallback decision is recorded without treating preferred status as a contract. | FR-16, FR-17; BUY-25, BUY-26 |
| AC-25 | A timely complaint creates a blocking hold. | The relevant award or signing action remains blocked until the required decision and any revised waiting period are complete. | FR-17; BUY-28, BUY-29; BR-32 |
| AC-26 | One lot is awarded, one cancelled, and one still evaluated. | Each lot shows the correct outcome, notices and values reconcile, and the overall event is not incorrectly marked fully complete. | FR-17; BUY-26, BUY-30; BR-33 |
| AC-27 | An unsuccessful supplier requests a debrief. | The supplier receives its permitted explanation and challenge instructions without other bidders' confidential content. | FR-17; SUP-21; Section 18 |
| AC-28 | The contract differs materially from the approved award. | The difference is identified and the required review occurs before signature or start authority. | FR-18; CON-02, CON-03; BR-35 |
| AC-29 | Procurement attempts to close an event before handover is accepted. | The incomplete handover remains visible and the required closure gate is not bypassed. | FR-18; CON-04, BUY-30 |
| AC-30 | A supplier submits milestone evidence that the buyer rejects. | Rejection reasons, remediation, ownership, and revised status are recorded; acceptance and payment readiness are not implied. | FR-19; CON-06 |
| AC-31 | Several small contract changes exceed cumulative authority. | The total exposure is visible and the necessary higher approval is required. | FR-19; CON-09; BR-36 |
| AC-32 | A renewal deadline arrives with no approved decision. | Responsible users are alerted; the product does not create an automatic renewal or supplier consent. | FR-19; CON-10; BR-37 |
| AC-33 | An external publication or signature service reports failure. | The event remains visibly unconfirmed or unsigned; the exception is assigned and reconciled. | FR-08, FR-18, FR-22; ADM-15 |
| AC-34 | A report includes a multi-lot tender with several bid revisions. | Supplier and value counts are not inflated, currency assumptions are stated, and drill-through matches permitted records. | FR-21; REP-01; Section 15 |
| AC-35 | A legal hold applies to otherwise expired records. | Disposal is prevented, the hold is visible to authorized records staff, and the underlying history remains intact. | FR-22; ADM-14; BR-40 |
| AC-36 | A customer exits with a live tender and contract. | A documented continuity and export plan preserves access and obligations according to the service agreement. | FR-22; ADM-17, OPS-02; BR-47 |
| AC-37 | A framework call-off exceeds the allowed term or scope. | The order cannot proceed as an ordinary eligible call-off; an alternative approved route is required. | FR-20; CON-12; extension |
| AC-38 | An assistance feature suggests an unsupported exclusion or score. | The suggestion is identifiable, evidence can be inspected, and no official decision occurs without authorized human review. | FR-21; EXT-03; BR-48; extension |
| AC-39 | An RFI obtains useful market information but makes no purchase. | The event can close successfully with reviewed findings and a linked next-step decision, without requiring an award or contract. | FR-05; BUY-06, BUY-30 |

## 24. Launch readiness and adoption

### 24.1 Customer readiness

Before live use, the customer must appoint a procurement process owner, organization administrator, records owner, support contact, complaint owner, and contract-management owner. It must approve the initial procedure profiles, templates, delegations, qualification programs, retention rules, public content, official calendars, and service-continuity arrangements.

Initial supplier and contract records must be reviewed for identity, duplicates, completeness, current ownership, and validity. Imported historical records must state their origin, original business dates, import date, and evidence gaps. Importing an old record must not falsely certify that historical actions occurred within the product or met controls that were not in use at the time.

### 24.2 Pilot and training

The pilot must include representative requests, an open or invited competition, supplier qualification, multiple suppliers, an amendment, a bid replacement, an exclusion or clarification, independent evaluation, award approval, outcome communication, and contract handover. At least one realistic exception must be exercised, such as a conflicted evaluator or failed notice delivery.

Training must be role-specific: requesters need intake guidance; suppliers need preparation and submission practice; evaluators need scoring and evidence guidance; approvers need authority and version awareness; contract managers need handover and obligation management; administrators need access and policy-change responsibilities.

Provide a safe practice opportunity for suppliers before they face a live deadline. Publish clear support channels and distinguish usage help from procurement questions and formal complaints. Ask participants where instructions were ambiguous or required unnecessary effort.

### 24.3 Business sign-off

Launch approval requires demonstrated applicable acceptance scenarios, resolved material access or fairness issues, clear support ownership, validated public notices, a complete example decision record, and an accepted contract handover. Procurement, supplier representatives, finance, compliance/legal, records, and service operations should each approve the areas they own.

After the pilot, establish baseline measures from Section 15 and agree improvement targets. Review abandonment, help requests, incomplete responses, delayed approvals, and supplier feedback before expanding procedure breadth.

## 25. Assumptions, decisions, risks, and references

### 25.1 Explicit assumptions

- The desired product manages the buyer's procurement lifecycle and the supplier's participation in it, rather than only helping suppliers write bids.
- The product is intended to be reusable across buying organizations and categories. A single-organization deployment is a valid simpler use case.
- Supplier qualification is a first-class lifecycle because the preceding discussion expressly raised financial health and capability checks.
- The contract-management scope includes obligations, performance, changes, renewal, and closeout because the source process continues after award.
- Public-sector and private-sector procedures are both potential uses; neither a specific country nor a particular legal regime has been selected.
- Multiple lots, currencies, languages, and legal entities are supported business needs, but a pilot can constrain the initial operating profile.
- All product packaging, defaults, priorities, and additional capabilities in this document are proposals for review.

### 25.2 Decisions to resolve with the product owner

These questions do not prevent use of this PRD as a business baseline. They determine the first target market, customer policy setup, and release boundaries.

| Decision | Proposed starting position | What must be confirmed |
| --- | --- | --- |
| Initial customer segment | A limited set of buyers with repeatable, moderately complex procurement. | Public body, private enterprise, nonprofit, procurement agent, or another primary segment. |
| Jurisdictions and policy obligations | Configurable policy profiles with no universal legal thresholds. | Applicable procurement rules, trade obligations, disclosure requirements, challenge routes, and specialist review. |
| Initial procurement categories | Goods and services using a small set of approved templates. | Whether construction, regulated services, or specialist categories are required at launch. |
| Supported initial procedures | Open and invited RFQ/RFP/tender plus information-only RFI. | Which procedures require staged opening, negotiation, or multiple rounds from day one. |
| Supplier identity model | Reusable supplier profile with buyer-specific relationships and selective sharing. | Whether customers require entirely separate supplier registration environments. |
| Qualification authority | Buyer-specific decisions with reusable submitted evidence. | Whether third-party certification or an umbrella qualification program is accepted, and within what scope. |
| Public document access | Public notices without login; clearly declared conditions for other material. | Which documents are public, registered-only, invitation-only, or subject to undertakings. |
| Evaluation model | Declared weighted criteria and a documented moderation method. | Alternative selection methods, price formulas, thresholds, quorum, and tie procedures. |
| Financial approval basis | Total contemplated commitment including relevant options and linked scope. | Customer-specific value calculations, authority levels, funding controls, and exception routes. |
| Contract depth | Operational obligations, performance, changes, renewals, and financial-status visibility. | Whether a separate contract product owns any of these activities. |
| Languages and calendar | Buyer-selected official language(s), time zone, and working calendar. | Initial languages, translation ownership, controlling editions, and applicable holidays. |
| Service commitments | Documented submission-period support and continuity plan. | Availability commitments, support hours, response targets, and customer incident authority. |
| Records policy | Record-class-specific retention and legal holds. | Actual durations, triggers, disclosure obligations, export access, and disposal approvals. |
| Integrations | Begin with those that eliminate critical duplicate decisions or records. | Which systems are authoritative and which handoffs are required for launch. |
| Commercial packaging | Buyer subscription and free essential supplier participation. | Pricing basis, limits, premium modules, optional fees, and continuity terms. |
| Optional assistance | Human-reviewed drafting and evidence support only. | Whether customers want these features and permit relevant information to be used for that purpose. |

### 25.3 Principal business risks

| Risk | Business consequence | Required response |
| --- | --- | --- |
| One universal procedure is applied to every buyer. | Inappropriate controls, missed obligations, or excessive burden. | Approve scoped policy profiles and supported procedures before use. |
| The product tries to deliver every optional module immediately. | Delayed launch and difficult adoption. | Limit pilot breadth while preserving complete controls for the procedures offered. |
| Suppliers cannot understand or complete submissions. | Reduced competition, disputes, and missed deadlines. | Use clear guidance, practice journeys, accessible forms, and submission-period support. |
| Administrators or evaluators receive excessive access. | Confidentiality breach or compromised fairness. | Separate administrative and business privileges; review effective access and conflicts. |
| Reused supplier evidence becomes stale. | Unsuitable suppliers advance or contracts face avoidable risk. | Record validity, review triggers, qualification scope, and ongoing conditions. |
| Requirements or scoring change after offers are known. | Unfair decisions and challenges. | Preserve issued versions and require formal, procedurally valid decisions. |
| External records disagree or publication fails. | Wrong commitments, misleading notices, or incomplete approvals. | Assign record ownership, reconciliation, visible exceptions, and manual fallback. |
| Award commitments are lost during handover. | Delivery disputes and unmanaged obligations. | Require an accepted handover and named contract owners before procurement closeout. |
| Reporting claims savings or competition without a sound basis. | Misleading management decisions. | Define measures, comparable baselines, currency basis, and missing information. |
| Service or commercial suspension disrupts a live tender. | Suppliers lose opportunity and the buyer loses process integrity. | Establish continuity, incident evidence, accountable deadline decisions, and orderly exit. |

### 25.4 Basis and domain references

The primary scope source is the user's September 26, 2026 Tender Basics discussion: the 16-step lifecycle and the subsequent supplier-qualification question. Section 6 provides direct process-to-requirement and screen traceability. The remaining detail is a proposed business expansion of that source.

Two primary procurement references were consulted as domain cross-checks on September 29, 2026:

1. [UNCITRAL Model Law on Public Procurement (2011)](https://uncitral.un.org/en/texts/procurement/modellaw/public_procurement) — general framing for transparency, competition, objectivity, and value in procurement.
2. [World Bank Procurement Regulations for IPF Borrowers, Seventh Edition, September 2025](https://thedocs.worldbank.org/en/doc/c84273d1b230aeb2b0b8134de5dc8cd7-0290012025/original/Procurement-Regulations-7th-Edition-Sep-2025.pdf) — examples of how a procurement framework distinguishes evaluation, intention to award, standstill, debriefing, complaints, final award, and contract management.

These references do not establish the rules for every prospective customer. This PRD deliberately leaves legal periods, thresholds, permitted procedures, and disclosure duties to the applicable customer policy and review. It does not claim compliance certification with either framework.
