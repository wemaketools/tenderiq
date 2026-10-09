/**
 * ADM-02 — Departments, locations and business classifications (FR-01): departments with their parent, legal
 * entity and head (the reporting relationships), locations, categories mapped to the shared catalog, cost centers
 * and funding sources. Add, revise and deactivate; values are never deleted and historical records keep their
 * descriptions. A customer can keep a simple structure without inventing values it does not need.
 */
import { useState } from 'react';

import { useActiveTenant } from '../../../app/hooks';
import { PageHeader, Tabs } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { OrgLayout } from '../components/OrgLayout';
import { StructureRegister } from '../components/StructureRegister';
import {
  categoryKind,
  costCenterKind,
  departmentKind,
  fundingSourceKind,
  locationKind,
} from '../lib/structureKinds';

type Tab = 'departments' | 'locations' | 'categories' | 'costCenters' | 'fundingSources';

export default function StructurePage() {
  const tenant = useActiveTenant();
  const [tab, setTab] = useState<Tab>('departments');
  return (
    <OrgLayout>
      <PageHeader
        title={t('admin-org.structure.title')}
        subtitle={t('admin-org.structure.intro', { organization: tenant?.name ?? '' })}
      />
      <Tabs
        label={t('admin-org.structure.tabs')}
        selected={tab}
        onSelect={(id) => setTab(id as Tab)}
        tabs={[
          { id: 'departments', label: t('admin-org.structure.departments.tab') },
          { id: 'locations', label: t('admin-org.structure.locations.tab') },
          { id: 'categories', label: t('admin-org.structure.categories.tab') },
          { id: 'costCenters', label: t('admin-org.structure.costCenters.tab') },
          { id: 'fundingSources', label: t('admin-org.structure.fundingSources.tab') },
        ]}
      >
        {tab === 'departments' && <StructureRegister config={departmentKind} />}
        {tab === 'locations' && <StructureRegister config={locationKind} />}
        {tab === 'categories' && <StructureRegister config={categoryKind} />}
        {tab === 'costCenters' && <StructureRegister config={costCenterKind} />}
        {tab === 'fundingSources' && <StructureRegister config={fundingSourceKind} />}
      </Tabs>
    </OrgLayout>
  );
}
