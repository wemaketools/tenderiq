/**
 * BUY-35 eligibility gate check (BR-23, BR-03, AC-07): for a supplier, category and contract value at a date, the
 * qualification gate a tender applies. A registered supplier without a decision covering the category is shown as
 * "Registered — not qualified for <category>", never as qualified.
 */
import { useState } from 'react';

import { qualificationEndpoints as api } from '@contracts/qualification';
import type { CategoryRef, EligibilityQuery, SupplierRef } from '@contracts/qualification';

import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  DateInput,
  DetailList,
  MoneyInput,
  QueryView,
  Reference,
  Select,
  StatusChip,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { buyerQualificationPaths } from '../lib/paths';
import { categoryLabel, dateOrDash, gateText } from '../lib/text';
import { EffectiveStatusChip } from './shared';

export function EligibilityCheck({
  suppliers,
  categories,
  currencies,
}: {
  readonly suppliers: readonly SupplierRef[];
  readonly categories: readonly CategoryRef[];
  readonly currencies: readonly string[];
}) {
  const [supplierId, setSupplierId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState({ amount: '', currency: currencies[0] ?? '' });
  const [at, setAt] = useState('');
  const [tried, setTried] = useState(false);
  const [request, setRequest] = useState<Partial<EligibilityQuery> | null>(null);
  const result = useApiQuery(
    api.checkEligibility,
    request === null ? null : { query: request as EligibilityQuery },
  );

  const supplierMissing = supplierId === '';
  const categoryMissing = categoryId === '';
  const check = (): void => {
    setTried(true);
    if (supplierMissing || categoryMissing) return;
    const query: Partial<EligibilityQuery> = {
      supplierTenantId: Number(supplierId),
      categoryId: Number(categoryId),
    };
    if (amount.amount.trim() !== '') {
      query.amount = amount.amount.trim();
      query.currency = amount.currency === '' ? currencies[0] : amount.currency;
    }
    if (at !== '') query.at = at;
    setRequest(query);
  };

  return (
    <div className="tiq-stack">
      <Card
        title={t('qualification.eligibility.title')}
        subtitle={t('qualification.eligibility.intro')}
      >
        <div className="tiq-form-grid">
          <Select
            label={t('qualification.eligibility.supplier')}
            required
            placeholder={t('qualification.common.select')}
            value={supplierId}
            onChange={setSupplierId}
            error={tried && supplierMissing ? t('qualification.validation.required') : undefined}
            options={suppliers.map((supplier) => ({
              value: String(supplier.supplierTenantId),
              label: supplier.name,
            }))}
          />
          <Select
            label={t('qualification.eligibility.category')}
            required
            placeholder={t('qualification.common.select')}
            value={categoryId}
            onChange={setCategoryId}
            error={tried && categoryMissing ? t('qualification.validation.required') : undefined}
            options={categories.map((category) => ({
              value: String(category.categoryId),
              label: categoryLabel(category),
            }))}
          />
          <MoneyInput
            label={t('qualification.eligibility.amount')}
            hint={t('qualification.eligibility.amountHint')}
            value={amount}
            currencies={currencies}
            onChange={setAmount}
          />
          <DateInput
            label={t('qualification.eligibility.at')}
            hint={t('qualification.eligibility.atHint')}
            value={at}
            onChange={setAt}
          />
        </div>
        <div className="tiq-inline">
          <Button variant="primary" icon="shieldCheck" onClick={check} loading={result.isFetching}>
            {t('qualification.eligibility.check')}
          </Button>
        </div>
      </Card>
      {request !== null && (
        <QueryView query={result}>
          {(eligibility) => {
            const passes = eligibility.gate === 'met' || eligibility.gate === 'not_required';
            return (
              <Card title={t('qualification.eligibility.resultTitle')}>
                <Banner
                  tone={passes ? 'success' : 'warning'}
                  title={
                    passes
                      ? t('qualification.eligibility.passes', {
                          category: eligibility.category.code,
                        })
                      : t('qualification.common.registeredNotQualified', {
                          category: eligibility.category.code,
                        })
                  }
                >
                  {eligibility.explanation}
                </Banner>
                <DetailList
                  items={[
                    {
                      label: t('qualification.eligibility.supplier'),
                      value: eligibility.supplier.name,
                    },
                    {
                      label: t('qualification.eligibility.category'),
                      value: categoryLabel(eligibility.category),
                    },
                    {
                      label: t('qualification.eligibility.gate'),
                      value: (
                        <StatusChip
                          enum="participants.qualification_gate"
                          value={eligibility.gate}
                        />
                      ),
                    },
                    {
                      label: t('qualification.terms.effectiveStatus'),
                      value: <EffectiveStatusChip status={eligibility.effectiveStatus} size="sm" />,
                    },
                    {
                      label: t('qualification.eligibility.program'),
                      value: eligibility.program?.programName ?? null,
                    },
                    {
                      label: t('qualification.terms.blockedGate'),
                      value: gateText(eligibility.blockedGate),
                    },
                    {
                      label: t('qualification.eligibility.decision'),
                      value:
                        eligibility.decisionId === null ? null : (
                          <Reference
                            value={t('qualification.decision.decisionNo', {
                              id: eligibility.decisionId,
                            })}
                            to={buyerQualificationPaths.decision(eligibility.decisionId)}
                          />
                        ),
                    },
                    {
                      label: t('qualification.eligibility.evaluatedAt'),
                      value: dateOrDash(eligibility.evaluatedAt),
                    },
                  ]}
                />
              </Card>
            );
          }}
        </QueryView>
      )}
    </div>
  );
}
