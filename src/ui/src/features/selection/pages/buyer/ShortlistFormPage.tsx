/**
 * BUY-23 — Start a shortlist: the tender and lot, the stage it advances to, the selection rule and threshold and the
 * rationale, next to the eligible candidates and their scores. The shortlist is saved as a draft; the include and
 * exclude decisions are recorded on the shortlist before approval (FR-15, AC-22).
 */
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';

import { selectionEndpoints } from '@contracts/selection';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import {
  Button,
  Card,
  FormErrorSummary,
  NumberInput,
  PageHeader,
  Select,
  TextArea,
  UnsavedChangesGuard,
  formErrors,
} from '../../../../components/ui';
import { t } from '../../../../lib/i18n';
import { CandidateTable } from '../../components/CandidateTable';
import { SelectionPage } from '../../components/SelectionPage';
import { TenderSelect } from '../../components/TenderSelect';
import { selectionErrorMessage } from '../../lib/errors';
import { useTenderSearchParam } from '../../lib/hooks';
import { attempt, idOf } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';

const FIELDS = ['tenderId', 'lotId', 'stageNo', 'selectionRule', 'threshold', 'rationale'];

export default function ShortlistFormPage() {
  const navigate = useNavigate();
  const linkedTender = useTenderSearchParam();
  const [tender, setTender] = useState(linkedTender === null ? '' : String(linkedTender));
  const [lot, setLot] = useState('');
  const [stageNo, setStageNo] = useState('1');
  const [rule, setRule] = useState('');
  const [threshold, setThreshold] = useState('');
  const [rationale, setRationale] = useState('');
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);
  const create = useApiMutation(selectionEndpoints.createShortlist);
  const tenderId = idOf(tender);
  const summary = useApiQuery(
    selectionEndpoints.getTender,
    tenderId === undefined ? null : { params: { tenderId } },
  );
  const server = formErrors(create.error, FIELDS);
  const required = t('selection.form.required');
  const stage = Number(stageNo);
  const stageInvalid = !Number.isInteger(stage) || stage < 1 || stage > 9;
  const local = {
    tender: touched && tenderId === undefined ? required : undefined,
    stageNo: touched && stageInvalid ? t('selection.shortlistForm.stageInvalid') : undefined,
    rule: touched && rule.trim() === '' ? required : undefined,
    rationale: touched && rationale.trim() === '' ? required : undefined,
  };
  const change = <T,>(setter: (value: T) => void) => {
    return (value: T): void => {
      setter(value);
      setDirty(true);
    };
  };
  const lotId = idOf(lot);
  const candidates = (summary.data?.candidates ?? []).filter(
    (candidate) => lotId === undefined || candidate.lot?.lotId === lotId,
  );

  const submit = async (): Promise<void> => {
    setTouched(true);
    if (tenderId === undefined || stageInvalid || rule.trim() === '' || rationale.trim() === '') {
      return;
    }
    const created = await attempt(
      create.mutate({
        body: {
          tenderId,
          lotId: lotId ?? null,
          stageNo: stage,
          selectionRule: rule.trim(),
          threshold: threshold === '' ? null : threshold,
          rationale: rationale.trim(),
        },
      }),
    );
    if (created === undefined) return;
    flushSync(() => setDirty(false));
    void navigate(selectionPaths.shortlist(created.shortlistId), { state: { record: created } });
  };

  return (
    <SelectionPage
      header={
        <PageHeader
          title={t('selection.shortlistForm.title')}
          subtitle={t('selection.shortlistForm.intro')}
          back={{ to: selectionPaths.shortlists, label: t('selection.shortlists.title') }}
        />
      }
    >
      <UnsavedChangesGuard when={dirty && !create.pending} />
      <form
        className="tiq-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {create.error !== null && (
          <FormErrorSummary title={selectionErrorMessage(create.error)} errors={server.other} />
        )}
        <Card title={t('selection.shortlistForm.rule')}>
          <div className="tiq-form-grid">
            <TenderSelect
              mode="form"
              value={tender}
              onChange={(value) => {
                change(setTender)(value);
                setLot('');
              }}
              error={local.tender ?? server.forField('tenderId')}
            />
            <Select
              label={t('selection.common.lot')}
              placeholder={t('selection.common.wholeTender')}
              value={lot}
              options={(summary.data?.lots ?? []).map((item) => ({
                value: String(item.lotId),
                label: t('selection.common.lotLabel', { lotNo: item.lotNo, title: item.title }),
              }))}
              onChange={change(setLot)}
              error={server.forField('lotId')}
            />
            <NumberInput
              label={t('selection.shortlistForm.stage')}
              hint={t('selection.shortlistForm.stageHint')}
              required
              places={0}
              value={stageNo}
              onChange={change(setStageNo)}
              error={local.stageNo ?? server.forField('stageNo')}
            />
            <NumberInput
              label={t('selection.shortlistForm.threshold')}
              hint={t('selection.shortlistForm.thresholdHint')}
              places={2}
              value={threshold}
              onChange={change(setThreshold)}
              error={server.forField('threshold')}
            />
            <TextArea
              label={t('selection.shortlistForm.selectionRule')}
              hint={t('selection.shortlistForm.selectionRuleHint')}
              required
              rows={3}
              fieldClassName="tiq-form-full"
              value={rule}
              onChange={change(setRule)}
              error={local.rule ?? server.forField('selectionRule')}
            />
            <TextArea
              label={t('selection.shortlistForm.rationale')}
              required
              rows={4}
              fieldClassName="tiq-form-full"
              value={rationale}
              onChange={change(setRationale)}
              error={local.rationale ?? server.forField('rationale')}
            />
          </div>
        </Card>
        {summary.data !== undefined && (
          <Card
            title={t('selection.shortlistForm.candidates')}
            subtitle={t('selection.shortlistForm.candidatesHint')}
            flush
          >
            <CandidateTable
              candidates={candidates}
              caption={t('selection.shortlistForm.candidates')}
            />
          </Card>
        )}
        <div className="tiq-inline">
          <Button type="submit" variant="primary" icon="check" loading={create.pending}>
            {t('selection.shortlistForm.submit')}
          </Button>
          <Button type="button" onClick={() => void navigate(selectionPaths.shortlists)}>
            {t('selection.form.cancel')}
          </Button>
          <span className="tiq-text-muted">{t('selection.shortlistForm.savedAsDraft')}</span>
        </div>
      </form>
    </SelectionPage>
  );
}
