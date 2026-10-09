/**
 * SUP-02 "Resolve missing evidence" on the organization profile: the operator's requests for identity evidence that
 * is missing or unclear, what is needed and by when, links to add each kind of evidence to the library, and the
 * answer with current library items (COM-02 confirmation). Identity verification stays separate from any buyer's
 * qualification (AC-07); nothing is shared with buyers by this answer. The answer is offered only to a member who
 * may both manage the profile and read the evidence library it is answered from (DD-49).
 */
import { useState } from 'react';

import type { FieldError } from '@contracts/common';
import type { EvidenceItemsEvidenceType } from '@contracts/enums';
import { RespondVerificationRequestBody, suppliersEndpoints } from '@contracts/suppliers';
import type { VerificationRequest } from '@contracts/suppliers';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DetailList,
  ErrorState,
  MultiSelect,
  SkeletonBlock,
  TextArea,
  useToast,
} from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { withSupplierMessage } from '../lib/errors';
import { useOfficialTimeZone } from '../lib/hooks';
import { textOrNull } from '../lib/lists';
import { supplierOrgPaths } from '../lib/paths';
import { EVIDENCE_MANAGE, EVIDENCE_READ, PROFILE_MANAGE } from '../lib/permissions';
import { errorLookup, validateWith } from '../lib/validation';

function typeList(types: readonly EvidenceItemsEvidenceType[]): string {
  return types.map((type) => tEnum('evidence_items.evidence_type', type)).join(', ');
}

export interface VerificationRequestsPanelProps {
  readonly requests: readonly VerificationRequest[];
}

export function VerificationRequestsPanel({ requests }: VerificationRequestsPanelProps) {
  const zone = useOfficialTimeZone();
  const canManageProfile = usePermission(PROFILE_MANAGE);
  const canReadLibrary = usePermission(EVIDENCE_READ);
  const canAnswer = canManageProfile && canReadLibrary;
  const canAddEvidence = usePermission(EVIDENCE_MANAGE);
  const [answered, setAnswered] = useState<Readonly<Record<number, VerificationRequest>>>({});
  const [answering, setAnswering] = useState<VerificationRequest | null>(null);
  const current = requests.map((request) => answered[request.id] ?? request);
  const open = current.filter((request) => request.status === 'open');
  const earlier = current.filter((request) => request.status !== 'open');

  return (
    <Card
      title={t('supplier-org.verification.panelTitle')}
      subtitle={t('supplier-org.verification.panelIntro')}
    >
      <div className="tiq-stack">
        {current.length === 0 && (
          <p className="tiq-text-muted">{t('supplier-org.verification.none')}</p>
        )}
        {open.map((request) => (
          <Banner
            key={request.id}
            tone="warning"
            title={t('supplier-org.verification.requestedBy', {
              by: request.requestedBy,
              at: formatDateTime(request.requestedAt, zone),
            })}
            actions={
              canAnswer ? (
                <Button
                  size="sm"
                  variant="primary"
                  icon="send"
                  onClick={() => setAnswering(request)}
                >
                  {t('supplier-org.verification.answer')}
                </Button>
              ) : undefined
            }
          >
            <DetailList
              stacked
              items={[
                {
                  key: 'reason',
                  label: t('supplier-org.verification.reason'),
                  value: request.reason,
                },
                {
                  key: 'needed',
                  label: t('supplier-org.verification.needed'),
                  value: (
                    <span className="tiq-inline">
                      {request.evidenceTypes.map((type) => (
                        <Chip key={type} tone="warning">
                          {tEnum('evidence_items.evidence_type', type)}
                        </Chip>
                      ))}
                    </span>
                  ),
                },
                {
                  key: 'due',
                  label: t('supplier-org.verification.dueLabel'),
                  value:
                    request.dueDate === null
                      ? t('supplier-org.verification.noDueDate')
                      : formatCalendarDate(request.dueDate),
                },
              ]}
            />
            {canAddEvidence && (
              <div className="tiq-inline">
                {request.evidenceTypes.map((type) => (
                  <ButtonLink
                    key={type}
                    size="sm"
                    icon="plus"
                    to={`${supplierOrgPaths.newEvidence}?type=${type}`}
                  >
                    {t('supplier-org.verification.addEvidence', {
                      type: tEnum('evidence_items.evidence_type', type).toLowerCase(),
                    })}
                  </ButtonLink>
                ))}
              </div>
            )}
          </Banner>
        ))}
        {earlier.length > 0 && (
          <div className="tiq-stack">
            <h3 className="tiq-form-section-title">
              {t('supplier-org.verification.historyTitle')}
            </h3>
            {earlier.map((request) => (
              <div key={request.id} className="tiq-stack">
                <span className="tiq-inline">
                  <Chip tone={request.status === 'answered' ? 'info' : 'success'}>
                    {t(`supplier-org.verification.status.${request.status}`)}
                  </Chip>
                  <span>{typeList(request.evidenceTypes)}</span>
                  <span className="tiq-text-muted">
                    {t('supplier-org.verification.requestedBy', {
                      by: request.requestedBy,
                      at: formatDateTime(request.requestedAt, zone),
                    })}
                  </span>
                </span>
                {request.response !== null && (
                  <span className="tiq-cell-sub">
                    {t('supplier-org.verification.answeredTitle', {
                      at: formatDateTime(request.response.respondedAt, zone),
                      name: request.response.respondedBy.fullName,
                    })}
                    {' · '}
                    {request.response.evidence.map((item) => item.title).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {answering !== null && (
        <AnswerDialog
          request={answering}
          onClose={() => setAnswering(null)}
          onDone={(result) => {
            setAnswered((currentMap) => ({ ...currentMap, [result.id]: result }));
            setAnswering(null);
          }}
        />
      )}
    </Card>
  );
}

function AnswerDialog({
  request,
  onClose,
  onDone,
}: {
  readonly request: VerificationRequest;
  readonly onClose: () => void;
  readonly onDone: (result: VerificationRequest) => void;
}) {
  const zone = useOfficialTimeZone();
  const toast = useToast();
  const library = useApiQuery(suppliersEndpoints.listEvidence, {
    query: { status: ['current'], pageSize: 100 },
  });
  const respond = useApiMutation(suppliersEndpoints.respondVerificationRequest);
  const [chosen, setChosen] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, respond.error, ['evidenceItemIds', 'note']);
  const items = library.data?.items ?? [];
  const chosenTypes = items
    .filter((item) => chosen.includes(String(item.id)))
    .map((item) => item.evidenceType);
  const missing = request.evidenceTypes.filter((type) => !chosenTypes.includes(type));

  return (
    <ConfirmActionDialog
      open
      title={t('supplier-org.verification.dialogTitle')}
      scope={t('supplier-org.verification.dialogScope', {
        at: formatDateTime(request.requestedAt, zone),
        types: typeList(request.evidenceTypes),
      })}
      consequence={t('supplier-org.verification.dialogResult')}
      confirmLabel={t('supplier-org.verification.answer')}
      pending={respond.pending}
      error={withSupplierMessage(respond.error)}
      onCancel={() => {
        respond.reset();
        onClose();
      }}
      onConfirm={async () => {
        const body = { evidenceItemIds: chosen.map(Number), note: textOrNull(note) };
        const found = validateWith(RespondVerificationRequestBody, body).concat(
          chosen.length > 0 && missing.length > 0
            ? [
                {
                  field: 'evidenceItemIds',
                  code: 'EVIDENCE_TYPES_NOT_COVERED',
                  message: t('supplier-org.verification.missingTypes', {
                    types: typeList(missing),
                  }),
                },
              ]
            : [],
        );
        setClientErrors(found);
        if (found.length > 0) return;
        try {
          const result = await respond.mutate({ params: { requestId: request.id }, body });
          toast.show(t('supplier-org.verification.sent'), 'success');
          onDone(result);
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      {library.data === undefined ? (
        library.error !== null ? (
          <ErrorState
            title={t('supplier-org.verification.loadEvidenceFailed')}
            error={library.error}
            onRetry={library.reload}
          />
        ) : (
          <SkeletonBlock lines={3} />
        )
      ) : items.length === 0 ? (
        <Banner tone="warning" title={t('supplier-org.verification.noCurrentEvidence')} />
      ) : (
        <div className="tiq-stack">
          <MultiSelect
            label={t('supplier-org.verification.chooseEvidence')}
            hint={t('supplier-org.verification.chooseEvidenceHint')}
            required
            value={chosen}
            onChange={setChosen}
            options={items.map((item) => ({
              value: String(item.id),
              label: `${item.title} (${tEnum('evidence_items.evidence_type', item.evidenceType)})`,
            }))}
            error={errors.forField('evidenceItemIds')}
          />
          {chosen.length > 0 && missing.length > 0 && (
            <p className="tiq-text-muted">
              {t('supplier-org.verification.missingTypes', { types: typeList(missing) })}
            </p>
          )}
          <TextArea
            label={t('supplier-org.verification.note')}
            value={note}
            onChange={setNote}
            error={errors.forField('note')}
          />
        </div>
      )}
    </ConfirmActionDialog>
  );
}
