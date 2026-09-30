/** A malformed record id in the URL: nothing is requested and nothing is revealed. */
import { ButtonLink, Card, EmptyState, PageHeader } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export function RecordNotFound({
  title,
  back,
}: {
  readonly title: string;
  readonly back: { readonly to: string; readonly label: string };
}) {
  return (
    <div className="tiq-page">
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon="alertCircle"
          title={t('ui.error.notFound')}
          action={
            <ButtonLink to={back.to} icon="arrowLeft">
              {back.label}
            </ButtonLink>
          }
        />
      </Card>
    </div>
  );
}
