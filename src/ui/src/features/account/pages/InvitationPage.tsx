/**
 * COM-01 — Invitation acceptance (`/invite/:token`, DD-27, FR-03): the inviting organization, the capacity and roles
 * the person will act in, who invited them, the masked address and the link's official expiry. Signed out, the
 * page asks the person to sign in (or recover access) first; signed in, they confirm the organization and capacity
 * (COM-02) and accept. Expired, revoked, superseded and already-accepted links are explained without exposing
 * anything else about the organization.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { orgAdminEndpoints } from '@contracts/org-admin';
import type { AcceptInvitationResult, InvitationPreview } from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useAppSelector } from '../../../app/hooks';
import { useAuth } from '../../../auth/authContext';
import {
  Banner,
  ButtonLink,
  Button,
  Card,
  Checkbox,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  ErrorState,
  OfficialDeadline,
  PageHeader,
  SkeletonBlock,
  StatusChip,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { orgAdminErrorMessage, withOrgAdminMessage } from '../../admin-access/lib/errors';

const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

function Explanation({ preview }: { readonly preview: InvitationPreview }) {
  switch (preview.status) {
    case 'expired':
      return (
        <Banner tone="warning" title={t('account.invite.expiredTitle')}>
          <p>{t('account.invite.expiredBody', { organization: preview.organizationName })}</p>
        </Banner>
      );
    case 'revoked':
      return (
        <Banner tone="error" title={t('account.invite.revokedTitle')}>
          <p>{t('account.invite.revokedBody', { organization: preview.organizationName })}</p>
        </Banner>
      );
    case 'reissued':
      return (
        <Banner tone="info" title={t('account.invite.reissuedTitle')}>
          <p>{t('account.invite.reissuedBody')}</p>
        </Banner>
      );
    case 'accepted':
      return (
        <Banner tone="success" title={t('account.invite.acceptedTitle')}>
          <p>{t('account.invite.acceptedBody')}</p>
        </Banner>
      );
    default:
      return null;
  }
}

function Accepted({ result }: { readonly result: AcceptInvitationResult }) {
  return (
    <Banner
      tone="success"
      title={t('account.invite.doneTitle', {
        organization: result.membership.organization.tenantName,
      })}
    >
      <p>
        {result.membership.status === 'active'
          ? t('account.invite.doneActive', { capacity: result.membership.capacity ?? '—' })
          : t('account.invite.donePending')}
      </p>
      {result.userActivated && <p>{t('account.invite.userActivated')}</p>}
      <div className="tiq-inline">
        <ButtonLink to="/select-organization" variant="primary" icon="switchOrg">
          {t('account.invite.enter')}
        </ButtonLink>
        <ButtonLink to="/me/memberships">{t('account.invite.memberships')}</ButtonLink>
      </div>
    </Banner>
  );
}

function PreviewCard({
  token,
  preview,
}: {
  readonly token: string;
  readonly preview: InvitationPreview;
}) {
  const auth = useAuth();
  const signedIn = useAppSelector((state) => state.session.authStatus === 'signedIn');
  const email = useAppSelector((state) => state.session.user?.email ?? state.session.authUserEmail);
  const accept = useApiMutation(orgAdminEndpoints.acceptInvitation);
  const [confirmed, setConfirmed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AcceptInvitationResult | null>(null);
  const acceptable = preview.status === 'pending' || preview.status === 'send_failed';
  const kind = t(`account.kind.${preview.organizationKind}`);

  return (
    <Card
      title={t('account.invite.cardTitle', { organization: preview.organizationName })}
      subtitle={kind}
    >
      <div className="tiq-stack">
        <DetailList
          items={[
            {
              key: 'org',
              label: t('account.invite.organization'),
              value: `${preview.organizationName} (${kind})`,
            },
            { key: 'capacity', label: t('account.invite.capacity'), value: preview.capacity },
            { key: 'roles', label: t('account.invite.roles'), value: preview.roleNames.join(', ') },
            { key: 'by', label: t('account.invite.invitedBy'), value: preview.invitedBy },
            { key: 'email', label: t('account.invite.email'), value: preview.emailMasked },
            {
              key: 'status',
              label: t('account.invite.status'),
              value: <StatusChip enum="invitations.status" value={preview.status} />,
            },
            {
              key: 'expires',
              label: t('account.invite.expires'),
              value: (
                <OfficialDeadline
                  deadline={{ at: preview.expiresAt, timeZone: preview.officialTimeZone }}
                />
              ),
            },
          ]}
        />
        <Explanation preview={preview} />
        {result !== null ? (
          <Accepted result={result} />
        ) : !acceptable ? (
          <p className="tiq-text-muted">{t('account.invite.contactAdmin')}</p>
        ) : !signedIn ? (
          <div className="tiq-stack">
            <p>{t('account.invite.signInFirst', { email: preview.emailMasked })}</p>
            <div className="tiq-inline">
              <ButtonLink
                variant="primary"
                icon="logIn"
                to="/signin"
                state={{ from: `/invite/${token}` }}
              >
                {t('account.invite.signIn')}
              </ButtonLink>
              <ButtonLink to="/forgot-password">{t('account.invite.recover')}</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="tiq-stack">
            <p className="tiq-text-muted">
              {t('account.invite.signedInAs', { email: email ?? '—' })}
            </p>
            {accept.error !== null && (
              <Banner tone="error" title={t('account.invite.failed')}>
                <p>{orgAdminErrorMessage(accept.error)}</p>
              </Banner>
            )}
            <Checkbox
              label={t('account.invite.confirmCapacity', {
                organization: preview.organizationName,
                capacity: preview.capacity ?? t('account.invite.noCapacity'),
              })}
              checked={confirmed}
              onChange={setConfirmed}
            />
            <div className="tiq-inline">
              <Button
                variant="primary"
                icon="check"
                disabled={!confirmed}
                onClick={() => setAsking(true)}
              >
                {t('account.invite.accept')}
              </Button>
            </div>
          </div>
        )}
      </div>
      <ConfirmActionDialog
        open={asking}
        title={t('account.invite.confirmTitle')}
        organization={{ name: preview.organizationName, capacity: preview.capacity }}
        scope={preview.roleNames.join(', ')}
        consequence={t('account.invite.consequence')}
        confirmLabel={t('account.invite.accept')}
        pending={accept.pending}
        error={withOrgAdminMessage(accept.error)}
        onCancel={() => setAsking(false)}
        onConfirm={async () => {
          try {
            const accepted = await accept.mutate({
              params: { token },
              body: { confirmCapacity: true },
            });
            setResult(accepted);
            setAsking(false);
            auth.reloadContext();
          } catch {
            // Shown in the dialog and on the page.
          }
        }}
      />
    </Card>
  );
}

export default function InvitationPage() {
  const token = useParams().token ?? '';
  const valid = TOKEN.test(token);
  const query = useApiQuery(
    orgAdminEndpoints.previewInvitation,
    valid ? { params: { token } } : null,
  );
  let body;
  if (!valid) {
    body = (
      <EmptyState
        icon="alertTriangle"
        title={t('account.invite.invalidTitle')}
        description={t('account.invite.invalidBody')}
      />
    );
  } else if (query.error !== null && query.data === undefined) {
    body =
      query.error.kind === 'not_found' ? (
        <EmptyState
          icon="alertTriangle"
          title={t('account.invite.invalidTitle')}
          description={t('account.invite.invalidBody')}
        />
      ) : (
        <ErrorState error={query.error} onRetry={query.reload} />
      );
  } else if (query.data === undefined) {
    body = <SkeletonBlock lines={6} />;
  } else {
    body = <PreviewCard token={token} preview={query.data} />;
  }
  return (
    <div className="tiq-page">
      <PageHeader title={t('account.invite.title')} subtitle={t('account.invite.intro')} />
      {body}
      <p className="tiq-text-muted">{t('account.invite.privacy')}</p>
    </div>
  );
}
