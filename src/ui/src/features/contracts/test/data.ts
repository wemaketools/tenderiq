/**
 * Contract-valid test data for the contracts pages (test data only; the application's data comes from the API).
 */
import type {
  AwardSourcesResponse,
  ChangeRequestDetail,
  ContractApprovalRef,
  ContractChanges,
  ContractCloseout,
  ContractDetail,
  ContractFinancials,
  ContractHandover,
  ContractListResponse,
  ContractPerformance,
  ContractPreparation,
  ContractRenewals,
  ContractRow,
  ContractSignature,
  ObligationDetail,
  ObligationRow,
  SupplierContractDetail,
  SupplierContractRow,
} from '@contracts/contracts';

const TZ = 'Africa/Gaborone';
const bwp = (amount: string) => ({ amount, currency: 'BWP' });
const person = (userId: number, fullName: string) => ({ userId, fullName });

export const MASEGO = person(19, 'Masego Rakgosi');
export const KEABETSWE = person(18, 'Keabetswe Nkwe');
export const MPHO = person(4, 'Mpho Dikgang');

export function approval(overrides: Partial<ContractApprovalRef> = {}): ContractApprovalRef {
  return {
    approvalId: 42,
    subjectType: 'contract_difference',
    status: 'pending',
    title: 'Review differences between the Lot 1 award and C-2026-0002',
    amount: bwp('4668000.00'),
    requestedBy: MASEGO,
    requestedAt: '2026-10-01T08:10:00Z',
    currentApprover: KEABETSWE,
    decidedAt: null,
    inApprovalWorkspace: true,
    ...overrides,
  };
}

export function contractRow(overrides: Partial<ContractRow> = {}): ContractRow {
  return {
    id: 1,
    reference: 'C-2026-0001',
    title: 'Fleet vehicle maintenance',
    status: 'active',
    supplier: { tenantId: 4, name: 'Tsodilo Engineering', slug: 'tsodilo' },
    legalEntity: {
      legalEntityId: 1,
      name: 'Kalahari Water Utilities Corporation',
      registrationNumber: 'BW-PE-2004-0117',
    },
    tender: { tenderId: 10, reference: 'T-2026-0010', title: 'Fleet vehicle maintenance' },
    owner: person(5, 'Tebogo Molefe'),
    contractManager: MASEGO,
    scopeSummary: 'Servicing and repairs for 86 fleet vehicles',
    value: bwp('1850000.00'),
    currentValue: bwp('1995000.00'),
    ceiling: bwp('2250000.00'),
    remainingCeiling: bwp('255000.00'),
    termStart: '2026-04-01',
    termEnd: '2027-03-31',
    nextRenewalDeadline: { at: '2026-12-31T15:00:00Z', timeZone: TZ },
    nextRenewalWindow: { windowStart: '2026-10-05', state: 'not_open', daysUntilOpens: 5 },
    nextDecision: {
      kind: 'renewal_notice',
      dueAt: { at: '2026-12-31T15:00:00Z', timeZone: TZ },
      detail: 'The renewal notice window opens in 5 days; no decision is recorded.',
    },
    differsFromAward: false,
    handoverStatus: 'accepted',
    overdueObligations: 1,
    origin: null,
    ...overrides,
  };
}

export function listResponse(items: ContractRow[] = [contractRow()]): ContractListResponse {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 25,
    summary: {
      byStatus: [{ status: 'active', count: 1 }],
      upcomingDecisions: 6,
      renewalsWithin90Days: 1,
      overdueObligations: 3,
      currentValueByCurrency: [bwp('8700000.00')],
    },
  };
}

export function contractDetail(overrides: Partial<ContractDetail> = {}): ContractDetail {
  return {
    ...contractRow(),
    timeZone: TZ,
    recommendationId: 5,
    scope: 'Scheduled servicing, repairs and roadworthiness preparation for the KWU fleet.',
    optionsSummary: 'One 12-month renewal option.',
    serviceLocations: 'Gaborone central depot',
    paymentTerms: 'Quarterly payment milestones on accepted service reports.',
    securitiesSummary: 'Performance bond of 10%.',
    signedAt: '2026-03-20T09:30:00Z',
    effectiveDate: '2026-04-01',
    noticeToProceedAt: '2026-03-27T08:00:00Z',
    deliveryStartAt: '2026-04-01T06:00:00Z',
    signedOutsideApp: false,
    externalSignatureEvidence: null,
    signedDocument: null,
    differenceExplanation: null,
    differenceApproval: null,
    allocations: [
      {
        id: 1,
        lotOutcomeId: 14021,
        tenderReference: 'T-2026-0010',
        lotNumber: 1,
        lotTitle: 'Fleet vehicle maintenance services',
        awardedValue: bwp('1850000.00'),
        allocatedValue: bwp('1850000.00'),
        allocatedElsewhere: bwp('0.00'),
        unallocated: bwp('0.00'),
      },
    ],
    milestones: [
      { key: 'signed', state: 'done', at: '2026-03-20T09:30:00Z', date: null, detail: null },
      { key: 'effective', state: 'done', at: null, date: '2026-04-01', detail: null },
      {
        key: 'notice_to_proceed',
        state: 'done',
        at: '2026-03-27T08:00:00Z',
        date: null,
        detail: null,
      },
      {
        key: 'delivery_start',
        state: 'done',
        at: '2026-04-01T06:00:00Z',
        date: null,
        detail: null,
      },
      {
        key: 'handover_accepted',
        state: 'done',
        at: '2026-03-25T10:00:00Z',
        date: null,
        detail: null,
      },
    ],
    contacts: [
      {
        party: 'buyer',
        name: 'Masego Rakgosi',
        role: 'Contract manager',
        email: 'masego.contracts@tenderiq.local',
        phone: null,
      },
    ],
    securities: [
      {
        id: 3,
        securityType: 'performance_bond',
        issuer: 'First National Bank Botswana',
        amount: bwp('185000.00'),
        expiresAt: '2027-06-30T21:59:00Z',
        status: 'active',
        releasedAt: null,
        releaseApproval: null,
        evidence: { evidenceItemId: 9, title: 'Performance bond FNBB-PB-2026-0331' },
      },
    ],
    holds: [],
    obligationCounts: {
      total: 11,
      open: 9,
      overdue: 1,
      rejected: 1,
      awaitingReview: 2,
      surviving: 1,
    },
    originalBusinessDate: null,
    createdAt: '2026-03-01T08:00:00Z',
    ...overrides,
  };
}

export function obligationRow(overrides: Partial<ObligationRow> = {}): ObligationRow {
  return {
    id: 14702,
    contractId: 1,
    kind: 'milestone',
    party: 'supplier',
    title: 'Q3 service report (July to September)',
    owner: MASEGO,
    supplierContact: 'Boago Moremi',
    dueAt: { at: '2026-09-15T15:00:00Z', timeZone: TZ },
    recurrence: null,
    status: 'rejected',
    isPaymentMilestone: true,
    amount: bwp('120000.00'),
    survivesCloseout: false,
    isOverdue: false,
    evidenceCount: 1,
    latestDecision: { decision: 'rejected', decidedAt: '2026-09-22T10:00:00Z' },
    ...overrides,
  };
}

export function obligationList(items: ObligationRow[] = [obligationRow()]) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 25,
    counts: { total: 11, open: 9, overdue: 1, rejected: 1, awaitingReview: 2, surviving: 1 },
  };
}

export function obligationDetail(overrides: Partial<ObligationDetail> = {}): ObligationDetail {
  return {
    ...obligationRow(),
    description: 'Quarterly service report with availability figures.',
    acceptanceCriteria: 'Availability above 95% with evidence per vehicle.',
    evidenceRequired: 'Signed service report',
    consequence: 'Payment milestone withheld until accepted.',
    dependsOn: null,
    escalationUser: MPHO,
    waiverApproval: null,
    evidence: [
      {
        id: 1,
        submittedBy: { userId: 25, fullName: 'Boago Moremi', capacity: 'Bid Manager' },
        organizationName: 'Tsodilo Engineering',
        document: {
          documentId: 301,
          versionId: 401,
          title: 'Q3 report',
          fileName: 'q3-report.pdf',
        },
        note: 'Q3 report attached.',
        submittedAt: '2026-09-16T08:00:00Z',
      },
    ],
    decisions: [
      {
        id: 1,
        decision: 'rejected',
        reasons: 'Availability figures missing for 14 vehicles.',
        remediationRequired: 'Resubmit with complete availability figures.',
        remediationOwner: MASEGO,
        remediationDueAt: { at: '2026-10-06T15:00:00Z', timeZone: TZ },
        decidedBy: MASEGO,
        decidedAt: '2026-09-22T10:00:00Z',
      },
    ],
    payment: {
      invoiceRef: 'TSO-INV-0931',
      acceptanceStatus: 'not_accepted',
      paymentStatus: 'invoiced',
      source: 'finance_system',
      asOf: '2026-09-29T06:00:00Z',
    },
    ...overrides,
  };
}

export function preparation(overrides: Partial<ContractPreparation> = {}): ContractPreparation {
  return {
    contractId: 2,
    reference: 'C-2026-0002',
    status: 'awaiting_signature',
    version: 2,
    awardedScope: contractDetail().allocations,
    agreedDocuments: [
      {
        id: 1,
        precedence: 1,
        title: 'Contract agreement',
        kind: 'Agreement',
        document: {
          documentId: 1,
          versionId: 2,
          title: 'Agreement',
          fileName: 'C-2026-0002-v2.pdf',
        },
        isSigned: false,
      },
    ],
    exceptions: [
      { id: 1, clause: 'Clause 14', description: 'Cap of 5%', agreedPosition: 'Cap at 7.5%' },
    ],
    differences: [
      {
        field: 'value',
        label: 'Contract value',
        awarded: 'BWP 4,620,000.00',
        proposed: 'BWP 4,685,000.00',
        amountDelta: bwp('65000.00'),
        material: true,
      },
    ],
    differsFromAward: true,
    differenceExplanation: 'The awarded motor is out of stock until 2027.',
    differenceApproval: approval(),
    approvalHistory: [approval()],
    checks: [
      {
        id: 'difference',
        label: 'Differences from the award explained and approved (AC-28)',
        detail: 'Difference approval pending, with Keabetswe Nkwe.',
        state: 'blocking',
      },
    ],
    ...overrides,
  };
}

export function signature(overrides: Partial<ContractSignature> = {}): ContractSignature {
  return {
    contractId: 2,
    reference: 'C-2026-0002',
    status: 'awaiting_signature',
    timeZone: TZ,
    contractValue: bwp('4685000.00'),
    issuedVersion: {
      documentId: 1,
      versionId: 2,
      title: 'Agreement',
      fileName: 'C-2026-0002-v2.pdf',
    },
    issuedAt: '2026-09-24T10:00:00Z',
    signedOutsideApp: false,
    externalSignatureEvidence: null,
    signatories: [
      {
        id: 7,
        party: 'buyer',
        user: KEABETSWE,
        name: 'Keabetswe Nkwe',
        organizationName: 'Kalahari Water Utilities (Pilot)',
        authorityNote: 'Chief Executive',
        authorityLimit: bwp('10000000.00'),
        authoritySufficient: true,
        status: 'pending',
        method: null,
        signedAt: null,
        verificationNote: null,
        refusalReason: null,
      },
    ],
    signedAt: null,
    effectiveDate: null,
    noticeToProceedAt: null,
    deliveryStartAt: null,
    differsFromAward: true,
    differenceApproval: approval(),
    signatureChecks: [
      {
        id: 'difference',
        label: 'Differences from the award approved (AC-28)',
        detail: null,
        state: 'blocking',
      },
    ],
    commencementChecks: [
      { id: 'signatures', label: 'All signatures complete', detail: null, state: 'blocking' },
    ],
    milestones: contractDetail().milestones.map((item) => ({
      ...item,
      state: 'pending' as const,
      at: null,
      date: null,
    })),
    ...overrides,
  };
}

export function handover(overrides: Partial<ContractHandover> = {}): ContractHandover {
  return {
    contractId: 8,
    reference: 'C-2026-0004',
    handoverId: 3,
    status: 'submitted',
    tender: { tenderId: 1, reference: 'T-2026-0001', title: 'Borehole pumps' },
    supplier: { tenantId: 4, name: 'Tsodilo Engineering', slug: 'tsodilo' },
    finalScope: 'Lot 1 strategic spares',
    winningCommitments: 'Delivery within 6 weeks',
    negotiatedExceptions: null,
    performanceMeasuresSummary: 'Fill rate 98%',
    risks: 'Import lead times',
    outstandingConditions: null,
    renewalDatesSummary: null,
    securityExpirySummary: null,
    keyContacts: [],
    pricing: [
      {
        id: 1,
        item: 'Spare impeller',
        unit: 'each',
        quantity: '12.0000',
        rate: bwp('5000.00'),
        total: bwp('60000.00'),
      },
    ],
    milestones: [],
    obligationsCount: 2,
    awardEvidence: [],
    contractManager: MASEGO,
    submittedBy: person(5, 'Tebogo Molefe'),
    submittedAt: '2026-09-25T09:00:00Z',
    acceptedAt: null,
    returnedAt: null,
    omissions: null,
    closeoutGate: {
      tenderReference: 'T-2026-0001',
      blocksEventCloseout: true,
      detail: 'Event closeout of T-2026-0001 stays blocked until the handover is accepted (AC-29).',
    },
    excludesLosingBids: true,
    checks: [{ id: 'scope', label: 'Final scope', detail: null, state: 'passed' }],
    ...overrides,
  };
}

export function performance(overrides: Partial<ContractPerformance> = {}): ContractPerformance {
  return {
    contractId: 1,
    reference: 'C-2026-0001',
    status: 'active',
    measures: [
      {
        id: 1,
        name: 'Fleet availability',
        target: '95',
        unit: '%',
        frequency: 'Monthly',
        active: true,
        latestActual: '93.1',
        latestRating: 'Below target',
      },
    ],
    reviews: [
      {
        id: 11,
        contractId: 1,
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30',
        status: 'supplier_responded',
        overallRating: 'partially_meets',
        summary: 'Availability below target in May.',
        supplierResponse: 'The May figures include vehicles held for parts.',
        supplierDisputes: true,
        sharedAt: '2026-07-10T08:00:00Z',
        respondedAt: '2026-07-17T08:00:00Z',
        finalizedBy: null,
        finalizedAt: null,
      },
    ],
    incidents: [
      {
        id: 1,
        incidentType: 'complaint',
        severity: 'medium',
        description: 'Late return of a tipper truck.',
        occurredAt: '2026-08-12T08:00:00Z',
        status: 'open',
        correctiveAction: null,
        owner: MASEGO,
      },
    ],
    improvementActions: [
      {
        id: 1,
        reviewId: 11,
        action: 'Parts buffer stock',
        owner: 'Tsodilo workshop',
        dueAt: null,
        status: 'open',
      },
    ],
    scorecard: {
      reviewsFinalized: 1,
      reviewsDisputed: 1,
      latestRating: 'meets',
      latestProposedRating: null,
      openIncidents: 1,
      openActions: 1,
    },
    ...overrides,
  };
}

const figure = (amount: string, source: string, isEstimate = false) => ({
  amount: bwp(amount),
  source,
  sourceSystem: null,
  asOf: '2026-09-29T06:00:00Z',
  isEstimate,
});

export function financials(overrides: Partial<ContractFinancials> = {}): ContractFinancials {
  return {
    contractId: 1,
    reference: 'C-2026-0001',
    currency: 'BWP',
    awardValue: figure('1850000.00', 'Award record'),
    originalValue: figure('1850000.00', 'Contract record'),
    approvedChanges: figure('145000.00', 'Change register'),
    pendingChanges: figure('120000.00', 'Change register', true),
    currentValue: figure('1995000.00', 'Contract record'),
    ceiling: figure('2250000.00', 'Contract record'),
    remainingCeiling: figure('255000.00', 'Contract record'),
    acceptedMilestones: figure('120000.00', 'Acceptance decisions'),
    invoiced: figure('240000.00', 'Invoices'),
    approvedForPayment: figure('120000.00', 'Invoices'),
    paid: figure('120000.00', 'Invoices'),
    disputed: figure('0.00', 'Invoices'),
    invoices: [
      {
        id: 1,
        invoiceRef: 'TSO-INV-0931',
        obligation: { obligationId: 14702, title: 'Q3 service report', status: 'rejected' },
        amount: bwp('120000.00'),
        invoiceDate: '2026-09-16',
        acceptanceStatus: 'not_accepted',
        paymentStatus: 'invoiced',
        source: 'finance_system',
        asOf: '2026-09-29T06:00:00Z',
        disputeReason: null,
      },
    ],
    reconciliation: {
      acceptedNotInvoiced: bwp('0.00'),
      invoicedNotAccepted: bwp('120000.00'),
      disputedInvoices: 0,
    },
    notes: ['The Q3 invoice is not accepted because its milestone was rejected.'],
    ...overrides,
  };
}

const authority = {
  decisionType: 'change_approval' as const,
  basis: 'cumulative_value' as const,
  originalValue: bwp('1850000.00'),
  singleChangeAmount: bwp('120000.00'),
  cumulativeChanges: bwp('265000.00'),
  cumulativeChangePercent: '14.32',
  checkedAmount: bwp('2115000.00'),
  checkedApprover: MPHO,
  checkedLimit: bwp('2000000.00'),
  sufficient: false,
  requiredApprover: KEABETSWE,
  explanation: 'The cumulative contract value after the change is BWP 2,115,000.00.',
};

export function changeDetail(overrides: Partial<ChangeRequestDetail> = {}): ChangeRequestDetail {
  return {
    id: 3,
    contractId: 1,
    number: 3,
    displayNumber: 'CR-0003',
    title: 'Parts allowance for vehicles above 200,000 km',
    raisedByParty: 'supplier',
    raisedBy: person(27, 'Motsamai Tsodilo'),
    status: 'approval_pending',
    costImpact: bwp('120000.00'),
    scheduleImpactDays: 0,
    cumulativeValueAfter: bwp('2115000.00'),
    affectsProcurementBasis: false,
    supplierAgreedAt: '2026-09-19T10:00:00Z',
    approval: approval({
      subjectType: 'contract_change',
      title: 'CR-0003',
      amount: bwp('2115000.00'),
    }),
    createdAt: '2026-09-15T08:00:00Z',
    reason: 'High-mileage vehicles need more parts.',
    scopeChange: 'Parts allowance',
    fundingNote: 'Operations budget',
    impactAssessment: 'Within the ceiling.',
    authority,
    ...overrides,
  };
}

export function changes(overrides: Partial<ContractChanges> = {}): ContractChanges {
  const {
    reason: _reason,
    scopeChange: _scope,
    fundingNote: _funding,
    impactAssessment: _impact,
    authority: _authority,
    ...row
  } = changeDetail();
  return {
    contractId: 1,
    reference: 'C-2026-0001',
    originalValue: bwp('1850000.00'),
    currentValue: bwp('1995000.00'),
    ceiling: bwp('2250000.00'),
    approvedChanges: bwp('145000.00'),
    pendingChanges: bwp('120000.00'),
    cumulativeExposure: bwp('2115000.00'),
    items: [row],
    pendingAuthority: authority,
    ...overrides,
  };
}

export function disputes() {
  return {
    contractId: 1,
    reference: 'C-2026-0001',
    items: [
      {
        id: 1,
        contractId: 1,
        disputeType: 'credit' as const,
        amount: bwp('9250.00'),
        description: 'Service credit proposed for June.',
        contractBasis: 'Schedule 4, paragraph 2.1.',
        status: 'open' as const,
        raisedBy: { userId: 19, fullName: 'Masego Rakgosi', capacity: 'Contract Manager' },
        raisedByOrganization: 'Kalahari Water Utilities (Pilot)',
        raisedAt: '2026-08-10T09:00:00Z',
        authorizedDecision: null,
        resolutionNote: null,
      },
    ],
    remedyRule: 'A missed measure never authorizes a deduction by itself.',
  };
}

export function renewals(overrides: Partial<ContractRenewals> = {}): ContractRenewals {
  return {
    contractId: 1,
    reference: 'C-2026-0001',
    status: 'active',
    termEnd: '2027-03-31',
    currentValue: bwp('1995000.00'),
    remainingCeiling: bwp('255000.00'),
    performance: {
      latestRating: 'partially_meets',
      latestProposedRating: null,
      reviewsDisputed: 1,
      openIncidents: 1,
      rejectedMilestones: 1,
    },
    fundingNote: 'Operations budget 2026/27',
    transitionNeeds: 'A 60-day transition if not renewed.',
    alertRecipients: [person(5, 'Tebogo Molefe'), MASEGO],
    options: [
      {
        id: 21,
        optionType: 'renewal',
        periodMonths: 12,
        noticeWindowStart: '2026-10-05',
        noticeDeadline: { at: '2026-12-31T15:00:00Z', timeZone: TZ },
        windowState: 'open',
        daysUntilWindowOpens: -1,
        status: 'available',
        decision: null,
        justification: null,
        performanceBasis: null,
        fundingConfirmed: null,
        approval: null,
        supplierConsentAt: null,
        decidedBy: null,
        decidedAt: null,
        supplierNotifiedAt: null,
      },
    ],
    noAutomaticRenewal: true,
    ...overrides,
  };
}

export function closeout(overrides: Partial<ContractCloseout> = {}): ContractCloseout {
  return {
    contractId: 4,
    reference: 'C-2025-0007',
    contractStatus: 'expired',
    closeoutId: 2,
    status: 'in_progress',
    finalAcceptanceAt: null,
    reconciliationNote: null,
    outstandingClaims: null,
    securitiesReleased: false,
    warrantyUntil: '2027-06-30',
    lessonsLearned: null,
    retentionStart: null,
    closedBy: null,
    closedAt: null,
    reconciliation: {
      finalValue: bwp('640000.00'),
      invoiced: bwp('600000.00'),
      paid: bwp('600000.00'),
      invoicedUnpaid: bwp('0.00'),
      disputed: bwp('0.00'),
      notYetInvoiced: bwp('40000.00'),
    },
    survivingObligations: [
      obligationRow({
        id: 50,
        contractId: 4,
        kind: 'obligation',
        title: 'Meter warranty (12 months)',
        status: 'planned',
        survivesCloseout: true,
        isPaymentMilestone: false,
        amount: null,
        latestDecision: null,
      }),
    ],
    securities: [],
    openDisputes: [],
    checks: [{ id: 'final', label: 'Final acceptance recorded', detail: null, state: 'blocking' }],
    canClose: false,
    ...overrides,
  };
}

export function assignees() {
  return {
    items: [
      {
        userId: 19,
        fullName: 'Masego Rakgosi',
        capacity: 'Contract Manager',
        canManage: true,
        canSign: false,
        canApproveChanges: false,
        authorityLimit: null,
      },
      {
        userId: 5,
        fullName: 'Tebogo Molefe',
        capacity: 'Procurement Officer',
        canManage: false,
        canSign: false,
        canApproveChanges: false,
        authorityLimit: null,
      },
    ],
  };
}

export function awardSources(): AwardSourcesResponse {
  return {
    lotOutcomes: [
      {
        lotOutcomeId: 14011,
        tender: { tenderId: 1, reference: 'T-2026-0001', title: 'Borehole pumps' },
        lotNumber: 1,
        lotTitle: 'Submersible borehole pumps',
        supplier: { tenantId: 4, name: 'Tsodilo Engineering', slug: 'tsodilo' },
        outcome: 'award',
        status: 'final_awarded',
        awardedValue: bwp('5340000.00'),
        allocatedValue: bwp('5280000.00'),
        remainingValue: bwp('60000.00'),
        contracts: [{ contractId: 2, reference: 'C-2026-0002', allocatedValue: bwp('4620000.00') }],
        finalAwardedAt: '2026-09-01T10:00:00Z',
        conditions: null,
        availableForContract: true,
        unavailableReason: null,
      },
    ],
    legalEntities: [
      {
        legalEntityId: 1,
        name: 'Kalahari Water Utilities Corporation',
        registrationNumber: 'BW-PE-2004-0117',
      },
    ],
  };
}

export function supplierRow(overrides: Partial<SupplierContractRow> = {}): SupplierContractRow {
  return {
    id: 2,
    reference: 'C-2026-0002',
    title: 'Borehole pumps Lot 1: supply and installation',
    status: 'awaiting_signature',
    buyer: { tenantId: 2, name: 'Kalahari Water Utilities (Pilot)' },
    legalEntity: contractRow().legalEntity,
    tender: { tenderId: 1, reference: 'T-2026-0001', title: 'Borehole pumps' },
    value: bwp('4685000.00'),
    currentValue: bwp('4685000.00'),
    termStart: '2026-11-01',
    termEnd: '2027-10-31',
    mySignatureStatus: 'pending',
    openObligations: 2,
    overdueObligations: 0,
    pendingChangeRequests: 0,
    nextDueAt: { at: '2026-10-25T15:00:00Z', timeZone: TZ },
    ...overrides,
  };
}

export function supplierDetail(
  overrides: Partial<SupplierContractDetail> = {},
): SupplierContractDetail {
  return {
    ...supplierRow(),
    timeZone: TZ,
    scope: 'Supply and install 12 borehole pumps.',
    paymentTerms: '60% on delivery acceptance.',
    serviceLocations: 'Serowe',
    signedAt: null,
    effectiveDate: null,
    noticeToProceedAt: null,
    deliveryStartAt: null,
    signedOutsideApp: false,
    signatureBlockedReason: null,
    signatories: [
      {
        id: 8,
        party: 'supplier',
        name: 'Motsamai Tsodilo',
        organizationName: 'Tsodilo Engineering',
        isMe: true,
        status: 'pending',
        method: null,
        signedAt: null,
      },
    ],
    obligations: [
      {
        id: 60,
        kind: 'milestone',
        party: 'supplier',
        title: 'Delivery of pumps',
        dueAt: { at: '2026-12-15T15:00:00Z', timeZone: TZ },
        status: 'planned',
        isPaymentMilestone: true,
        amount: bwp('2811000.00'),
        survivesCloseout: false,
        isOverdue: false,
        latestDecision: null,
      },
    ],
    changeRequests: [
      {
        id: 3,
        number: 3,
        displayNumber: 'CR-0003',
        title: 'Parts allowance',
        reason: 'High mileage',
        raisedByParty: 'buyer',
        status: 'approval_pending',
        costImpact: bwp('120000.00'),
        scheduleImpactDays: 0,
        supplierAgreedAt: null,
        createdAt: '2026-09-15T08:00:00Z',
      },
    ],
    reviews: [
      {
        id: 11,
        contractId: 2,
        periodStart: '2026-04-01',
        periodEnd: '2026-06-30',
        status: 'shared_with_supplier',
        overallRating: 'partially_meets',
        summary: 'Availability below target.',
        supplierResponse: null,
        supplierDisputes: false,
        sharedAt: '2026-07-10T08:00:00Z',
        respondedAt: null,
        finalizedAt: null,
        results: [],
      },
    ],
    incidents: [],
    improvementActions: [],
    invoices: [],
    securities: [],
    disputes: [],
    contacts: [],
    ...overrides,
  };
}
