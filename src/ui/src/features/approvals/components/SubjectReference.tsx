/**
 * The subject of an approval as COM-04/COM-05 show it. A short record code (`T-2026-0009`, `PR-2026-0001`,
 * `C-2026-0001 CR-0003`) uses the monospaced reference style; any longer label wraps like normal text so it never
 * pushes the status and decision columns off-screen. The link is only rendered when the API returned one (the
 * caller may open the subject's page); a subject without a reference of its own is linked as "Open the record".
 */
import { Link } from 'react-router';

import { Reference } from '../../../components/ui';
import { EMPTY_VALUE } from '../../../lib/format';
import { t } from '../../../lib/i18n';

/** One or two record codes such as `T-2026-0003` or `C-2026-0001 CR-0003`. */
const SHORT_CODE = /^[A-Z]{1,4}-\d{4}(-\d{3,6})?( [A-Z]{1,4}-\d{3,6})?$/;

function isShortReference(value: string): boolean {
  return SHORT_CODE.test(value);
}

export interface SubjectReferenceProps {
  readonly value: string | null;
  readonly to: string | null | undefined;
}

export function SubjectReference({ value, to }: SubjectReferenceProps) {
  const link = to ?? null;
  if (value === null) {
    return link === null ? (
      <>{EMPTY_VALUE}</>
    ) : (
      <Link to={link}>{t('approvals.detail.openSubject')}</Link>
    );
  }
  if (isShortReference(value)) {
    return <Reference value={value} to={link} />;
  }
  return link === null ? <span>{value}</span> : <Link to={link}>{value}</Link>;
}
