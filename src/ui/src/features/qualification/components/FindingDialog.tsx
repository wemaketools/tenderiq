/**
 * BUY-34 "Assess": the finding on one criterion with its rationale. Missing mandatory evidence is never a pass, and
 * "not applicable" is accepted only where the supplier declared it (with a reason).
 */
import { useState } from 'react';

import { RecordFindingBody, qualificationEndpoints as api } from '@contracts/qualification';
import type { AssessmentItem, Finding } from '@contracts/qualification';
import { QUALIFICATION_FINDINGS_FINDING } from '@contracts/enums';
import type { QualificationFindingsFinding } from '@contracts/enums';

import { useApiMutation } from '../../../api/hooks';
import {
  Banner,
  Button,
  Dialog,
  FormErrorSummary,
  RadioGroup,
  TextArea,
  UnsavedChangesGuard,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { summaryTitle } from '../lib/errors';
import { runCommand } from '../lib/hooks';
import { errorLookup, validateWith } from '../lib/validation';

export interface FindingDialogProps {
  readonly applicationId: number;
  readonly item: AssessmentItem;
  readonly onClose: () => void;
  readonly onRecorded: (finding: Finding) => void;
}

const FIELDS = ['finding', 'rationale', 'evidenceRefs'];

export function FindingDialog({ applicationId, item, onClose, onRecorded }: FindingDialogProps) {
  const record = useApiMutation(api.recordFinding);
  const [finding, setFinding] = useState<QualificationFindingsFinding | ''>(
    item.finding?.finding ?? '',
  );
  const [rationale, setRationale] = useState(item.finding?.rationale ?? '');
  const [evidenceRefs, setEvidenceRefs] = useState(item.finding?.evidenceRefs ?? '');
  const [tried, setTried] = useState(false);

  const naDeclared = item.answer?.applicability === 'not_applicable';
  const missingPass = item.evidenceMissing && finding === 'meets';
  const naUndeclared = finding === 'not_applicable' && !naDeclared;
  const body = {
    finding: finding === '' ? undefined : finding,
    rationale,
    evidenceRefs: evidenceRefs.trim() === '' ? null : evidenceRefs.trim(),
  };
  const clientErrors = tried
    ? [
        ...validateWith(RecordFindingBody, body),
        ...(missingPass
          ? [
              {
                field: 'finding',
                code: 'MISSING_EVIDENCE_NOT_A_PASS',
                message: t('qualification.errors.MISSING_EVIDENCE_NOT_A_PASS'),
              },
            ]
          : []),
        ...(naUndeclared
          ? [
              {
                field: 'finding',
                code: 'NA_NOT_DECLARED',
                message: t('qualification.errors.NA_NOT_DECLARED'),
              },
            ]
          : []),
      ]
    : [];
  const errors = errorLookup(clientErrors, record.error, FIELDS);
  const dirty =
    finding !== (item.finding?.finding ?? '') ||
    rationale !== (item.finding?.rationale ?? '') ||
    evidenceRefs !== (item.finding?.evidenceRefs ?? '');

  const submit = (): void => {
    setTried(true);
    const parsed = RecordFindingBody.safeParse(body);
    if (!parsed.success || missingPass || naUndeclared) return;
    void runCommand(
      () =>
        record.mutate({
          params: { applicationId, criterionId: item.criterion.id },
          body: parsed.data,
        }),
      onRecorded,
    );
  };

  return (
    <Dialog
      open
      size="lg"
      title={t('qualification.finding.title')}
      description={`${tEnum('qualification_criteria.area', item.criterion.area)} — ${item.criterion.question}`}
      onClose={onClose}
      dismissible={!record.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={record.pending}>
            {t('qualification.common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} loading={record.pending}>
            {t('qualification.finding.save')}
          </Button>
        </>
      }
    >
      <UnsavedChangesGuard when={dirty && !record.pending} />
      {item.criterion.thresholdDescription !== null && (
        <Banner tone="info" title={t('qualification.finding.threshold')}>
          {item.criterion.thresholdDescription}
        </Banner>
      )}
      {item.evidenceMissing && (
        <Banner tone="warning" title={t('qualification.finding.evidenceMissingTitle')}>
          {t('qualification.finding.evidenceMissing')}
        </Banner>
      )}
      <FormErrorSummary title={summaryTitle(record.error)} errors={errors.other} />
      <div className="tiq-form-stack">
        <RadioGroup
          label={t('qualification.finding.finding')}
          required
          value={finding}
          onChange={(value) => setFinding(value as QualificationFindingsFinding)}
          error={errors.forField('finding')}
          options={QUALIFICATION_FINDINGS_FINDING.map((value) => ({
            value,
            label: tEnum('qualification_findings.finding', value),
            disabled:
              (value === 'meets' && item.evidenceMissing) ||
              (value === 'not_applicable' && !naDeclared),
          }))}
        />
        <TextArea
          label={t('qualification.finding.rationale')}
          hint={t('qualification.finding.rationaleHint')}
          required
          rows={4}
          value={rationale}
          onChange={setRationale}
          error={errors.forField('rationale')}
        />
        <TextArea
          label={t('qualification.finding.evidenceRefs')}
          hint={t('qualification.finding.evidenceRefsHint')}
          rows={2}
          value={evidenceRefs}
          onChange={setEvidenceRefs}
          error={errors.forField('evidenceRefs')}
        />
      </div>
    </Dialog>
  );
}
