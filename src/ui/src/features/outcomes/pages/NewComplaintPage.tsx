/**
 * SUP-22 — Lodge a complaint: the tender (and optionally one lot) the supplier took part in, the subject and the
 * grounds. A late complaint is received and marked outside the window, never refused. Submitting is a confirmed,
 * consequential action; evidence is added on the case once it exists.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { CreateComplaintBody, createComplaint, listComplaintTenders } from '@contracts/awards';
import type { ComplaintTenderOption } from '@contracts/awards';
import type { FieldError } from '@contracts/common';
import { COMPLAINTS_SUBJECT } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  EmptyState,
  FormErrorSummary,
  OfficialDeadline,
  PageHeader,
  QueryView,
  Select,
  TextArea,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { awardErrorMessage, withAwardMessage } from '../../awards/lib/errors';
import { errorLookup, validateWith } from '../../awards/lib/validation';
import { outcomePaths } from '../lib/paths';

export default function NewComplaintPage() {
  const query = useApiQuery(listComplaintTenders, {});
  const back = { to: outcomePaths.complaints, label: t('outcomes.newComplaint.back') };
  return (
    <>
      <PageHeader
        title={t('outcomes.newComplaint.title')}
        subtitle={t('outcomes.newComplaint.intro')}
        back={back}
      />
      <QueryView
        query={query}
        isEmpty={(data) => data.tenders.length === 0}
        empty={
          <EmptyState
            icon="scale"
            title={t('outcomes.newComplaint.noTenders')}
            description={t('outcomes.newComplaint.noTendersHint')}
          />
        }
      >
        {(data) => <ComplaintForm tenders={data.tenders} />}
      </QueryView>
    </>
  );
}

function tenderLabel(tender: {
  readonly reference: string;
  readonly title: string;
  readonly buyer: { readonly name: string };
}): string {
  return `${tender.reference} ${tender.title} · ${tender.buyer.name}`;
}

function ComplaintForm({ tenders }: { readonly tenders: readonly ComplaintTenderOption[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const preset = params.get('tenderId');
  const [tenderId, setTenderId] = useState(
    preset !== null && tenders.some((row) => String(row.tenderId) === preset) ? preset : '',
  );
  const [lotId, setLotId] = useState('');
  const [subject, setSubject] = useState('');
  const [grounds, setGrounds] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const [confirming, setConfirming] = useState(false);
  const create = useApiMutation(createComplaint);
  const errors = errorLookup(clientErrors, create.error, [
    'tenderId',
    'lotId',
    'subject',
    'grounds',
  ]);
  const tender = tenders.find((row) => String(row.tenderId) === tenderId);
  const dirty = tenderId !== (preset ?? '') || lotId !== '' || subject !== '' || grounds !== '';

  const body = {
    tenderId: tenderId === '' ? 0 : Number(tenderId),
    lotId: lotId === '' ? undefined : Number(lotId),
    subject,
    grounds: grounds.trim(),
  };

  const review = (): void => {
    const found = [
      ...(tenderId === ''
        ? [
            {
              field: 'tenderId',
              code: 'REQUIRED',
              message: t('outcomes.newComplaint.tenderRequired'),
            },
          ]
        : []),
      ...(subject === ''
        ? [
            {
              field: 'subject',
              code: 'REQUIRED',
              message: t('outcomes.newComplaint.subjectRequired'),
            },
          ]
        : []),
      ...validateWith(CreateComplaintBody, body).filter(
        (error) => error.field !== 'subject' && error.field !== 'tenderId',
      ),
    ];
    setClientErrors(found);
    if (found.length > 0) return;
    create.reset();
    setConfirming(true);
  };

  const confirm = async (): Promise<void> => {
    const parsed = CreateComplaintBody.safeParse(body);
    if (!parsed.success) return;
    try {
      const record = await create.mutate({ body: parsed.data });
      setConfirming(false);
      invalidateApiQueries('supplier.complaints.');
      toast.show(t('outcomes.newComplaint.submitted', { reference: record.reference }), 'success');
      void navigate(outcomePaths.complaint(record.complaintId), { state: { record } });
    } catch {
      // The dialog shows the error.
    }
  };

  return (
    <form
      className="tiq-stack tiq-stack--spaced"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        review();
      }}
    >
      <UnsavedChangesGuard when={dirty && !create.pending && !confirming} />
      <Banner tone="info" title={t('outcomes.newComplaint.privacyTitle')}>
        {t('outcomes.newComplaint.privacyText')}
      </Banner>
      <Card title={t('outcomes.newComplaint.formTitle')}>
        <div className="tiq-form-grid">
          <div className="tiq-form-full">
            <FormErrorSummary
              title={create.error === null ? null : awardErrorMessage(create.error)}
              errors={errors.other}
            />
          </div>
          <Select
            fieldClassName="tiq-form-full"
            label={t('outcomes.newComplaint.tender')}
            required
            placeholder={t('outcomes.newComplaint.chooseTender')}
            value={tenderId}
            error={errors.forField('tenderId')}
            options={tenders.map((row) => ({
              value: String(row.tenderId),
              label: tenderLabel(row),
            }))}
            onChange={(value) => {
              setTenderId(value);
              setLotId('');
            }}
          />
          <Select
            label={t('outcomes.newComplaint.lot')}
            hint={t('outcomes.newComplaint.lotHint')}
            placeholder={t('outcomes.newComplaint.wholeTender')}
            value={lotId}
            error={errors.forField('lotId')}
            options={(tender?.lots ?? []).map((lot) => ({
              value: String(lot.lotId),
              label: t('awards.common.lotLabel', { no: lot.lotNo, title: lot.title }),
            }))}
            onChange={setLotId}
          />
          <Select
            label={t('outcomes.newComplaint.subject')}
            required
            placeholder={t('outcomes.newComplaint.chooseSubject')}
            value={subject}
            error={errors.forField('subject')}
            options={COMPLAINTS_SUBJECT.map((value) => ({
              value,
              label: tEnum('complaints.subject', value),
            }))}
            onChange={setSubject}
          />
          {tender?.complaintDeadline !== null && tender?.complaintDeadline !== undefined && (
            <div className="tiq-form-full">
              <OfficialDeadline
                deadline={tender.complaintDeadline}
                variant="block"
                label={t('outcomes.newComplaint.deadline')}
              />
            </div>
          )}
          <TextArea
            fieldClassName="tiq-form-full"
            label={t('outcomes.newComplaint.grounds')}
            hint={t('outcomes.newComplaint.groundsHint')}
            required
            rows={8}
            value={grounds}
            error={errors.forField('grounds')}
            onChange={setGrounds}
          />
        </div>
      </Card>
      <div className="tiq-inline">
        <Button type="submit" variant="primary" icon="send">
          {t('outcomes.newComplaint.review')}
        </Button>
        <span className="tiq-text-muted">{t('outcomes.newComplaint.notSaved')}</span>
      </div>
      <ConfirmActionDialog
        open={confirming}
        title={t('outcomes.newComplaint.confirmTitle')}
        scope={
          tender === undefined
            ? ''
            : `${tenderLabel(tender)} · ${subject === '' ? '' : tEnum('complaints.subject', subject)}`
        }
        consequence={t('outcomes.newComplaint.confirmConsequence')}
        confirmLabel={t('outcomes.newComplaint.submit')}
        pending={create.pending}
        error={withAwardMessage(create.error)}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
      />
    </form>
  );
}
