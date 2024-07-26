import './HeaderBar.css';
import { wrapInterfaceTooltip } from '../editor/common';
import { GuideDialog } from '../editor/dialogs/guide-dialog/GuideDialog';
import { workingOnWalletMode } from '../state/defaults';
import { ActionCreators } from '../state/reducer';
import {
  ActiveDialog,
  AppState,
  IDEMode,
  IDESupportedVM,
} from '../state/types';

import { AuthenticationVirtualMachineIdentifier } from '@bitauth/libauth';
import {
  Button,
  MenuItem,
  Popover,
  PopoverInteractionKind,
} from '@blueprintjs/core';
import { Chat, Manual, Notifications } from '@blueprintjs/icons';
import { ItemRenderer, Select } from '@blueprintjs/select';
import { useState } from 'react';
import { connect } from 'react-redux';

type IDESupportedModes = {
  id: IDEMode;
  name: string;
  disabled: boolean;
};

type IDESupportedVirtualMachine =
  | {
      id: IDESupportedVM;
      name: string;
      disabled: boolean;
    }
  | {
      id: AuthenticationVirtualMachineIdentifier;
      name: string;
      disabled: true;
    };

const ideModes: IDESupportedModes[] = [
  { id: IDEMode.editor, name: 'Editor Mode', disabled: false },
  { id: IDEMode.wallet, name: 'Wallet Mode', disabled: !workingOnWalletMode },
];

const vms: IDESupportedVirtualMachine[] = [
  { id: 'BCH_2023_05', name: 'BCH 2023 VM', disabled: false },
  // { id: 'BCH_2025_05', name: 'BCH 2025 VM', disabled: false },
  // { id: 'BCH_2026_05', name: 'BCH 2026 VM', disabled: false },
  { id: 'BCH_SPEC', name: 'BCH SPEC VM', disabled: false },
  { id: 'BTC_2017_08', name: 'BTC 2017 VM', disabled: true },
  { id: 'BSV_2020_02', name: 'BSV 2020 VM', disabled: true },
  { id: 'XEC_2020_05', name: 'XEC 2020 VM', disabled: true },
];

const renderMode: ItemRenderer<IDESupportedModes> = (
  ideMode,
  { handleClick, modifiers },
) => {
  return (
    <MenuItem
      active={modifiers.active}
      key={ideMode.id}
      label={ideMode.disabled ? '(Not Yet Available)' : ''}
      onClick={handleClick}
      text={ideMode.name}
      disabled={ideMode.disabled}
    />
  );
};

const renderVm: ItemRenderer<IDESupportedVirtualMachine> = (
  vm,
  { handleClick, modifiers },
) => {
  return (
    <MenuItem
      active={modifiers.active}
      key={vm.id}
      label={vm.disabled ? '(See GitHub Issues)' : ''}
      onClick={handleClick}
      text={vm.name}
      disabled={vm.disabled}
    />
  );
};

type HeaderDispatch = {
  activateVm: typeof ActionCreators.activateVm;
  closeDialog: typeof ActionCreators.closeDialog;
  openGuide: typeof ActionCreators.openGuide;
  setIDEMode: typeof ActionCreators.setIDEMode;
};
type HeaderProps = {
  activeDialog: ActiveDialog;
  currentVmId: IDESupportedVM;
  ideMode: IDEMode;
  supportedVirtualMachines: AuthenticationVirtualMachineIdentifier[];
} & HeaderDispatch;

const selectVm = (vmId: IDESupportedVM) =>
  vms.find((vm) => vm.id === vmId) ?? vms[0]!;

export const HeaderBar = connect(
  (state: AppState) => ({
    activeDialog: state.activeDialog,
    currentVmId: state.currentVmId,
    ideMode: state.ideMode,
    supportedVirtualMachines: state.currentTemplate.supportedVirtualMachines,
  }),
  {
    activateVm: ActionCreators.activateVm,
    closeDialog: ActionCreators.closeDialog,
    openGuide: ActionCreators.openGuide,
    setIDEMode: ActionCreators.setIDEMode,
  },
)((props: HeaderProps) => {
  const [introPopoverVisible, setIntroPopoverVisible] = useState(false);
  // TODO: hack to give Notifier control
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  (window as any).setIntroPopoverVisible = setIntroPopoverVisible;
  const currentIDEMode = ideModes.find((mode) => mode.id === props.ideMode);
  if (currentIDEMode === undefined) {
    throw new Error('Invalid IDE Mode');
  }
  return (
    <div className="HeaderBar">
      <div className="left-section">
        <h1 className="app-title">
          <span className="bitauth">bitauth</span>
          <span className="ide">IDE</span>
        </h1>
        <Popover
          portalClassName="intro-popover"
          content={<p>New to Bitauth IDE? Check out the guide!</p>}
          interactionKind={PopoverInteractionKind.CLICK}
          isOpen={introPopoverVisible}
          onInteraction={(state) => {
            if (!state) {
              setIntroPopoverVisible(false);
            }
          }}
        >
          {wrapInterfaceTooltip(
            <button
              className="link"
              onClick={() => props.openGuide()}
              tabIndex={1}
            >
              <Manual size={12} /> Guide
            </button>,
            'Open the Bitauth IDE guide.',
          )}
        </Popover>
        {wrapInterfaceTooltip(
          <a
            className="link"
            href="https://t.me/bitauth_ide"
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={2}
          >
            <Chat size={12} /> Join Chat
          </a>,
          'Get help or share feedback in the community Telegram group →',
        )}
        {wrapInterfaceTooltip(
          <a
            className="link github-logo"
            href="https://github.com/bitauth/bitauth-ide/issues"
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={3}
          >
            {/* Icon from: https://simpleicons.org/ */}
            <svg
              role="img"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>GitHub</title>
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
            Report a bug
          </a>,
          'Please report bugs in our GitHub issue tracker →',
        )}
        {wrapInterfaceTooltip(
          <a
            className="link"
            href="https://twitter.com/BitauthIDE"
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={4}
          >
            <Notifications size={12} /> Get updates
          </a>,
          'Get updates about Bitauth IDE on Twitter →',
        )}
      </div>
      <div className="right-section">
        <div className="ide-mode-select">
          <Select<IDESupportedModes>
            itemRenderer={renderMode}
            items={ideModes}
            onItemSelect={(e) => props.setIDEMode(e.id)}
            activeItem={currentIDEMode}
            filterable={false}
          >
            <Button text={currentIDEMode.name} rightIcon="caret-down" />
          </Select>
        </div>
        <div className="vm-select">
          <Select<IDESupportedVirtualMachine>
            itemRenderer={renderVm}
            items={vms}
            onItemSelect={(item) => {
              const vmId = item.id as IDESupportedVM;
              if (props.supportedVirtualMachines.includes(vmId)) {
                props.activateVm(vmId);
              } else {
                window.alert(
                  `This template is not configured to support the ${item.name}. To switch to this VM, first enable support for it in the template settings.`,
                );
              }
            }}
            activeItem={selectVm(props.currentVmId)}
            filterable={false}
          >
            <Button
              text={selectVm(props.currentVmId).name}
              rightIcon="caret-down"
            />
          </Select>
        </div>
      </div>
      <GuideDialog
        activeDialog={props.activeDialog}
        closeDialog={props.closeDialog}
      />
    </div>
  );
});
