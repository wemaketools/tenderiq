/**
 * BUY-33 "Assign and prioritize reviews": the assessor, the specialist financial reviewer (AC-08), the due date in
 * the official time zone, the priority and the risk level of one application.
 */
import { useState } from 'react';

import { AssignApplicationBody, qualificationEndpoints as api } from '@contracts/qualification';
import type { BuyerApplicationRow, QualificationOptions } from '@contracts/qualification';
import { QUALIFICATION_APPLICATIONS_RISK_LEVEL, TASKS_PRIORITY } from '@contracts/enums';
import type { QualificationApplicationsRiskLevel, TasksPriority } from '@contracts/enums';

import { useApiMutation } from '../../../api/hooks';
import { Button, DateTimeInput, Dialog, FormErrorSummary, Select } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { summaryTitle } from '../lib/errors';
import { runCommand, useOfficialTimeZone } from '../lib/hooks';
import { errorLookup, validateWith } from '../lib/validation';

export interface AssignDialogProps {
  readonly application: BuyerApplicationRow;
  readonly options: QualificationOptions | undefined;
  readonly onClose: () => void;
  readonly onAssigned: (row: BuyerApplicationRow) => void;
}

const FIELDS = ['assessorUserId', 'financialReviewerUserId', 'dueAt', 'priority', 'riskLevel'];

export function AssignDialog({ application, options, onClose, onAssigned }: AssignDialogProps) {
  const assign = useApiMutation(api.assignApplication);
  const officialTimeZone = useOfficialTimeZone();
  const [assessor, setAssessor] = useState(
    application.assessor === null ? '' : String(application.assessor.userId),
  );
  const [reviewer, setReviewer] = useState(
    application.financialReviewer === null ? '' : String(application.financialReviewer.userId),
  );
  const [dueAt, setDueAt] = useState<string | null>(application.dueAt?.at ?? null);
  const [priority, setPriority] = useState<TasksPriority>(application.priority);
  const [risk, setRisk] = useState<QualificationApplicationsRiskLevel>(
    application.riskLevel ?? 'medium',
  );
  const [tried, setTried] = useState(false);

  const body = {
    assessorUserId: assessor === '' ? undefined : Number(assessor),
    financialReviewerUserId: reviewer === '' ? null : Number(reviewer),
    dueAt: dueAt ?? undefined,
    priority,
    riskLevel: risk,
  };
  const clientErrors = tried ? validateWith(AssignApplicationBody, body) : [];
  const errors = errorLookup(clientErrors, assign.error, FIELDS);
  const timeZone = options?.officialTimeZone ?? application.dueAt?.timeZone ?? officialTimeZone;

  const submit = (): void => {
    setTried(true);
    const parsed = AssignApplicationBody.safeParse(body);
    if (!parsed.success) return;
    void runCommand(
      () => assign.mutate({ params: { applicationId: application.id }, body: parsed.data }),
      onAssigned,
    );
  };

  return (
    <Dialog
      open
      title={t('qualification.assign.title', { reference: application.reference })}
      description={t('qualification.assign.description', { supplier: application.supplier.name })}
      onClose={onClose}
      dismissible={!assign.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={assign.pending}>
            {t('qualification.common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} loading={assign.pending}>
            {t('qualification.assign.confirm')}
          </Button>
        </>
      }
    >
      <FormErrorSummary title={summaryTitle(assign.error)} errors={errors.other} />
      <div className="tiq-form-grid">
        <Select
          label={t('qualification.assign.assessor')}
          required
          placeholder={t('qualification.common.select')}
          value={assessor}
          onChange={setAssessor}
          error={errors.forField('assessorUserId')}
          options={(options?.assessors ?? []).map((person) => ({
            value: String(person.userId),
            label: t('qualification.assign.personOption', {
              name: person.fullName,
              count: person.openAssignments,
            }),
          }))}
        />
        <Select
          label={t('qualification.assign.financialReviewer')}
          hint={t('qualification.assign.financialReviewerHint')}
          placeholder={t('qualification.assign.noFinancialReviewer')}
          value={reviewer}
          onChange={setReviewer}
          error={errors.forField('financialReviewerUserId')}
          options={(options?.financialReviewers ?? []).map((person) => ({
            value: String(person.userId),
            label: t('qualification.assign.personOption', {
              name: person.fullName,
              count: person.openAssignments,
            }),
          }))}
        />
        <DateTimeInput
          label={t('qualification.assign.dueAt')}
          required
          value={dueAt}
          onChange={setDueAt}
          timeZone={timeZone}
          error={errors.forField('dueAt')}
          fieldClassName="tiq-form-full"
        />
        <Select
          label={t('qualification.assign.priority')}
          required
          value={priority}
          onChange={(value) => setPriority(value as TasksPriority)}
          error={errors.forField('priority')}
          options={TASKS_PRIORITY.map((value) => ({
            value,
            label: tEnum('tasks.priority', value),
          }))}
        />
        <Select
          label={t('qualification.assign.risk')}
          required
          value={risk}
          onChange={(value) => setRisk(value as QualificationApplicationsRiskLevel)}
          error={errors.forField('riskLevel')}
          options={QUALIFICATION_APPLICATIONS_RISK_LEVEL.map((value) => ({
            value,
            label: tEnum('qualification_applications.risk_level', value),
          }))}
        />
      </div>
    </Dialog>
  );
}
