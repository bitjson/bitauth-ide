import {
  ideImportAuthenticationTemplate,
  exportAuthenticationTemplate,
} from './import-export';
import { AuthenticationTemplate } from '@bitauth/libauth';
import { IDETemplate } from './types';

// TODO: add a tested and untested isolated script

const twoOfTwoRecoverableTemplate: AuthenticationTemplate = {
  name: '2-of-2 Recoverable Vault',
  $schema: 'https://bitauth.com/schemas/authentication-template-v0.schema.json',
  description:
    'A 2-of-2 wallet, which after a specified delay, can be recovered by either of the original two keys and a signature from a trusted user (e.g. an attorney).\n\nIn this implementation, all wallet addresses become recoverable at the same time. To "bump" the recovery time to a later date, create a new wallet and transfer the funds.\n\nThis scheme is described in more detail in BIP-65.',
  entities: {
    signer_1: {
      description:
        'One of the two co-owners of this wallet. If Signer 1 is unable to sign, Signer 2 and Trusted Party can recover funds after 30 days.',
      name: 'Signer 1',
      scripts: ['lock', 'spend', 'recover_1'],
      variables: {
        delay_seconds: {
          description:
            'The waiting period (from the time the wallet is created) after which the Trusted Party can assist with delayed recoveries. The delay is measured in seconds, e.g. 1 day is 86400, 30 days is 2592000.',
          name: 'Recovery Delay (Seconds)',
          type: 'WalletData',
        },
        first: {
          description: '',
          name: "Signer 1's HdKey",
          type: 'HdKey',
        },
      },
    },
    signer_2: {
      description:
        'One of the two co-owners of this wallet. If Signer 2 is unable to sign, Signer 1 and Trusted Party can recover funds after the specified delay.',
      name: 'Signer 2',
      scripts: ['lock', 'spend', 'recover_2'],
      variables: {
        second: {
          description: '',
          name: "Signer 2's HdKey",
          type: 'HdKey',
        },
      },
    },
    trusted_party: {
      description:
        "A trusted party, like a lawyer or trusted employee. If either signer is unable to sign, after the specified delay, Trusted Party can help to recover funds by co-signing on that signer's behalf.",
      name: 'Trusted Party',
      scripts: ['lock', 'recover_1', 'recover_2'],
      variables: {
        trusted: {
          description: '',
          name: "Trusted Party's HdKey",
          type: 'HdKey',
        },
      },
    },
  },
  scripts: {
    lock: {
      lockingType: 'p2sh20',
      name: '2-of-2 Recoverable Vault',
      script:
        'OP_IF\n  <$(\n    <current_block_time> <delay_seconds>\n    OP_ADD\n  )>\n  OP_CHECKLOCKTIMEVERIFY OP_DROP\n  <trusted.public_key>\n  OP_CHECKSIGVERIFY\n  <1>\nOP_ELSE\n  <2>\nOP_ENDIF\n<first.public_key> <second.public_key> <2>\nOP_CHECKMULTISIG',
    },
    recover_1: {
      name: 'Recover – Signer 1',
      script:
        '<0>\n<first.signature.all_outputs>\n<trusted.signature.all_outputs>\n<1>',
      timeLockType: 'timestamp',
      unlocks: 'lock',
    },
    recover_2: {
      name: 'Recover – Signer 2',
      script:
        '<0>\n<second.signature.all_outputs>\n<trusted.signature.all_outputs>\n<1>',
      timeLockType: 'timestamp',
      unlocks: 'lock',
    },
    spend: {
      name: 'Standard Spend',
      script:
        '<0>\n<first.signature.all_outputs>\n<second.signature.all_outputs>\n<0>',
      unlocks: 'lock',
    },
  },
  supported: ['BCH_2022_05'],
  version: 0,
};

const twoOfTwoRecoverableIDETemplate: IDETemplate = {
  description: twoOfTwoRecoverableTemplate.description as string,
  entitiesByInternalId: {
    'ID-0': {
      description: twoOfTwoRecoverableTemplate.entities['signer_1']
        .description as string,
      id: 'signer_1',
      internalId: 'ID-0',
      name: 'Signer 1',
      scriptInternalIds: ['ID-3', 'ID-6', 'ID-4'],
      usesAllScripts: false,
      variableInternalIds: ['ID-7', 'ID-8'],
    },
    'ID-1': {
      description: twoOfTwoRecoverableTemplate.entities['signer_2']
        .description as string,
      id: 'signer_2',
      internalId: 'ID-1',
      name: 'Signer 2',
      scriptInternalIds: ['ID-3', 'ID-6', 'ID-5'],
      usesAllScripts: false,
      variableInternalIds: ['ID-9'],
    },
    'ID-2': {
      description: twoOfTwoRecoverableTemplate.entities['trusted_party']
        .description as string,
      id: 'trusted_party',
      internalId: 'ID-2',
      name: 'Trusted Party',
      scriptInternalIds: ['ID-3', 'ID-4', 'ID-5'],
      usesAllScripts: false,
      variableInternalIds: ['ID-10'],
    },
  },
  name: '2-of-2 Recoverable Vault',
  scriptsByInternalId: {
    'ID-3': {
      childInternalIds: ['ID-4', 'ID-5', 'ID-6'],
      id: 'lock',
      internalId: 'ID-3',
      lockingType: 'p2sh20',
      name: '2-of-2 Recoverable Vault',
      script: twoOfTwoRecoverableTemplate.scripts['lock'].script,
      type: 'locking',
    },
    'ID-4': {
      ageLock: undefined,
      estimate: undefined,
      failsInternalIds: [],
      id: 'recover_1',
      internalId: 'ID-4',
      name: 'Recover – Signer 1',
      parentInternalId: 'ID-3',
      passesInternalIds: [],
      script: twoOfTwoRecoverableTemplate.scripts['recover_1'].script,
      timeLockType: 'timestamp',
      type: 'unlocking',
    },
    'ID-5': {
      ageLock: undefined,
      estimate: undefined,
      failsInternalIds: [],
      id: 'recover_2',
      internalId: 'ID-5',
      name: 'Recover – Signer 2',
      parentInternalId: 'ID-3',
      passesInternalIds: [],
      script: twoOfTwoRecoverableTemplate.scripts['recover_2'].script,
      timeLockType: 'timestamp',
      type: 'unlocking',
    },
    'ID-6': {
      ageLock: undefined,
      estimate: undefined,
      failsInternalIds: [],
      id: 'spend',
      internalId: 'ID-6',
      name: 'Standard Spend',
      parentInternalId: 'ID-3',
      passesInternalIds: [],
      script: twoOfTwoRecoverableTemplate.scripts['spend'].script,
      timeLockType: undefined,
      type: 'unlocking',
    },
  },
  scenariosByInternalId: {},
  supportedVirtualMachines: ['BCH_2022_05'],
  variablesByInternalId: {
    'ID-10': {
      description: '',
      id: 'trusted',
      internalId: 'ID-10',
      name: "Trusted Party's HdKey",
      type: 'HdKey',
    },
    'ID-7': {
      description:
        'The waiting period (from the time the wallet is created) after which the Trusted Party can assist with delayed recoveries. The delay is measured in seconds, e.g. 1 day is 86400, 30 days is 2592000.',
      id: 'delay_seconds',
      internalId: 'ID-7',
      name: 'Recovery Delay (Seconds)',
      type: 'WalletData',
    },
    'ID-8': {
      description: '',
      id: 'first',
      internalId: 'ID-8',
      name: "Signer 1's HdKey",
      type: 'HdKey',
    },
    'ID-9': {
      description: '',
      id: 'second',
      internalId: 'ID-9',
      name: "Signer 2's HdKey",
      type: 'HdKey',
    },
  },
};

it('importAuthenticationTemplate (deterministic IDs)', () => {
  const state = { value: 0 };
  const generateId = () => {
    const id = `ID-${state.value}`;
    state.value++;
    return id;
  };

  const result = ideImportAuthenticationTemplate(
    twoOfTwoRecoverableTemplate,
    generateId
  );
  expect(result).toEqual(twoOfTwoRecoverableIDETemplate);
});

it('importAuthenticationTemplate -> exportAuthenticationTemplate (random IDs)', () => {
  const result = ideImportAuthenticationTemplate(twoOfTwoRecoverableTemplate);
  if (typeof result === 'string') {
    fail(result);
  }
  expect(exportAuthenticationTemplate(result)).toEqual(
    twoOfTwoRecoverableTemplate
  );
});

it('exportAuthenticationTemplate', () => {
  expect(exportAuthenticationTemplate(twoOfTwoRecoverableIDETemplate)).toEqual(
    twoOfTwoRecoverableTemplate
  );
});
