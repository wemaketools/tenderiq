/**
 * Contracts feature (FR-18, FR-19): the contract register and workspace for buyers (CON-01 … CON-11) and the
 * supplier's own contracts (SUP-23).
 */
import type { FeatureModule } from '../../app/featureRegistry';
import {
  CONTRACT_FINANCIALS,
  CONTRACT_PREPARE,
  CONTRACT_VIEW,
  SUPPLIER_CONTRACT_READ,
} from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'contracts',
    area: 'buyer',
    routes: [
      {
        path: 'contracts',
        load: () => import('./pages/ContractRegisterPage'),
        permission: CONTRACT_VIEW,
        title: 'contracts.register.title',
      },
      {
        path: 'contracts/new',
        load: () => import('./pages/NewContractPage'),
        permission: CONTRACT_PREPARE,
        title: 'contracts.create.title',
      },
      {
        path: 'contracts/:contractId',
        load: () => import('./pages/ContractOverviewPage'),
        permission: CONTRACT_VIEW,
        title: 'contracts.screens.CON-05',
      },
      {
        path: 'contracts/:contractId/preparation',
        load: () => import('./pages/ContractPreparationPage'),
        permission: CONTRACT_VIEW,
        title: 'contracts.screens.CON-02',
      },
      {
        path: 'contracts/:contractId/signature',
        load: () => import('./pages/SignaturePage'),
        permission: CONTRACT_VIEW,
        title: 'contracts.screens.CON-03',
      },
      {
        path: 'contracts/:contractId/handover',
        load: () => import('./pages/HandoverPage'),
        permission: CONTRACT_VIEW,
        title: 'contracts.screens.CON-04',
      },
      {
        path: 'contracts/:contractId/milestones',
        load: () => import('./pages/MilestonesPage'),
        permission: CONTRACT_VIEW,
        title: 'contracts.screens.CON-06',
      },
      {
        path: 'contracts/:contractId/obligations/:obligationId',
        load: () => import('./pages/ObligationPage'),
        permission: CONTRACT_VIEW,
        title: 'contracts.screens.CON-06',
      },
      {
        path: 'contracts/:contractId/performance',
        load: () => import('./pages/PerformancePage'),
        permission: CONTRACT_VIEW,
        title: 'contracts.screens.CON-07',
      },
      {
        path: 'contracts/:contractId/financials',
        load: () => import('./pages/FinancialsPage'),
        permission: CONTRACT_FINANCIALS,
        title: 'contracts.screens.CON-08',
      },
      {
        path: 'contracts/:contractId/changes',
        load: () => import('./pages/ChangesPage'),
        permission: CONTRACT_VIEW,
        title: 'contracts.screens.CON-09',
      },
      {
        path: 'contracts/:contractId/renewals',
        load: () => import('./pages/RenewalsPage'),
        permission: CONTRACT_VIEW,
        title: 'contracts.screens.CON-10',
      },
      {
        path: 'contracts/:contractId/closeout',
        load: () => import('./pages/CloseoutPage'),
        permission: CONTRACT_VIEW,
        title: 'contracts.screens.CON-11',
      },
    ],
    nav: [
      {
        id: 'buyer.contracts',
        label: 'contracts.nav.buyer',
        path: 'contracts',
        section: 'contracts',
        order: 10,
        icon: 'fileSignature',
        permission: CONTRACT_VIEW,
        sectionAction: {
          label: 'contracts.register.new',
          path: 'contracts/new',
          icon: 'plus',
          permission: 'contract.prepare',
        },
      },
    ],
  },
  {
    id: 'contracts-supplier',
    area: 'supplier',
    routes: [
      {
        path: 'contracts',
        load: () => import('./pages/supplier/SupplierContractsPage'),
        permission: SUPPLIER_CONTRACT_READ,
        title: 'contracts.supplier.title',
      },
      {
        path: 'contracts/:contractId',
        load: () => import('./pages/supplier/SupplierContractPage'),
        permission: SUPPLIER_CONTRACT_READ,
        title: 'contracts.supplier.title',
      },
    ],
    nav: [
      {
        id: 'supplier.contracts',
        label: 'contracts.nav.supplier',
        path: 'contracts',
        section: 'contracts',
        order: 10,
        icon: 'fileSignature',
        permission: SUPPLIER_CONTRACT_READ,
      },
    ],
  },
];
