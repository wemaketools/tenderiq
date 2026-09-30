/**
 * DemoAccounts: the sign-in quick-pick of LOCAL DEVELOPMENT builds (DD-43). Choosing an account fills its email and
 * the local password and signs in for real through supabase-js. Loaded only behind `import.meta.env.DEV` (see
 * SignInPage), so production builds do not contain it; `scan-bundle` checks the marker.
 */
import { Card } from '../components/ui/Card';
import { t } from '../lib/i18n';
import { DEMO_ACCOUNTS_MARKER, DEMO_ACCOUNT_GROUPS, DEMO_PASSWORD } from './demoAccountList';

export interface DemoAccountsProps {
  readonly onPick: (email: string, password: string) => void;
  readonly disabled?: boolean;
}

export default function DemoAccounts({ onPick, disabled = false }: DemoAccountsProps) {
  return (
    <Card
      className="tiq-demo-accounts"
      title={t('auth.demo.title')}
      subtitle={t('auth.demo.subtitle', { password: DEMO_PASSWORD })}
      data-marker={DEMO_ACCOUNTS_MARKER}
      headingLevel={2}
    >
      {DEMO_ACCOUNT_GROUPS.map((group) => (
        <div key={group.organization} className="tiq-demo-group">
          <h3 className="tiq-demo-group-title">{group.organization}</h3>
          <ul className="tiq-demo-list">
            {group.accounts.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className="tiq-demo-account"
                  disabled={disabled}
                  onClick={() => onPick(account.email, DEMO_PASSWORD)}
                  aria-label={t('auth.demo.pick', { name: account.fullName, role: account.role })}
                >
                  {account.fullName}
                  <span className="tiq-demo-account-role">{account.role}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}
