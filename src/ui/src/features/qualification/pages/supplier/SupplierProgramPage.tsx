/**
 * SUP-20 — One qualification program as the supplier sees it: the buyer, categories covered, value limit and
 * geography, validity and renewal notice, and every question with its guidance, threshold and accepted evidence,
 * grouped by assessment area. The supplier's own status for the program is shown ("Registered — not qualified for
 * <category>", AC-07) and it can apply or continue its application.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { qualificationEndpoints as api } from '@contracts/qualification';
import type { SupplierProgramDetail } from '@contracts/qualification';

import { useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DetailList,
  EmptyState,
  PageHeader,
  QueryView,
  RestrictedState,
  StatusChip,
  useToast,
} from '../../../../components/ui';
import { formatInstantDate, formatMoney } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { ApplyDialog } from '../../components/ApplyDialog';
import { EffectiveStatusChip } from '../../components/shared';
import { useDefaultCurrency, useIdParam, useOfficialTimeZone } from '../../lib/hooks';
import { supplierQualificationPaths } from '../../lib/paths';
import { categoryLabel } from '../../lib/text';

export default function SupplierProgramPage() {
  const programId = useIdParam('programId');
  const query = useApiQuery(
    api.getSupplierProgram,
    programId === null ? null : { params: { programId } },
  );
  const notFound = programId === null || query.error?.kind === 'not_found';
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={
            notFound
              ? t('qualification.supplierProgram.notFound')
              : t('qualification.supplierProgram.loadingTitle')
          }
          back={{
            to: supplierQualificationPaths.home,
            label: t('qualification.supplierProgram.back'),
          }}
        />
      )}
      {notFound ? (
        <EmptyState title={t('qualification.supplierProgram.notFound')} />
      ) : query.error?.kind === 'forbidden' ? (
        <RestrictedState description={t('qualification.supplierProgram.restricted')} />
      ) : (
        <QueryView query={query}>{(data) => <ProgramView program={data} />}</QueryView>
      )}
    </div>
  );
}

const QUALIFIED = new Set(['qualified', 'qualified_with_conditions']);

function ProgramView({ program }: { readonly program: SupplierProgramDetail }) {
  const navigate = useNavigate();
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const currency = useDefaultCurrency();
  const canApply = usePermission('supplier.qualification.apply');
  const [applying, setApplying] = useState(false);
  const inProgress = program.myApplicationInProgress;
  const areas = [...new Set(program.criteria.map((criterion) => criterion.area))];

  return (
    <>
      <PageHeader
        title={program.name}
        subtitle={t('qualification.supplierProgram.subtitle', {
          buyer: program.buyer.name,
          no: program.currentVersion.versionNo,
          date: formatInstantDate(program.currentVersion.approvedAt, timeZone),
        })}
        back={{
          to: supplierQualificationPaths.home,
          label: t('qualification.supplierProgram.back'),
        }}
        meta={
          <>
            <EffectiveStatusChip status={program.myStatus} />
            <span>
              {t('qualification.common.nextAction', {
                action:
                  inProgress !== null
                    ? t('qualification.supplierProgram.next.continue')
                    : QUALIFIED.has(program.myStatus)
                      ? t('qualification.supplierProgram.next.qualified')
                      : t('qualification.supplierProgram.next.apply'),
              })}
            </span>
          </>
        }
        primaryAction={
          canApply ? (
            inProgress !== null ? (
              <ButtonLink
                to={supplierQualificationPaths.application(inProgress.applicationId)}
                variant="primary"
                icon="arrowRight"
              >
                {t('qualification.supplierProgram.continue')}
              </ButtonLink>
            ) : (
              <Button variant="primary" icon="plus" onClick={() => setApplying(true)}>
                {t('qualification.supplierProgram.apply')}
              </Button>
            )
          ) : undefined
        }
      />
      {!QUALIFIED.has(program.myStatus) && (
        <Banner
          tone="warning"
          title={t('qualification.common.registeredNotQualified', {
            category: program.coveredCategories.map((category) => category.code).join(', '),
          })}
        >
          {t('qualification.supplierProgram.notQualified', {
            buyer: program.buyer.name,
            status: tEnum('v_qualification_status.effective_status', program.myStatus),
          })}
        </Banner>
      )}
      {inProgress !== null && (
        <Banner tone="info" title={t('qualification.supplierProgram.inProgressTitle')}>
          <span className="tiq-inline">
            <span>{inProgress.reference ?? t('qualification.supplier.draft')}</span>
            <StatusChip
              enum="qualification_applications.status"
              value={inProgress.status}
              size="sm"
            />
          </span>
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('qualification.supplierProgram.scopeTitle')}>
          <DetailList
            items={[
              {
                label: t('qualification.program.category'),
                value: categoryLabel(program.category),
              },
              {
                label: t('qualification.program.covered'),
                value: program.coveredCategories.map(categoryLabel).join(', '),
              },
              { label: t('qualification.program.geography'), value: program.geography },
              {
                label: t('qualification.program.maxValue'),
                value:
                  program.maxContractValue === null
                    ? t('qualification.common.noValueLimit')
                    : formatMoney(program.maxContractValue),
              },
              {
                label: t('qualification.program.validity'),
                value: t('qualification.programs.months', { count: program.validityMonths }),
              },
              {
                label: t('qualification.program.notice'),
                value: t('qualification.programs.notice', { count: program.renewalNoticeDays }),
              },
              {
                label: t('qualification.program.independentApproval'),
                value: program.requiresIndependentApproval
                  ? t('qualification.common.yes')
                  : t('qualification.common.no'),
              },
            ]}
          />
        </Card>
        <Card title={t('qualification.program.areasTitle')}>
          <DetailList
            items={program.areaCounts.map((item) => ({
              key: item.area,
              label: tEnum('qualification_criteria.area', item.area),
              value: t('qualification.program.criteriaCount', {
                total: item.criteria,
                mandatory: item.mandatory,
              }),
            }))}
          />
          {program.description !== null && <p>{program.description}</p>}
        </Card>
      </div>
      {areas.length === 0 ? (
        <EmptyState title={t('qualification.criteria.none')} />
      ) : (
        areas.map((area) => (
          <Card key={area} title={tEnum('qualification_criteria.area', area)}>
            <div className="tiq-stack">
              {program.criteria
                .filter((criterion) => criterion.area === area)
                .map((criterion) => (
                  <section key={criterion.id} className="tiq-stack" aria-label={criterion.question}>
                    <div className="tiq-inline">
                      <strong>{criterion.question}</strong>
                      {criterion.mandatory && (
                        <Chip tone="neutral" size="sm">
                          {t('qualification.common.mandatory')}
                        </Chip>
                      )}
                    </div>
                    <DetailList
                      items={[
                        { label: t('qualification.criteria.guidance'), value: criterion.guidance },
                        {
                          label: t('qualification.criteria.threshold'),
                          value: criterion.thresholdDescription,
                        },
                        {
                          label: t('qualification.criteria.responseType'),
                          value: tEnum(
                            'qualification_criteria.response_type',
                            criterion.responseType,
                          ),
                        },
                        {
                          label: t('qualification.criteria.evidenceTypes'),
                          value: criterion.evidenceTypes
                            .map((value) => tEnum('evidence_items.evidence_type', value))
                            .join(', '),
                        },
                        {
                          label: t('qualification.criteria.naReason'),
                          value: criterion.requiresNaReason
                            ? t('qualification.common.yes')
                            : t('qualification.common.no'),
                        },
                      ]}
                    />
                  </section>
                ))}
            </div>
          </Card>
        ))
      )}
      {applying && (
        <ApplyDialog
          programId={program.id}
          programName={program.name}
          buyerName={program.buyer.name}
          categories={program.coveredCategories}
          defaultCategoryId={program.category.categoryId}
          defaultMaxValue={null}
          defaultGeography={program.geography}
          currency={program.maxContractValue?.currency ?? currency}
          renewalOfDecisionId={null}
          onClose={() => setApplying(false)}
          onCreated={(application) => {
            setApplying(false);
            toast.show(t('qualification.apply.created'), 'success');
            void navigate(supplierQualificationPaths.application(application.id), {
              state: { created: application },
            });
          }}
        />
      )}
    </>
  );
}
