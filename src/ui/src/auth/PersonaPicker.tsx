/**
 * PersonaPicker: the sign-in choices of the Stage A prototype (DD-50). Every demo persona of the storyline, grouped
 * by organization; choosing one signs in as that persona. There are no passwords in the prototype.
 */
import { useId } from 'react';

import { t } from '../lib/i18n';
import { DEMO_ACCOUNT_GROUPS } from './demoAccountList';

export interface PersonaPickerProps {
  readonly onPick: (email: string) => void;
  readonly disabled?: boolean;
}

export function PersonaPicker({ onPick, disabled = false }: PersonaPickerProps) {
  const baseId = useId();
  return (
    <div className="tiq-demo-accounts">
      {DEMO_ACCOUNT_GROUPS.map((group, index) => (
        <section
          key={group.organization}
          className="tiq-demo-group"
          aria-labelledby={`${baseId}-${index}`}
        >
          <h2 className="tiq-demo-group-title" id={`${baseId}-${index}`}>
            {group.organization}
          </h2>
          <ul className="tiq-demo-list">
            {group.accounts.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className="tiq-demo-account"
                  data-persona={account.email}
                  disabled={disabled}
                  onClick={() => onPick(account.email)}
                  aria-label={t('auth.demo.pick', { name: account.fullName, role: account.role })}
                >
                  {account.fullName}
                  <span className="tiq-demo-account-role">{account.role}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
