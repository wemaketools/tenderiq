/**
 * The frame of every buyer selection page: the page column with the workspace sub-navigation under the header.
 */
import type { ReactNode } from 'react';

import { SelectionTabs } from './SelectionTabs';

export interface SelectionPageProps {
  /** The PageHeader of the page (rendered above the tabs). */
  readonly header: ReactNode;
  readonly children: ReactNode;
}

export function SelectionPage({ header, children }: SelectionPageProps) {
  return (
    <div className="tiq-page">
      {header}
      <SelectionTabs />
      {children}
    </div>
  );
}
