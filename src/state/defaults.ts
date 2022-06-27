import { AppState, ActiveDialog, IDESupportedVM } from './types';
import { IDEMode } from './types';
import { AuthenticationTemplate } from '@bitauth/libauth';
import { ideImportAuthenticationTemplate } from './import-export';
import { isImportRoute } from '../init/routing';
import { bitauthAuthenticationTemplateSchema } from '../editor/constants';

// TODO: finish wallet mode, remove
export const workingOnWalletMode = false;

export const emptyTemplate: AuthenticationTemplate = {
  $schema: bitauthAuthenticationTemplateSchema,
  description: '',
  name: 'Untitled',
  entities: {},
  scripts: {},
  supported: ['BCH_2022_05', 'BCH_SPEC'] as IDESupportedVM[],
  version: 0 as 0,
};

const defaultTemplate = ideImportAuthenticationTemplate(emptyTemplate);
if (typeof defaultTemplate === 'string') {
  throw new Error(`Invalid empty template: ${defaultTemplate}`);
}

const someTxHash =
  '978306aa4e02fd06e251b38d2e961f78f4af2ea6524a3e4531126776276a6af1';

export const defaultState: AppState = {
  ideMode: workingOnWalletMode ? IDEMode.wallet : IDEMode.editor,
  currentlyEditingInternalId: undefined,
  currentEditingMode: isImportRoute() ? 'importing' : 'welcome',
  currentScenarioInternalId: undefined,
  lastSelectedScenarioInternalId: undefined,
  currentTemplate: defaultTemplate,
  currentVmId: 'BCH_2022_05',
  evaluationViewerSettings: {
    abbreviateLongStackItems: true,
    groupStackItemsDeeperThan: 3,
    scriptNumbersDisplayFormat: 'integer',
    reverseStack: false,
    showAlternateStack: false,
    identifyStackItems: true,
  },
  activeDialog: ActiveDialog.none,
  templateLoadTime: undefined,
  pendingTemplateImport: undefined,
  wallets: {
    walletsByInternalId: {
      '6aeeb5f3-7c96-4a57-bd4c-3c2775cdbc15': {
        name: 'IDE Wallet',
        template: emptyTemplate,
        addresses: [
          'e1e8656b-b3f2-40a9-8deb-c226c230c33c',
          '95136d31-7efa-4642-8a1a-fadee4de9265',
        ],
        walletData: {},
        isExpanded: true,
        isSelected: true,
      },
      '9e26f573-b7a3-4596-9a39-998528ce45f7': {
        name: 'Template Wallet',
        template: emptyTemplate,
        addresses: ['ebbaf670-3c9a-4c76-b3e0-b3aaa989acc8'],
        walletData: {},
        isExpanded: true,
        isSelected: false,
      },
    },
    addressesByInternalId: {
      'e1e8656b-b3f2-40a9-8deb-c226c230c33c': {
        label: 'bchtest:pr6m7j9njldwwzlg9v7v53unlr4jkmx6eyvwc0uz5t',
        addressData: {},
        lockingBytecode: Uint8Array.of(0),
        isExpanded: true,
        utxos: [
          'b457e5abf72872659c77d3e3903dc47d344d952643ae62e852ba2eef91c6dce4/0',
        ],
        history: [
          {
            transactionHash: someTxHash,
            balanceChangeSatoshis: 1000000,
          },
          {
            transactionHash: someTxHash,
            balanceChangeSatoshis: -500000,
          },
        ],
      },
      'ebbaf670-3c9a-4c76-b3e0-b3aaa989acc8': {
        label: 'bchtest:anotheroneherelg9v7v53unlr4jkmx6eyvwc0uz5t',
        addressData: {},
        lockingBytecode: Uint8Array.of(0),
        isExpanded: true,
        utxos: [
          'b457e5abf72872659c77d3e3903dc47d344d952643ae62e852ba2eef91c6dce4/2',
        ],
        history: [
          {
            transactionHash: someTxHash,
            balanceChangeSatoshis: 1000000,
          },
          {
            transactionHash: someTxHash,
            balanceChangeSatoshis: -500000,
          },
        ],
      },
      '95136d31-7efa-4642-8a1a-fadee4de9265': {
        label: 'bchtest:anotheronedwwzlg9v7v53unlr4jkmx6eyvwc0uz5t',
        addressData: {},
        lockingBytecode: Uint8Array.of(0),
        isExpanded: true,
        utxos: [
          'b457e5abf72872659c77d3e3903dc47d344d952643ae62e852ba2eef91c6dce4/1',
          '1eedc0a42a7330de91bf20cefcd3941633de8650e8d92beb1a7b0ba350d30246/0',
          '617e49c1ed3ffb2480e04d82af8ccbce09d9fd68ee8b8cb9ebe6aeac79ec6e9b/1',
        ],
        history: [
          {
            transactionHash: someTxHash,
            balanceChangeSatoshis: 1000000,
          },
          {
            transactionHash: someTxHash,
            balanceChangeSatoshis: -500000,
          },
        ],
      },
    },
    utxosByChainPath: {
      'b457e5abf72872659c77d3e3903dc47d344d952643ae62e852ba2eef91c6dce4/0': {
        satoshis: 10000000,
        confirmedAt: new Date(1579881846933),
      },
      'b457e5abf72872659c77d3e3903dc47d344d952643ae62e852ba2eef91c6dce4/1': {
        satoshis: 20000000,
        confirmedAt: new Date(1579881846933),
      },
      'b457e5abf72872659c77d3e3903dc47d344d952643ae62e852ba2eef91c6dce4/2': {
        satoshis: 30000000,
        confirmedAt: new Date(1579881846933),
      },
      '1eedc0a42a7330de91bf20cefcd3941633de8650e8d92beb1a7b0ba350d30246/0': {
        satoshis: 40000000,
        confirmedAt: new Date(1579881846933),
      },
      '617e49c1ed3ffb2480e04d82af8ccbce09d9fd68ee8b8cb9ebe6aeac79ec6e9b/1': {
        satoshis: 50000000,
        confirmedAt: new Date(1579881846933),
      },
    },
  },
  currentWalletInternalId: '6aeeb5f3-7c96-4a57-bd4c-3c2775cdbc15',
};
