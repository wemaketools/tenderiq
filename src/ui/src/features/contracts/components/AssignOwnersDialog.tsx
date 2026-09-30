/**
 * Assign the contract owner and the contract manager (CON-01, CON-05). Candidates come from
 * `buyer.contracts.assignees`; the change is confirmed with the acting organization and capacity (COM-02).
 */
import { useState } from 'react';

import { contractsEndpoints } from '@contracts/contracts';
import type { ContractRow } from '@contracts/contracts';

import { ConfirmActionDialog, Select } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { splitCommandError } from '../lib/errors';
import { useContractCommand } from '../lib/hooks';
import { useAssigneeOptions } from '../lib/assignees';
import { idOf } from '../lib/lists';

export interface AssignOwnersDialogProps {
  readonly contract: Pick<ContractRow, 'id' | 'reference' | 'title' | 'owner' | 'contractManager'>;
  readonly open: boolean;
  readonly onClose: () => void;
}

export function AssignOwnersDialog({ contract, open, onClose }: AssignOwnersDialogProps) {
  const owners = useAssigneeOptions('owner', open);
  const managers = useAssigneeOptions('contract_manager', open);
  const [ownerId, setOwnerId] = useState(
    contract.owner === null ? '' : String(contract.owner.userId),
  );
  const [managerId, setManagerId] = useState(
    contract.contractManager === null ? '' : String(contract.contractManager.userId),
  );
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const command = useContractCommand(contractsEndpoints.assignOwners, () =>
    t('contracts.assign.done', { reference: contract.reference }),
  );
  const { dialogError, fieldErrors } = splitCommandError(command.error, [
    'ownerUserId',
    'contractManagerUserId',
  ]);

  const close = (): void => {
    command.reset();
    setLocalError(undefined);
    onClose();
  };

  const confirm = async (): Promise<void> => {
    const ownerUserId = idOf(ownerId);
    const contractManagerUserId = idOf(managerId);
    if (ownerUserId === undefined && contractManagerUserId === undefined) {
      setLocalError(t('contracts.assign.required'));
      return;
    }
    setLocalError(undefined);
    const body: { ownerUserId?: number; contractManagerUserId?: number } = {};
    if (ownerUserId !== undefined) body.ownerUserId = ownerUserId;
    if (contractManagerUserId !== undefined) body.contractManagerUserId = contractManagerUserId;
    const result = await command.run({ params: { contractId: contract.id }, body });
    if (result !== null) close();
  };

  return (
    <ConfirmActionDialog
      open={open}
      title={t('contracts.assign.title')}
      scope={`${contract.reference} ${contract.title}`}
      consequence={t('contracts.assign.consequence')}
      confirmLabel={t('contracts.assign.confirm')}
      onConfirm={confirm}
      onCancel={close}
      pending={command.pending}
      error={dialogError}
    >
      <Select
        label={t('contracts.assign.owner')}
        placeholder={t('contracts.common.select')}
        value={ownerId}
        options={owners.options}
        onChange={setOwnerId}
        error={fieldErrors.forField('ownerUserId') ?? localError}
      />
      <Select
        label={t('contracts.assign.manager')}
        hint={t('contracts.assign.managerHint')}
        placeholder={t('contracts.common.select')}
        value={managerId}
        options={managers.options}
        onChange={setManagerId}
        error={fieldErrors.forField('contractManagerUserId')}
      />
    </ConfirmActionDialog>
  );
}
