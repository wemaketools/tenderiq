/**
 * Requests feature test data (BUY-02..04, BUY-06).
 * Test data only: contract-valid responses captured from the mock API fixtures, never imported by application code.
 */
import type {
  ProcedureOptions,
  RequestDecisionView,
  RequestDetail,
  RequestOptions,
  StrategyDetail,
} from '@contracts/requests';

export const options: RequestOptions = {
  legalEntities: [
    {
      id: 1,
      name: 'Kalahari Water Utilities Corporation',
    },
  ],
  departments: [
    {
      id: 1,
      code: 'OPS',
      name: 'Operations',
      legalEntityId: 1,
    },
    {
      id: 2,
      code: 'TECH',
      name: 'Technical Services',
      legalEntityId: 1,
    },
    {
      id: 3,
      code: 'NET',
      name: 'Network Operations',
      legalEntityId: 1,
    },
    {
      id: 4,
      code: 'WQ',
      name: 'Water Quality',
      legalEntityId: 1,
    },
    {
      id: 5,
      code: 'CORP',
      name: 'Corporate Services',
      legalEntityId: 1,
    },
    {
      id: 6,
      code: 'FIN',
      name: 'Finance',
      legalEntityId: 1,
    },
    {
      id: 7,
      code: 'FLEET',
      name: 'Fleet and Logistics',
      legalEntityId: 1,
    },
  ],
  categories: [
    {
      id: 1,
      code: 'WTR-INFRA',
      name: 'Water infrastructure',
      parentId: null,
    },
    {
      id: 2,
      code: 'WTR-PUMP',
      name: 'Pumps and mechanical equipment',
      parentId: 1,
    },
    {
      id: 3,
      code: 'WTR-PIPE',
      name: 'Pipes, valves and fittings',
      parentId: 1,
    },
    {
      id: 4,
      code: 'ICT-SCADA',
      name: 'SCADA and telemetry',
      parentId: null,
    },
    {
      id: 5,
      code: 'WTR-CHEM',
      name: 'Water treatment chemicals',
      parentId: null,
    },
    {
      id: 6,
      code: 'FLEET-SVC',
      name: 'Fleet services',
      parentId: null,
    },
    {
      id: 7,
      code: 'FAC-SVC',
      name: 'Facilities and office',
      parentId: null,
    },
    {
      id: 8,
      code: 'LAB-EQP',
      name: 'Laboratory equipment',
      parentId: null,
    },
    {
      id: 9,
      code: 'PPE',
      name: 'Protective clothing and equipment',
      parentId: null,
    },
    {
      id: 10,
      code: 'ICT-COMMS',
      name: 'Communications ICT',
      parentId: null,
    },
    {
      id: 11,
      code: 'ENG-SVC',
      name: 'Engineering services',
      parentId: null,
    },
    {
      id: 12,
      code: 'ENERGY',
      name: 'Energy and power',
      parentId: null,
    },
  ],
  costCenters: [
    {
      id: 1,
      code: 'CC-OPS-410',
      name: 'Borehole operations',
      departmentId: 1,
    },
    {
      id: 2,
      code: 'CC-NET-520',
      name: 'Network maintenance',
      departmentId: 3,
    },
    {
      id: 3,
      code: 'CC-WQ-610',
      name: 'Central laboratory',
      departmentId: 4,
    },
    {
      id: 4,
      code: 'CC-CORP-110',
      name: 'Head office',
      departmentId: 5,
    },
    {
      id: 5,
      code: 'CC-FLT-710',
      name: 'Fleet workshop',
      departmentId: 7,
    },
    {
      id: 6,
      code: 'CC-TECH-310',
      name: 'Telemetry and control',
      departmentId: 2,
    },
  ],
  fundingSources: [
    {
      id: 1,
      code: 'CAPEX-2026',
      name: 'Capital budget FY2026/27',
      sourceType: 'capital_budget',
    },
    {
      id: 2,
      code: 'OPEX-2026',
      name: 'Operating budget FY2026/27',
      sourceType: 'operating_budget',
    },
    {
      id: 3,
      code: 'WSRG',
      name: 'Water Sector Resilience Grant',
      sourceType: 'grant',
    },
    {
      id: 4,
      code: 'CAPEX-2027',
      name: 'Capital budget FY2027/28',
      sourceType: 'capital_budget',
    },
  ],
  projects: [
    {
      id: 1,
      reference: 'PP-2026-0001',
      title: 'Borehole rehabilitation programme 2026–2028',
    },
    {
      id: 2,
      reference: 'PP-2026-0002',
      title: 'Telemetry and leak management programme',
    },
    {
      id: 3,
      reference: 'PP-2026-0003',
      title: 'Network pressure management',
    },
  ],
  people: [
    {
      userId: 4,
      fullName: 'Mpho Dikgang',
      capacity: 'Procurement Manager',
      roles: ['requester', 'sponsor', 'owner', 'plan_owner'],
    },
    {
      userId: 5,
      fullName: 'Tebogo Molefe',
      capacity: 'Procurement Officer',
      roles: ['requester', 'sponsor', 'owner', 'plan_owner'],
    },
    {
      userId: 6,
      fullName: 'Kagiso Phiri',
      capacity: 'Operations Engineer',
      roles: ['requester', 'sponsor'],
    },
    {
      userId: 7,
      fullName: 'Onalenna Tau',
      capacity: 'Budget Owner, Operations',
      roles: ['sponsor', 'budget_owner'],
    },
    {
      userId: 17,
      fullName: 'Dineo Masire',
      capacity: 'Legal Counsel',
      roles: ['sponsor'],
    },
    {
      userId: 18,
      fullName: 'Keabetswe Nkwe',
      capacity: 'Chief Executive (Award Approver)',
      roles: ['sponsor'],
    },
  ],
  contracts: [
    {
      id: 1,
      reference: 'C-2026-0001',
      title: 'Fleet vehicle maintenance',
      expiresOn: '2027-03-31',
    },
    {
      id: 2,
      reference: 'C-2026-0002',
      title: 'Borehole pumps — Lot 1',
      expiresOn: '2028-10-31',
    },
    {
      id: 7,
      reference: 'C-2025-0007',
      title: 'Legacy meter reading',
      expiresOn: '2026-06-30',
    },
  ],
  suppliers: [
    {
      tenantId: 4,
      name: 'Tsodilo Engineering',
    },
    {
      tenantId: 5,
      name: 'Chobe Pipe & Valve Supplies',
    },
    {
      tenantId: 6,
      name: 'Makgadikgadi Civil Works',
    },
    {
      tenantId: 7,
      name: 'Serowe ICT Solutions',
    },
    {
      tenantId: 8,
      name: 'Limpopo Environmental Services',
    },
    {
      tenantId: 9,
      name: 'Gaborone Metering Co.',
    },
  ],
  currencies: ['BWP', 'ZAR', 'USD'],
  budgetPeriods: ['FY2026/27', 'FY2027/28'],
};

export const request: RequestDetail = {
  id: 3,
  reference: 'PR-2026-0003',
  title: 'Northern wellfield pipeline extension',
  problemStatement:
    'The northern villages depend on a single 1978 asbestos-cement main with frequent bursts; new boreholes cannot be connected.',
  requester: {
    userId: 6,
    fullName: 'Kagiso Phiri',
  },
  owner: {
    userId: 5,
    fullName: 'Tebogo Molefe',
  },
  category: {
    id: 3,
    code: 'WTR-PIPE',
    name: 'Pipes, valves and fittings',
  },
  department: {
    id: 3,
    code: 'NET',
    name: 'Network Operations',
  },
  estimatedValue: {
    amount: '4850000.00',
    currency: 'BWP',
  },
  estimatedTotalCommitment: {
    amount: '5120000.00',
    currency: 'BWP',
  },
  fundingStatus: 'approved_budget',
  priority: 'critical',
  status: 'under_review',
  needType: 'new_expenditure',
  targetDate: '2027-06-30',
  submittedAt: '2026-09-14T07:45:00Z',
  ageDays: 15,
  revision: 1,
  reapprovalRequired: false,
  combinedInto: null,
  deferredUntil: null,
  createdAt: '2026-09-08T10:20:00Z',
  updatedAt: '2026-09-23T08:15:00Z',
  sponsor: {
    userId: 18,
    fullName: 'Keabetswe Nkwe',
  },
  budgetOwner: {
    userId: 7,
    fullName: 'Onalenna Tau',
  },
  legalEntity: {
    id: 1,
    name: 'Kalahari Water Utilities Corporation',
  },
  costCenter: {
    id: 2,
    code: 'CC-NET-520',
    name: 'Network maintenance',
  },
  fundingSource: {
    id: 1,
    code: 'CAPEX-2026',
    name: 'Capital budget FY2026/27',
  },
  project: {
    id: 3,
    reference: 'PP-2026-0003',
    title: 'Network pressure management',
  },
  expectedOutcomes:
    'A second supply route for 12,000 residents and connection of three new boreholes.',
  scopeDescription:
    'Design review, supply and laying of 14.2 km of 315 mm HDPE pipeline with valves, chambers and two crossings.',
  quantities: '14.2 km of pipeline, 18 valve chambers, 2 road crossings.',
  deliveryLocations: 'Northern wellfield corridor between Letlhakane and Mopipi.',
  constraints: 'Works outside the rainy season; wayleave along the A14 road reserve.',
  stakeholders:
    'Network Operations, Technical Services, Roads Department, village development committees.',
  consequenceOfDelay: 'Another dry season on a single failing main; new boreholes stay idle.',
  risks: 'Ground conditions at the river crossing; wayleave approval lead time.',
  replacesContract: null,
  estimationBasis:
    'Engineer’s estimate (August 2026) using 2026 HDPE prices and the 2025 civil works rates.',
  accountingReference: 'CAPEX-2026/NET/PIPE-07',
  contractTermMonths: 18,
  renewalOptions: 'None; a 12-month defects liability period follows completion.',
  routedContract: null,
  convertedTender: null,
  planItem: {
    id: 203,
    title: 'Northern wellfield pipeline extension',
    status: 'scheduled',
  },
  strategy: null,
  decision: {
    decidedAt: null,
    decisionReason: null,
    deferredUntil: null,
    latest: {
      decision: 'escalate',
      decidedBy: {
        userId: 4,
        fullName: 'Mpho Dikgang',
        capacity: 'Procurement Manager',
      },
      decidedAt: '2026-09-23T08:15:00Z',
      reason: 'Total commitment BWP 5,120,000 exceeds my BWP 2,000,000 request authority.',
    },
    awaitingDecisionFrom: {
      userId: 18,
      fullName: 'Keabetswe Nkwe',
    },
  },
  links: [
    {
      id: 2,
      linkType: 'related_purchase',
      direction: 'incoming',
      request: {
        id: 13,
        reference: 'PR-2026-0013',
        title: 'Mobile water tanker hire for drought relief',
        status: 'under_review',
      },
      requester: {
        userId: 4,
        fullName: 'Mpho Dikgang',
      },
      estimatedValue: {
        amount: '1650000.00',
        currency: 'BWP',
      },
      fundingStatus: 'approved_budget',
      note: 'Interim supply until the pipeline extension is commissioned.',
    },
  ],
  infoRequests: [
    {
      id: 3,
      question: 'Confirm that the wayleave application along the A14 road reserve has been lodged.',
      requestedBy: {
        userId: 5,
        fullName: 'Tebogo Molefe',
      },
      requestedAt: '2026-09-15T09:00:00Z',
      dueAt: '2026-09-19T15:00:00Z',
      responseText:
        'Lodged with the Roads Department on 2 September 2026 (reference RD/WL/2026/118).',
      respondedBy: {
        userId: 6,
        fullName: 'Kagiso Phiri',
      },
      respondedAt: '2026-09-16T07:40:00Z',
      status: 'answered',
    },
  ],
  revisions: [
    {
      revision: 1,
      createdAt: '2026-09-08T10:20:00Z',
      createdBy: {
        userId: 6,
        fullName: 'Kagiso Phiri',
      },
      changeSummary: 'Business case drafted and submitted.',
      changedFields: [],
      material: false,
    },
  ],
  materialChange: null,
  valueBasis: {
    ownValue: {
      amount: '4850000.00',
      currency: 'BWP',
    },
    combinedValue: null,
    totalCommitment: {
      amount: '5120000.00',
      currency: 'BWP',
    },
    approvalValue: {
      amount: '5120000.00',
      currency: 'BWP',
    },
    basis: 'total_commitment',
    explanation:
      'The request is approved on its total contemplated commitment, including options, renewals and associated purchases, not on the initial estimate alone.',
  },
  submissionReadiness: [
    {
      id: 'problemStatement',
      label: 'Problem or opportunity',
      status: 'passed',
      detail: null,
    },
    {
      id: 'expectedOutcomes',
      label: 'Expected outcomes',
      status: 'passed',
      detail: null,
    },
    {
      id: 'scopeDescription',
      label: 'Scope',
      status: 'passed',
      detail: null,
    },
    {
      id: 'quantities',
      label: 'Quantities or service volumes',
      status: 'passed',
      detail: null,
    },
    {
      id: 'deliveryLocations',
      label: 'Delivery locations',
      status: 'passed',
      detail: null,
    },
    {
      id: 'targetDate',
      label: 'Target date',
      status: 'passed',
      detail: null,
    },
    {
      id: 'consequenceOfDelay',
      label: 'Consequence of delay',
      status: 'passed',
      detail: null,
    },
    {
      id: 'estimatedValue',
      label: 'Estimated value and currency',
      status: 'passed',
      detail: null,
    },
    {
      id: 'estimationBasis',
      label: 'Estimation basis',
      status: 'passed',
      detail: null,
    },
    {
      id: 'fundingSourceId',
      label: 'Funding source',
      status: 'passed',
      detail: null,
    },
    {
      id: 'budgetOwnerUserId',
      label: 'Budget owner',
      status: 'passed',
      detail: null,
    },
    {
      id: 'estimatedTotalCommitment',
      label: 'Estimated total commitment',
      status: 'passed',
      detail: null,
    },
    {
      id: 'stakeholders',
      label: 'Stakeholders',
      status: 'passed',
      detail: null,
    },
    {
      id: 'constraints',
      label: 'Known constraints',
      status: 'passed',
      detail: null,
    },
    {
      id: 'risks',
      label: 'Risks',
      status: 'passed',
      detail: null,
    },
    {
      id: 'contractTermMonths',
      label: 'Proposed contract term',
      status: 'passed',
      detail: null,
    },
    {
      id: 'accountingReference',
      label: 'Accounting or project reference',
      status: 'passed',
      detail: null,
    },
    {
      id: 'fundingStatus',
      label: 'Funding status',
      status: 'passed',
      detail: null,
    },
  ],
  allowedActions: [
    'request_info',
    'assign',
    'combine',
    'split',
    'defer',
    'comment',
    'route_to_contract',
  ],
  createTenderPath: null,
  approvalId: 305,
};

export const strategy: StrategyDetail = {
  id: 506,
  title: 'Pressure-reducing valve replacement — Gaborone West and Tlokweng',
  project: {
    id: 3,
    reference: 'PP-2026-0003',
    title: 'Network pressure management',
  },
  request: {
    id: 5,
    reference: 'PR-2026-0005',
    title: 'Pressure-reducing valve replacement — Gaborone West and Tlokweng',
    status: 'approved',
  },
  revision: 1,
  eventType: 'tender',
  procedure: 'open',
  awardModel: 'single',
  status: 'draft',
  owner: {
    userId: 5,
    fullName: 'Tebogo Molefe',
  },
  category: {
    id: 3,
    code: 'WTR-PIPE',
    name: 'Pipes, valves and fittings',
  },
  estimatedValue: {
    amount: '1770000.00',
    currency: 'BWP',
  },
  pendingFairnessReviews: 1,
  tenders: [],
  updatedAt: '2026-09-26T14:00:00Z',
  intendedOutcome:
    'Install 22 pressure-reducing valves with loggers in two zones within one dry season.',
  competitionRationale:
    'Open tender: above the invitation-only threshold and several qualified valve suppliers exist.',
  directAwardGrounds: null,
  risks: 'Lead time of 200 mm valves; shut-down coordination in Tlokweng.',
  qualificationApproach:
    'Qualification programme "Water Infrastructure Suppliers — Category A" (WTR-PIPE scope).',
  lotStrategy: null,
  evaluationApproach: null,
  negotiationPermitted: false,
  timetableSummary: 'Release November 2026, award February 2027.',
  externalOversight: null,
  policy: {
    policyProfileVersion: {
      id: 3,
      name: 'KWU Procurement Policy 2026',
      versionNo: 3,
    },
    permittedProcedures: ['rfi', 'open', 'restricted', 'invitation_only', 'multi_stage', 'direct'],
    procedurePermitted: true,
    withinThreshold: null,
    thresholdNote: null,
    requiresPublicNotice: true,
  },
  procedureDistinctions: [
    {
      id: 'public_discovery',
      label: 'Public discovery of the notice',
      satisfied: true,
      detail: 'A public notice is required by policy.',
    },
    {
      id: 'consistent_access',
      label: 'Consistent access conditions for every supplier',
      satisfied: true,
      detail:
        'Qualification programme "Water Infrastructure Suppliers — Category A" (WTR-PIPE scope).',
    },
    {
      id: 'objective_eligibility',
      label: 'Objective eligibility criteria',
      satisfied: true,
      detail:
        'Qualification programme "Water Infrastructure Suppliers — Category A" (WTR-PIPE scope).',
    },
  ],
  marketResearch: [
    {
      id: 808,
      sourceType: 'supplier_consultation',
      source: 'Chobe Pipe & Valve Supplies — network survey support, August 2026',
      finding:
        'Chobe Pipe advised on valve sizing and chamber layout during the 2026 network survey.',
      isSupplierCommitment: false,
      supplier: {
        tenantId: 5,
        name: 'Chobe Pipe & Valve Supplies',
      },
      priorSpecificationInvolvement: true,
      recordedAt: '2026-09-22T09:00:00Z',
      recordedBy: {
        userId: 5,
        fullName: 'Tebogo Molefe',
      },
    },
    {
      id: 809,
      sourceType: 'supplier_consultation',
      source: 'Chobe Pipe & Valve Supplies — lead time letter, 23 September 2026',
      finding:
        'Chobe Pipe committed to a 10-week delivery lead time for 200 mm pressure-reducing valves.',
      isSupplierCommitment: true,
      supplier: {
        tenantId: 5,
        name: 'Chobe Pipe & Valve Supplies',
      },
      priorSpecificationInvolvement: false,
      recordedAt: '2026-09-23T15:00:00Z',
      recordedBy: {
        userId: 5,
        fullName: 'Tebogo Molefe',
      },
    },
    {
      id: 810,
      sourceType: 'price_benchmark',
      source: 'T-2026-0008 market prices (valves bulk supply)',
      finding: 'Valve unit prices of BWP 28,000–41,000 depending on size (unverified estimate).',
      isSupplierCommitment: false,
      supplier: null,
      priorSpecificationInvolvement: false,
      recordedAt: '2026-09-24T09:00:00Z',
      recordedBy: {
        userId: 5,
        fullName: 'Tebogo Molefe',
      },
    },
  ],
  fairnessReviews: [
    {
      id: 702,
      subjectType: 'strategy',
      subjectId: 506,
      supplier: {
        tenantId: 5,
        name: 'Chobe Pipe & Valve Supplies',
      },
      reason:
        'Chobe Pipe advised on valve sizing and chamber layout used in the draft specification.',
      reviewer: null,
      outcome: 'pending',
      note: null,
      createdAt: '2026-09-22T09:05:00Z',
      decidedAt: null,
    },
  ],
  approval: null,
  callerAuthority: {
    decisionType: 'strategy_approval',
    amount: {
      amount: '1770000.00',
      currency: 'BWP',
    },
    sufficient: true,
    basis: 'authority_limit',
    limit: {
      amount: '2000000.00',
      currency: 'BWP',
    },
    delegatedFrom: null,
    conversion: null,
    missingExchangeRate: false,
    routedToNextLevel: false,
  },
  rfiOutcome: null,
  submissionReadiness: [
    {
      id: 'intendedOutcome',
      label: 'Intended procurement outcome',
      status: 'passed',
      detail: null,
    },
    {
      id: 'competitionRationale',
      label: 'Competition rationale',
      status: 'passed',
      detail: null,
    },
    {
      id: 'risks',
      label: 'Risks',
      status: 'passed',
      detail: null,
    },
    {
      id: 'qualificationApproach',
      label: 'Qualification approach',
      status: 'passed',
      detail: null,
    },
    {
      id: 'lotStrategy',
      label: 'Lot structure',
      status: 'blocking',
      detail: 'Required before submission.',
    },
    {
      id: 'evaluationApproach',
      label: 'Evaluation method',
      status: 'blocking',
      detail: 'Required before submission.',
    },
    {
      id: 'timetableSummary',
      label: 'Timetable',
      status: 'passed',
      detail: null,
    },
    {
      id: 'procedure',
      label: 'Procedure permitted by policy',
      status: 'passed',
      detail: null,
    },
    {
      id: 'fairness',
      label: 'Fairness reviews concluded',
      status: 'blocking',
      detail: '1 fairness review(s) on prior supplier involvement still pending.',
    },
    {
      id: 'research',
      label: 'Market research recorded',
      status: 'passed',
      detail: '2 finding(s) are unverified estimates, not supplier commitments.',
    },
  ],
  allowedActions: ['edit', 'add_research', 'decide_fairness', 'submit'],
  createTenderPath: null,
};

export const procOptions: ProcedureOptions = {
  strategyId: 506,
  estimatedValue: {
    amount: '1770000.00',
    currency: 'BWP',
  },
  options: [
    {
      procedure: 'rfi',
      eventTypes: ['rfi'],
      purpose: 'Understand suppliers, approaches and market conditions.',
      requiredDistinctions: [
        'State that participation does not itself create an award entitlement',
        'Control the future use of information suppliers share',
      ],
      permittedByPolicy: true,
      withinThreshold: null,
      thresholdNote: null,
      requiresExceptionApproval: false,
      typicalDurationDays: 30,
      selected: false,
    },
    {
      procedure: 'open',
      eventTypes: ['rfq', 'rfp', 'tender'],
      purpose: 'Invite any supplier meeting the published conditions.',
      requiredDistinctions: [
        'Public discovery of the notice',
        'Consistent access conditions for every supplier',
        'Objective eligibility criteria',
      ],
      permittedByPolicy: true,
      withinThreshold: null,
      thresholdNote: null,
      requiresExceptionApproval: false,
      typicalDurationDays: 90,
      selected: true,
    },
    {
      procedure: 'restricted',
      eventTypes: ['rfq', 'rfp', 'tender'],
      purpose: 'Invite suppliers selected through an approved eligibility process.',
      requiredDistinctions: [
        'Link the qualification or shortlist decision',
        'Preserve the reasons for selection',
      ],
      permittedByPolicy: true,
      withinThreshold: null,
      thresholdNote: null,
      requiresExceptionApproval: false,
      typicalDurationDays: 110,
      selected: false,
    },
    {
      procedure: 'invitation_only',
      eventTypes: ['rfq', 'rfp'],
      purpose: 'Seek responses from named suppliers.',
      requiredDistinctions: [
        'Approved invite list, additions and refusals',
        'Sufficient-competition review where policy requires it',
      ],
      permittedByPolicy: true,
      withinThreshold: false,
      thresholdNote: 'Up to BWP 1,000,000.00 under KWU Procurement Policy 2026.',
      requiresExceptionApproval: false,
      typicalDurationDays: 45,
      selected: false,
    },
    {
      procedure: 'multi_stage',
      eventTypes: ['rfp', 'tender'],
      purpose: 'Progress from an initial response to selected subsequent stages.',
      requiredDistinctions: [
        'Announced stage rules and promotion decisions',
        'Distinct deadlines per stage',
        'Preserved submissions of every stage',
      ],
      permittedByPolicy: true,
      withinThreshold: null,
      thresholdNote: null,
      requiresExceptionApproval: false,
      typicalDurationDays: 150,
      selected: false,
    },
    {
      procedure: 'direct',
      eventTypes: ['rfq', 'rfp'],
      purpose: 'Buy from a specified source under an approved exception.',
      requiredDistinctions: [
        'Exception grounds and justification',
        'Approver and approved value',
        'Any required disclosure; no fabricated competitive history',
      ],
      permittedByPolicy: true,
      withinThreshold: false,
      thresholdNote: 'Up to BWP 250,000.00 under KWU Procurement Policy 2026.',
      requiresExceptionApproval: true,
      typicalDurationDays: 20,
      selected: false,
    },
  ],
};

export const decision: RequestDecisionView = {
  request: {
    id: 3,
    reference: 'PR-2026-0003',
    title: 'Northern wellfield pipeline extension',
    problemStatement:
      'The northern villages depend on a single 1978 asbestos-cement main with frequent bursts; new boreholes cannot be connected.',
    requester: {
      userId: 6,
      fullName: 'Kagiso Phiri',
    },
    owner: {
      userId: 5,
      fullName: 'Tebogo Molefe',
    },
    category: {
      id: 3,
      code: 'WTR-PIPE',
      name: 'Pipes, valves and fittings',
    },
    department: {
      id: 3,
      code: 'NET',
      name: 'Network Operations',
    },
    estimatedValue: {
      amount: '5120000.00',
      currency: 'BWP',
    },
    estimatedTotalCommitment: {
      amount: '5120000.00',
      currency: 'BWP',
    },
    fundingStatus: 'approved_budget',
    priority: 'critical',
    status: 'under_review',
    needType: 'new_expenditure',
    targetDate: '2027-06-30',
    submittedAt: '2026-09-14T07:45:00Z',
    ageDays: 15,
    revision: 1,
    reapprovalRequired: false,
    combinedInto: null,
    deferredUntil: null,
    createdAt: '2026-09-08T10:20:00Z',
    updatedAt: '2026-09-23T08:15:00Z',
  },
  subjectRevision: 1,
  contentHash: '6c88c69eb768832ba31f7b45d9c41c64bfa03e779d7cecc733b873c272fc584c',
  requestedAuthority: {
    decisionType: 'request_approval',
    amount: {
      amount: '5120000.00',
      currency: 'BWP',
    },
    basis: 'total_commitment',
    explanation:
      'The request is approved on its total contemplated commitment, including options, renewals and associated purchases, not on the initial estimate alone.',
  },
  callerAuthority: {
    decisionType: 'request_approval',
    amount: {
      amount: '5120000.00',
      currency: 'BWP',
    },
    sufficient: false,
    basis: 'authority_limit',
    limit: {
      amount: '2000000.00',
      currency: 'BWP',
    },
    delegatedFrom: null,
    conversion: null,
    missingExchangeRate: false,
    routedToNextLevel: true,
  },
  eligibleApprovers: [
    {
      userId: 18,
      fullName: 'Keabetswe Nkwe',
      capacity: 'Chief Executive (Award Approver)',
      check: {
        decisionType: 'request_approval',
        amount: {
          amount: '5120000.00',
          currency: 'BWP',
        },
        sufficient: true,
        basis: 'authority_limit',
        limit: {
          amount: '10000000.00',
          currency: 'BWP',
        },
        delegatedFrom: null,
        conversion: null,
        missingExchangeRate: false,
        routedToNextLevel: false,
      },
    },
  ],
  routedToNextLevel: true,
  skippedLevel: {
    userId: 4,
    fullName: 'Mpho Dikgang',
    capacity: 'Procurement Manager',
    check: {
      decisionType: 'request_approval',
      amount: {
        amount: '5120000.00',
        currency: 'BWP',
      },
      sufficient: false,
      basis: 'authority_limit',
      limit: {
        amount: '2000000.00',
        currency: 'BWP',
      },
      delegatedFrom: null,
      conversion: null,
      missingExchangeRate: false,
      routedToNextLevel: true,
    },
  },
  route: {
    approvalId: 305,
    status: 'pending',
    currentApprover: {
      userId: 18,
      fullName: 'Keabetswe Nkwe',
    },
    requestedAt: '2026-09-23T08:15:00Z',
    dueAt: '2026-10-07T15:00:00Z',
  },
  awaitingDecisionFrom: {
    userId: 18,
    fullName: 'Keabetswe Nkwe',
  },
  funding: {
    status: 'approved_budget',
    fundingSource: {
      id: 1,
      code: 'CAPEX-2026',
      name: 'Capital budget FY2026/27',
    },
    budgetOwner: {
      userId: 7,
      fullName: 'Onalenna Tau',
    },
    confirmedAmount: {
      amount: '4850000.00',
      currency: 'BWP',
    },
    confirmedBy: {
      userId: 7,
      fullName: 'Onalenna Tau',
    },
    confirmedAt: '2026-09-22T11:40:00Z',
    accountingReference: 'CAPEX-2026/NET/PIPE-07',
    note: 'Approved in the FY2026/27 capital budget (line PIPE-07); not yet committed.',
    sufficientForApproval: true,
  },
  comments: [
    {
      id: 1,
      author: {
        userId: 5,
        fullName: 'Tebogo Molefe',
        capacity: 'Procurement Officer',
      },
      kind: 'review',
      text: 'Scope and estimate reviewed against the engineer’s report; ready for decision.',
      createdAt: '2026-09-18T09:00:00Z',
    },
    {
      id: 2,
      author: {
        userId: 7,
        fullName: 'Onalenna Tau',
        capacity: 'Budget Owner, Operations',
      },
      kind: 'funding',
      text: 'Budget approved in the capital plan; commitment follows the award.',
      createdAt: '2026-09-22T11:40:00Z',
    },
    {
      id: 3,
      author: {
        userId: 4,
        fullName: 'Mpho Dikgang',
        capacity: 'Procurement Manager',
      },
      kind: 'decision',
      text: 'BWP 4,850,000 exceeds my BWP 2,000,000 request authority; routed to the Chief Executive.',
      createdAt: '2026-09-23T08:15:00Z',
    },
  ],
  conditions: null,
  approvedVersion: null,
  reapprovalRequired: false,
  materialChange: null,
  history: [
    {
      id: 4,
      decision: 'escalate',
      decidedBy: {
        userId: 4,
        fullName: 'Mpho Dikgang',
        capacity: 'Procurement Manager',
      },
      decidedAt: '2026-09-23T08:15:00Z',
      revision: 1,
      reason: 'BWP 4,850,000 exceeds my BWP 2,000,000 request authority.',
    },
  ],
  segregation: {
    rule: 'requester_vs_request_approval',
    callerIsRequester: false,
    blocked: false,
  },
  allowedActions: [
    'request_info',
    'assign',
    'combine',
    'split',
    'defer',
    'comment',
    'route_to_contract',
  ],
};
