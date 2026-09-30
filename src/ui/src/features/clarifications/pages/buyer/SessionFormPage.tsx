/**
 * BUY-18 Briefings and visits, schedule or edit a session: type, lot, times in the tender's official zone, venue and
 * attendance instructions, capacity, registration deadline, mandatory attendance (declared in advance; after release
 * only through an addendum), an alternative of another session and accessibility information.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type { BuyerSessionDetail, BuyerTenderContext } from '@contracts/clarifications';
import type { SessionsSessionType } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  DateTimeInput,
  EmptyState,
  FormErrorSummary,
  NumberInput,
  PageHeader,
  QueryView,
  RadioGroup,
  Select,
  TextArea,
  TextField,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../../components/ui';
import { formatOfficialTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { useNow } from '../../../../lib/useNow';
import { BuyerTenderSelect } from '../../components/BuyerTenderSelect';
import { useBuyerTenders } from '../../hooks';
import { buyerPaths, explainError } from '../../lib';

interface FormState {
  readonly lotId: string;
  readonly sessionType: SessionsSessionType;
  readonly title: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly venue: string;
  readonly instructions: string;
  readonly capacity: string;
  readonly mandatory: boolean;
  readonly alternativeOfId: string;
  readonly accessibilityInfo: string;
  readonly registrationDeadline: string | null;
}

const EMPTY_FORM: FormState = {
  lotId: '',
  sessionType: 'briefing',
  title: '',
  startsAt: null,
  endsAt: null,
  venue: '',
  instructions: '',
  capacity: '',
  mandatory: false,
  alternativeOfId: '',
  accessibilityInfo: '',
  registrationDeadline: null,
};

function formOf(session: BuyerSessionDetail): FormState {
  return {
    lotId: session.lot === null ? '' : String(session.lot.lotId),
    sessionType: session.sessionType,
    title: session.title,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    venue: session.venue,
    instructions: session.instructions ?? '',
    capacity: String(session.capacity),
    mandatory: session.mandatory,
    alternativeOfId: session.alternativeOf === null ? '' : String(session.alternativeOf.id),
    accessibilityInfo: session.accessibilityInfo ?? '',
    registrationDeadline: session.registrationDeadline?.at ?? null,
  };
}

const FIELDS = [
  'lotId',
  'sessionType',
  'title',
  'startsAt',
  'endsAt',
  'venue',
  'instructions',
  'capacity',
  'mandatory',
  'alternativeOfId',
  'accessibilityInfo',
  'registrationDeadline',
  'tenderId',
];

export default function SessionFormPage() {
  const { sessionId } = useParams();
  if (sessionId === undefined) {
    return <NewSession />;
  }
  const id = Number(sessionId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('clarifications.sessionPage.notFound')} />
        <EmptyState title={t('clarifications.sessionPage.notFound')} />
      </div>
    );
  }
  return <EditSession key={id} sessionId={id} />;
}

function NewSession() {
  const [searchParams] = useSearchParams();
  const tenders = useBuyerTenders();
  const [tender, setTender] = useState(searchParams.get('tenderId') ?? '');
  const context = useApiQuery(
    clarificationsEndpoints.buyerTenderContext,
    tender === '' ? null : { params: { tenderId: Number(tender) } },
  );
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('clarifications.sessionForm.newTitle')}
        subtitle={t('clarifications.sessionForm.subtitle')}
        back={{ to: buyerPaths.sessions, label: t('clarifications.sessionPage.back') }}
      />
      <Card>
        <BuyerTenderSelect
          tenders={tenders.data?.items}
          value={tender}
          onChange={setTender}
          required
          label={t('clarifications.addendumForm.tender')}
          placeholder={t('clarifications.addendumForm.pickTender')}
        />
      </Card>
      {tender === '' ? (
        <EmptyState
          icon="calendar"
          title={t('clarifications.sessionForm.pickTenderTitle')}
          description={t('clarifications.sessionForm.pickTenderHint')}
        />
      ) : (
        <QueryView query={context}>
          {(data) => (
            <SessionForm key={data.tenderId} context={data} initial={EMPTY_FORM} existing={null} />
          )}
        </QueryView>
      )}
    </div>
  );
}

function EditSession({ sessionId }: { readonly sessionId: number }) {
  const session = useApiQuery(clarificationsEndpoints.sessionsGet, { params: { sessionId } });
  const context = useApiQuery(
    clarificationsEndpoints.buyerTenderContext,
    session.data === undefined ? null : { params: { tenderId: session.data.tender.tenderId } },
  );
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('clarifications.sessionForm.editTitle')}
        subtitle={t('clarifications.sessionForm.subtitle')}
        back={{
          to: buyerPaths.session(sessionId),
          label: t('clarifications.sessionForm.backToSession'),
        }}
      />
      <QueryView query={session}>
        {(data) =>
          data.status !== 'scheduled' ? (
            <Banner tone="warning" title={t('clarifications.sessionForm.notEditable')}>
              <p>{t('clarifications.errors.SESSION_NOT_EDITABLE')}</p>
            </Banner>
          ) : (
            <QueryView query={context}>
              {(tender) => <SessionForm context={tender} initial={formOf(data)} existing={data} />}
            </QueryView>
          )
        }
      </QueryView>
    </div>
  );
}

function SessionForm({
  context,
  initial,
  existing,
}: {
  readonly context: BuyerTenderContext;
  readonly initial: FormState;
  readonly existing: BuyerSessionDetail | null;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();
  const [form, setForm] = useState<FormState>(initial);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<BuyerSessionDetail | null>(null);
  const create = useApiMutation(clarificationsEndpoints.sessionsCreate);
  const updateSession = useApiMutation(clarificationsEndpoints.sessionsUpdate);
  const mutation = existing === null ? create : updateSession;
  const siblings = useApiQuery(clarificationsEndpoints.sessionsList, {
    query: { tenderId: context.tenderId, status: ['scheduled'], pageSize: 100 },
  });
  const tz = context.officialTimeZone;
  const dirty = saved === null && JSON.stringify(form) !== JSON.stringify(initial);

  useEffect(() => {
    if (saved !== null) {
      navigate(buyerPaths.session(saved.id), { state: { session: saved } });
    }
  }, [navigate, saved]);

  const set = (values: Partial<FormState>): void => setForm({ ...form, ...values });
  const startMs = form.startsAt === null ? null : Date.parse(form.startsAt);
  const endMs = form.endsAt === null ? null : Date.parse(form.endsAt);
  const deadlineMs =
    form.registrationDeadline === null ? null : Date.parse(form.registrationDeadline);
  const capacity = Number(form.capacity);
  const clientErrors: Record<string, string | undefined> = {
    title: form.title.trim() === '' ? t('clarifications.sessionForm.required.title') : undefined,
    venue: form.venue.trim() === '' ? t('clarifications.sessionForm.required.venue') : undefined,
    startsAt:
      startMs === null
        ? t('clarifications.sessionForm.required.startsAt')
        : existing === null && startMs <= now
          ? t('clarifications.errors.SESSION_IN_PAST')
          : undefined,
    endsAt:
      endMs === null
        ? t('clarifications.sessionForm.required.endsAt')
        : startMs !== null && endMs <= startMs
          ? t('clarifications.errors.SESSION_END_BEFORE_START')
          : undefined,
    capacity:
      form.capacity === '' || !Number.isInteger(capacity) || capacity < 1 || capacity > 1000
        ? t('clarifications.sessionForm.required.capacity')
        : undefined,
    registrationDeadline:
      deadlineMs !== null && startMs !== null && deadlineMs > startMs
        ? t('clarifications.errors.REGISTRATION_DEADLINE_AFTER_START')
        : undefined,
  };
  const hasClientErrors = Object.values(clientErrors).some((value) => value !== undefined);
  const serverErrors = formErrors(mutation.error, FIELDS);
  const errorFor = (field: string): string | undefined =>
    serverErrors.forField(field) ?? (tried ? clientErrors[field] : undefined);
  const released = context.status !== 'draft' && context.status !== 'awaiting_release_approval';

  const onSave = async (): Promise<void> => {
    setTried(true);
    if (hasClientErrors || form.startsAt === null || form.endsAt === null) return;
    const fields = {
      lotId: form.lotId === '' ? null : Number(form.lotId),
      sessionType: form.sessionType,
      title: form.title,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      venue: form.venue,
      instructions: form.instructions.trim() === '' ? null : form.instructions,
      capacity,
      mandatory: form.mandatory,
      alternativeOfId: form.alternativeOfId === '' ? null : Number(form.alternativeOfId),
      accessibilityInfo: form.accessibilityInfo.trim() === '' ? null : form.accessibilityInfo,
      registrationDeadline: form.registrationDeadline,
    };
    try {
      const result =
        existing === null
          ? await create.mutate({ body: { ...fields, tenderId: context.tenderId } })
          : await updateSession.mutate({ params: { sessionId: existing.id }, body: fields });
      toast.show(t('clarifications.sessionForm.saved'), 'success');
      setSaved(result);
    } catch {
      // Shown by the form error summary.
    }
  };

  return (
    <>
      <UnsavedChangesGuard when={dirty} />
      <Card title={t('clarifications.sessionForm.logistics')}>
        <div className="tiq-form-grid">
          <RadioGroup
            label={t('clarifications.sessionForm.type')}
            inline
            value={form.sessionType}
            onChange={(value) => set({ sessionType: value as SessionsSessionType })}
            options={(['briefing', 'site_visit'] as const).map((value) => ({
              value,
              label: tEnum('sessions.session_type', value),
            }))}
          />
          {context.lots.length > 0 && (
            <Select
              label={t('clarifications.addendumForm.lot')}
              value={form.lotId}
              onChange={(value) => set({ lotId: value })}
              placeholder={t('clarifications.common.allLots')}
              error={errorFor('lotId')}
              options={context.lots.map((lot) => ({
                value: String(lot.lotId),
                label: t('clarifications.common.lotLabel', { no: lot.lotNo, title: lot.title }),
              }))}
            />
          )}
          <TextField
            label={t('clarifications.sessionForm.title')}
            required
            fieldClassName="tiq-form-full"
            value={form.title}
            onChange={(value) => set({ title: value })}
            error={errorFor('title')}
          />
          <DateTimeInput
            label={t('clarifications.sessionForm.startsAt')}
            required
            timeZone={tz}
            value={form.startsAt}
            onChange={(value) => set({ startsAt: value })}
            error={errorFor('startsAt')}
          />
          <DateTimeInput
            label={t('clarifications.sessionForm.endsAt')}
            required
            timeZone={tz}
            value={form.endsAt}
            onChange={(value) => set({ endsAt: value })}
            error={errorFor('endsAt')}
          />
          <TextArea
            label={t('clarifications.sessionForm.venue')}
            required
            rows={2}
            fieldClassName="tiq-form-full"
            value={form.venue}
            onChange={(value) => set({ venue: value })}
            error={errorFor('venue')}
          />
          <TextArea
            label={t('clarifications.sessionForm.instructions')}
            hint={t('clarifications.sessionForm.instructionsHint')}
            rows={3}
            fieldClassName="tiq-form-full"
            value={form.instructions}
            onChange={(value) => set({ instructions: value })}
            error={errorFor('instructions')}
          />
          <NumberInput
            label={t('clarifications.sessionForm.capacity')}
            required
            places={0}
            value={form.capacity}
            onChange={(value) => set({ capacity: value })}
            error={errorFor('capacity')}
          />
          <DateTimeInput
            label={t('clarifications.sessionForm.registrationDeadline')}
            hint={t('clarifications.sessionForm.registrationDeadlineHint')}
            timeZone={tz}
            value={form.registrationDeadline}
            onChange={(value) => set({ registrationDeadline: value })}
            error={errorFor('registrationDeadline')}
          />
          <Select
            label={t('clarifications.sessionForm.alternativeOf')}
            hint={t('clarifications.sessionForm.alternativeHint')}
            value={form.alternativeOfId}
            onChange={(value) => set({ alternativeOfId: value })}
            placeholder={t('clarifications.sessionForm.noAlternative')}
            error={errorFor('alternativeOfId')}
            options={(siblings.data?.items ?? [])
              .filter((item) => existing === null || item.id !== existing.id)
              .map((item) => ({
                value: String(item.id),
                label: `${item.title} · ${formatOfficialTime(item.startsAt, item.timeZone)}`,
              }))}
          />
          <TextArea
            label={t('clarifications.sessionForm.accessibility')}
            hint={t('clarifications.sessionForm.accessibilityHint')}
            rows={2}
            fieldClassName="tiq-form-full"
            value={form.accessibilityInfo}
            onChange={(value) => set({ accessibilityInfo: value })}
            error={errorFor('accessibilityInfo')}
          />
          <div className="tiq-form-full">
            <Checkbox
              label={t('clarifications.sessionForm.mandatory')}
              hint={
                released
                  ? t('clarifications.sessionForm.mandatoryReleasedHint')
                  : t('clarifications.sessionForm.mandatoryHint')
              }
              checked={form.mandatory}
              onChange={(checked) => set({ mandatory: checked })}
              error={errorFor('mandatory')}
            />
          </div>
        </div>
      </Card>
      {mutation.error !== null && (
        <FormErrorSummary
          title={explainError(mutation.error)?.detail ?? mutation.error.title}
          errors={serverErrors.other}
        />
      )}
      {tried && hasClientErrors && (
        <Banner tone="error" title={t('clarifications.addendumForm.fixErrors')} />
      )}
      <div className="tiq-inline">
        <Button variant="primary" icon="check" loading={mutation.pending} onClick={onSave}>
          {existing === null
            ? t('clarifications.sessionForm.schedule')
            : t('clarifications.sessionForm.saveChanges')}
        </Button>
        <ButtonLink to={existing === null ? buyerPaths.sessions : buyerPaths.session(existing.id)}>
          {t('clarifications.common.cancel')}
        </ButtonLink>
        <span className="tiq-text-muted">{t('clarifications.sessionForm.saveHint')}</span>
      </div>
    </>
  );
}
