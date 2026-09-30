/**
 * Chooses the record a hold or an evidence pack targets: searches the organization's records by reference or title
 * and shows whether each is already under a hold or past its ordinary retention.
 */
import { useState } from 'react';

import { recordsEndpoints } from '@contracts/records';
import type { RecordSubject, RecordSubjectType } from '@contracts/records';

import { useApiQuery } from '../../../api/hooks';
import { Chip, RadioGroup, SearchField } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export interface SubjectPickerProps {
  readonly label: string;
  readonly types: readonly RecordSubjectType[];
  readonly value: RecordSubject | null;
  readonly onChange: (subject: RecordSubject) => void;
  readonly error?: string;
}

function subjectKey(subject: RecordSubject): string {
  return `${subject.subjectType}:${subject.subjectId}`;
}

export function SubjectPicker({ label, types, value, onChange, error }: SubjectPickerProps) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const query = useApiQuery(recordsEndpoints.listRecordSubjects, {
    query: {
      ...(q === '' ? {} : { q }),
      subjectType: [...types],
      pageSize: 8,
      sort: 'reference',
      dir: 'asc',
    },
  });
  const items = query.data?.items ?? [];
  const options =
    value !== null && !items.some((item) => subjectKey(item) === subjectKey(value))
      ? [value, ...items]
      : items;

  return (
    <div className="tiq-stack">
      <SearchField
        label={t('records.subject.search')}
        value={text}
        onChange={setText}
        onSubmit={(next) => setQ(next.trim())}
        placeholder={t('records.subject.placeholder')}
      />
      {query.data === undefined ? (
        <p className="tiq-text-muted" role="status">
          {query.error === null ? t('records.subject.loading') : t('records.subject.error')}
        </p>
      ) : options.length === 0 ? (
        <p className="tiq-text-muted" role="status">
          {t('records.subject.none')}
        </p>
      ) : (
        <RadioGroup
          label={label}
          required
          value={value === null ? '' : subjectKey(value)}
          error={error}
          onChange={(key) => {
            const subject = options.find((item) => subjectKey(item) === key);
            if (subject !== undefined) onChange(subject);
          }}
          options={options.map((item) => ({
            value: subjectKey(item),
            label: `${item.reference === null ? '' : `${item.reference} · `}${item.label}`,
          }))}
        />
      )}
      {value !== null && (
        <div className="tiq-inline">
          <Chip tone="neutral" size="sm">
            {t(`records.subjectTypes.${value.subjectType}`)}
          </Chip>
          {value.underHold && (
            <Chip tone="warning" size="sm" icon="lock">
              {t('records.subject.underHold')}
            </Chip>
          )}
          {value.pastRetention && (
            <Chip tone="info" size="sm" icon="hourglass">
              {t('records.subject.pastRetention')}
            </Chip>
          )}
        </div>
      )}
    </div>
  );
}
