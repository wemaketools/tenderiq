/**
 * The authority check of a contract change on the CUMULATIVE contract value after the change (AC-31, BR-36): several
 * small changes can exceed an approver's limit together, so the total exposure and the required approver are shown.
 */
import type { ChangeAuthorityCheck } from '@contracts/contracts';

import { Banner, Chip, DetailList, MoneyText } from '../../../components/ui';
import { formatDecimalString } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { PersonName } from './shared';

export function AuthorityCheck({ check }: { readonly check: ChangeAuthorityCheck }) {
  return (
    <div className="tiq-stack">
      <Banner
        tone={check.sufficient ? 'success' : 'warning'}
        title={
          check.sufficient
            ? t('contracts.authority.sufficient')
            : t('contracts.authority.insufficient', {
                name: check.requiredApprover?.fullName ?? t('contracts.authority.higher'),
              })
        }
      >
        {check.explanation}
      </Banner>
      <DetailList
        items={[
          {
            label: t('contracts.authority.basis'),
            value: (
              <Chip tone="info" size="sm">
                {t('contracts.authority.cumulative')}
              </Chip>
            ),
          },
          {
            label: t('contracts.authority.original'),
            value: <MoneyText value={check.originalValue} />,
          },
          {
            label: t('contracts.authority.single'),
            value: <MoneyText value={check.singleChangeAmount} />,
          },
          {
            label: t('contracts.authority.cumulativeChanges'),
            value: (
              <>
                <MoneyText value={check.cumulativeChanges} />{' '}
                <span className="tiq-text-muted">
                  {t('contracts.authority.percent', {
                    percent: formatDecimalString(check.cumulativeChangePercent, 2),
                  })}
                </span>
              </>
            ),
          },
          {
            label: t('contracts.authority.checked'),
            value: <MoneyText value={check.checkedAmount} />,
          },
          {
            label: t('contracts.authority.checkedApprover'),
            value: <PersonName person={check.checkedApprover} />,
          },
          {
            label: t('contracts.authority.limit'),
            value: <MoneyText value={check.checkedLimit} />,
          },
          {
            label: t('contracts.authority.required'),
            value: <PersonName person={check.requiredApprover} />,
          },
        ]}
      />
    </div>
  );
}
