/**
 * ADM-09 — Establish a qualification program: the header (scope, validity, decision authority, owner, monitoring
 * triggers). The program starts as a draft with an empty draft version 1; its criteria are added on the program page
 * and take effect only when that version is approved.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { CreateProgramBody, qualificationEndpoints as api } from '@contracts/qualification';
import type { ProgramDetail, QualificationOptions } from '@contracts/qualification';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  FormErrorSummary,
  PageHeader,
  QueryView,
  UnsavedChangesGuard,
  useToast,
} from '../../../../components/ui';
import { t } from '../../../../lib/i18n';
import { ProgramFields } from '../../components/ProgramFields';
import { summaryTitle } from '../../lib/errors';
import { runCommand } from '../../lib/hooks';
import { buyerQualificationPaths } from '../../lib/paths';
import { emptyProgramDraft, PROGRAM_FIELDS, programBody } from '../../lib/programDraft';
import type { ProgramDraft } from '../../lib/programDraft';
import { errorLookup, validateWith } from '../../lib/validation';

export default function ProgramNewPage() {
  const options = useApiQuery(api.getQualificationOptions, {});
  return (
    <div className="tiq-page">
      <QueryView query={options}>{(data) => <NewProgramForm options={data} />}</QueryView>
      {options.data === undefined && (
        <PageHeader
          title={t('qualification.programNew.title')}
          back={{ to: buyerQualificationPaths.programs, label: t('qualification.program.back') }}
        />
      )}
    </div>
  );
}

function NewProgramForm({ options }: { readonly options: QualificationOptions }) {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useApiMutation(api.createProgram);
  const [draft, setDraft] = useState<ProgramDraft>(() => emptyProgramDraft(options));
  const [tried, setTried] = useState(false);
  const [created, setCreated] = useState<ProgramDetail | null>(null);
  const body = programBody(draft);
  const errors = errorLookup(
    tried ? validateWith(CreateProgramBody, body) : [],
    create.error,
    PROGRAM_FIELDS,
  );
  const dirty =
    created === null && JSON.stringify(draft) !== JSON.stringify(emptyProgramDraft(options));

  const submit = (): void => {
    setTried(true);
    const parsed = CreateProgramBody.safeParse(body);
    if (!parsed.success) return;
    void runCommand(
      () => create.mutate({ body: parsed.data }),
      (program) => {
        setCreated(program);
        toast.show(t('qualification.programNew.created', { name: program.name }), 'success');
      },
    );
  };

  if (created !== null) {
    return (
      <>
        <PageHeader
          title={t('qualification.programNew.createdTitle', { name: created.name })}
          back={{ to: buyerQualificationPaths.programs, label: t('qualification.program.back') }}
        />
        <Banner
          tone="success"
          title={t('qualification.programNew.createdBanner')}
          actions={
            <Button onClick={() => void navigate(buyerQualificationPaths.programs)}>
              {t('qualification.programNew.toRegister')}
            </Button>
          }
        >
          {t('qualification.programNew.createdDetail', {
            no: created.versions[0]?.versionNo ?? 1,
          })}
        </Banner>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('qualification.programNew.title')}
        subtitle={t('qualification.programNew.intro')}
        back={{ to: buyerQualificationPaths.programs, label: t('qualification.program.back') }}
        primaryAction={
          <Button variant="primary" icon="plus" onClick={submit} loading={create.pending}>
            {t('qualification.programNew.create')}
          </Button>
        }
      />
      <UnsavedChangesGuard when={dirty && !create.pending} />
      <Card title={t('qualification.program.headerTitle')}>
        <FormErrorSummary title={summaryTitle(create.error)} errors={errors.other} />
        <ProgramFields draft={draft} onChange={setDraft} options={options} errors={errors} />
        <div className="tiq-inline">
          <ButtonLink to={buyerQualificationPaths.programs}>
            {t('qualification.common.cancel')}
          </ButtonLink>
          <Button variant="primary" icon="plus" onClick={submit} loading={create.pending}>
            {t('qualification.programNew.create')}
          </Button>
        </div>
      </Card>
    </>
  );
}
