/**
 * Link stages (BUY-07, BUY-08): records that a tender continues an earlier event (next stage, re-tender, follow-on,
 * or a tender that follows an RFI). The earlier event keeps its own record; nothing is copied by linking.
 */
import { useState } from 'react';

import { TENDERS_LINK_TYPE } from '@contracts/enums';
import { linkTender, listTenders } from '@contracts/tenders';
import type { TenderLinkState } from '@contracts/tenders';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { Select, formErrors } from '../../../components/ui';
import { t, tEnum } from '../../../lib/i18n';
import { FormDialog } from './FormDialog';

export interface LinkStageDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The tender being linked; when omitted the user chooses it. */
  readonly tenderId?: number;
  readonly onLinked: (result: TenderLinkState) => void;
}

export function LinkStageDialog({ open, onClose, tenderId, onLinked }: LinkStageDialogProps) {
  const candidates = useApiQuery(listTenders, open ? { query: { pageSize: 100 } } : null);
  const mutation = useApiMutation(linkTender);
  const [tender, setTender] = useState(tenderId === undefined ? '' : String(tenderId));
  const [from, setFrom] = useState('');
  const [linkType, setLinkType] = useState('');
  const [touched, setTouched] = useState(false);

  const rows = candidates.data?.items ?? [];
  const options = rows.map((row) => ({
    value: String(row.id),
    label: `${row.reference} ${row.title}`,
  }));
  const errors = formErrors(mutation.error, ['linkedFromTenderId', 'linkType']);
  const tenderMissing = touched && tender === '';
  const fromMissing = touched && from === '';
  const typeMissing = touched && linkType === '';

  const close = (): void => {
    mutation.reset();
    setTouched(false);
    setFrom('');
    setLinkType('');
    if (tenderId === undefined) setTender('');
    onClose();
  };

  const submit = async (): Promise<void> => {
    setTouched(true);
    if (tender === '' || from === '' || linkType === '') return;
    try {
      const result = await mutation.mutate({
        params: { tenderId: Number(tender) },
        body: {
          linkedFromTenderId: Number(from),
          linkType: linkType as (typeof TENDERS_LINK_TYPE)[number],
        },
      });
      onLinked(result);
      close();
    } catch {
      // The failure is shown in the dialog.
    }
  };

  return (
    <FormDialog
      open={open}
      title={t('tender-authoring.link.title')}
      description={t('tender-authoring.link.description')}
      submitLabel={t('tender-authoring.link.submit')}
      onSubmit={() => void submit()}
      onClose={close}
      pending={mutation.pending}
      error={mutation.error}
      otherErrors={errors.other}
    >
      {tenderId === undefined && (
        <Select
          label={t('tender-authoring.link.tender')}
          required
          placeholder={t('tender-authoring.common.select')}
          value={tender}
          options={options}
          onChange={setTender}
          error={tenderMissing ? t('tender-authoring.link.tenderRequired') : undefined}
        />
      )}
      <Select
        label={t('tender-authoring.link.from')}
        required
        placeholder={t('tender-authoring.common.select')}
        value={from}
        options={options.filter((option) => option.value !== tender)}
        onChange={setFrom}
        hint={t('tender-authoring.link.fromHint')}
        error={
          errors.forField('linkedFromTenderId') ??
          (fromMissing ? t('tender-authoring.link.fromRequired') : undefined)
        }
      />
      <Select
        label={t('tender-authoring.link.type')}
        required
        placeholder={t('tender-authoring.common.select')}
        value={linkType}
        options={TENDERS_LINK_TYPE.map((value) => ({
          value,
          label: tEnum('tenders.link_type', value),
        }))}
        onChange={setLinkType}
        error={
          errors.forField('linkType') ??
          (typeMissing ? t('tender-authoring.link.typeRequired') : undefined)
        }
      />
    </FormDialog>
  );
}
