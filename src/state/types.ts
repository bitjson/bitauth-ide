import {
  AuthenticationProgramStateAlternateStack,
  AuthenticationProgramStateCodeSeparator,
  AuthenticationProgramStateControlStack,
  AuthenticationProgramStateError,
  AuthenticationProgramStateMinimum,
  AuthenticationProgramStateSignatureAnalysis,
  AuthenticationProgramStateStack,
  AuthenticationProgramStateTransactionContext,
  AuthenticationVirtualMachineIdentifier,
  ScenarioGenerationDebuggingResult,
  WalletTemplate,
  WalletTemplateScenario,
  WalletTemplateScriptLocking,
  WalletTemplateScriptUnlocking,
  WalletTemplateVariable,
} from '@bitauth/libauth';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

export enum IDEMode {
  /**
   * The primary editing mode – an interactive editor and omniscient debugger
   * for Bitauth templates.
   */
  editor = 'editor',
  /**
   * A live-testing mode - manually create transactions to test the current
   * template on the network.
   */
  wallet = 'wallet',
}

export type IDETemplateEntity = {
  id: string;
  internalId: string;
  name: string;
  description: string;
  /**
   * `scriptInternalIds` is only used if `usesAllScripts` is `false`. It's
   * maintained separately to avoid losing data if `usesAllScripts` is toggled.
   */
  scriptInternalIds: string[];
  usesAllScripts: boolean;
  variableInternalIds: string[];
};

/**
 * `IDEVariable`s are equivalent to `WalletTemplateVariable`s except in
 * that they include their own `id` and their assigned `internalId`, and both
 * `name` and `description` are required.
 */
export type IDEVariable = WalletTemplateVariable & {
  description: string;
  id: string;
  internalId: string;
  name: string;
};

/**
 * `IDETemplateScenario`s are equivalent to `WalletTemplateScenario`s
 * except in that they include their own `id` and their assigned `internalId`,
 * and both `name` and `description` are required.
 */
export type IDETemplateScenario = WalletTemplateScenario & {
  description: string;
  id: string;
  internalId: string;
  name: string;
};

export type VariableDetails = {
  [id: string]: {
    variable: WalletTemplateVariable;
    entity: { name: string; id: string };
  };
};

export type ScriptDetails = { [id: string]: IDETemplateScript };

export type ScenarioDetails = {
  /**
   * If the currently active script has no scenarios (and is therefore
   * using the default scenario), `undefined`.
   */
  selectedScenario:
    | undefined
    | {
        description: string;
        expectedToPass: boolean;
        id: string;
        name: string;
      };
  /**
   * The generated scenario or scenario generation error for this evaluation.
   */
  generatedScenario:
    | ScenarioGenerationDebuggingResult<IDESupportedProgramState>
    | string;
  /**
   * A listing of all available scenarios, including the currently active one.
   * If `currentScenario` is undefined, this should be an empty list (since
   * `currentScenario` must be one of the available scenarios if any exist).
   */
  availableScenarios: {
    id: string;
    internalId: string;
    name: string;
  }[];
  /**
   * If verification succeeds, `true`. If verification fails, a string
   * indicating the error. (If there was a compilation error, `undefined`.)
   */
  verifyResult: string | true | undefined;
};

export type ScriptType = BaseScriptType | 'tested' | 'test-check';

export const scriptTypes: { label: string; value: ScriptType }[] = [
  { label: 'Locking Script', value: 'locking' },
  { label: 'Unlocking Script', value: 'unlocking' },
  { label: 'Isolated Script', value: 'isolated' },
  { label: 'Script Test', value: 'test-setup' },
];

export const typeDescriptions: { [key in ScriptType]: string } = {
  locking:
    'Locking scripts hold funds. A locking script is the “challenge” which must be unlocked to spend a transaction output. An “Address” is simply an abstraction for a specific locking script.',
  unlocking:
    'An unlocking script spends from a locking script. To create a transaction, the spender must provide a valid unlocking script for each input being spent. (A locking script can be unlocked by multiple unlocking scripts.)',
  isolated:
    'An isolated script is useful for constructions like checksums or re-usable utility scripts (which can be used inside other scripts). Isolated scripts can have script tests, e.g. utility scripts can be tested to ensure they perform a series of operations properly.',
  'test-setup':
    'A script test is applied to an isolated script. Each script test has a “setup” phase which is evaluated before the tested script, and a “check” phase which is evaluated after. The test passes if the “check” script leaves a single Script Number 1 on the stack.',
  tested:
    'Something is broken: tested scripts should be created by assigning a test-setup script to an isolated script.',
  'test-check':
    'Something is broken: script tests should use the `test-setup` type in this dialog.',
};

export type LockingType = WalletTemplateScriptLocking['lockingType'];

export const lockingTypes: { label: string; value: LockingType }[] = [
  { label: 'P2SH20', value: 'p2sh20' },
  { label: 'P2SH32', value: 'p2sh32' },
  { label: 'Bare (non-P2SH)', value: 'standard' },
];

export const lockingTypeDescriptions: {
  [key in LockingType]: string;
} = {
  p2sh20:
    'This is a P2SH20 script: P2SH20-wrapping bytecode is automatically included during compilation.',
  p2sh32:
    'This is a P2SH32 script. The P2SH32-wrapping bytecode is automatically included during compilation.',
  standard:
    'This is a bare (non-P2SH) script: it is compiled directly into the transaction output without P2SH-wrapping bytecode.',
};

export type BaseScriptType =
  | 'locking'
  | 'unlocking'
  | 'isolated'
  | 'test-setup';

export type IDETemplateScriptBase = {
  type: ScriptType;
  /**
   * The human-readable name of this script.
   */
  name: string;
  /**
   * The script, in CashAssembly.
   */
  script: string;
  /**
   * The id used to refer to the script during compilation and within other
   * scripts.
   */
  id: string;
  internalId: string;
  /**
   * The Monaco Editor model used to edit this script.
   */
  monacoModel?: monacoEditor.editor.ITextModel;
};

export type TestedByScenarios = {
  /**
   * The list of scenario internal IDs which make this script pass evaluation.
   *
   * If empty, the `passes` property can be excluded from the exported template.
   */
  passesInternalIds: NonNullable<WalletTemplateScriptUnlocking['passes']>;
  /**
   * The list of scenario internal IDs which make this script fail evaluation.
   *
   * If empty, the `fails` property can be excluded from the exported template.
   */
  failsInternalIds: NonNullable<WalletTemplateScriptUnlocking['fails']>;
};

export type IDETemplateUnlockingScript = {
  type: 'unlocking';
  parentInternalId: string;
  timeLockType: WalletTemplateScriptUnlocking['timeLockType'];
  ageLock: WalletTemplateScriptUnlocking['ageLock'];
  estimate: WalletTemplateScriptUnlocking['estimate'];
} & IDETemplateScriptBase &
  TestedByScenarios;

export type IDETemplateLockingScript = {
  type: 'locking';
  lockingType: WalletTemplateScriptLocking['lockingType'];
  childInternalIds: string[];
} & IDETemplateScriptBase;

export type IDETemplateIsolatedScript = {
  type: 'isolated';
} & IDETemplateScriptBase;

/**
 * Tested scripts may have multiple `IDETemplateTestSetupScript` children.
 *
 * Each test includes a `setup` script, which runs before the tested
 * script, and a `check` script, which is evaluated after it. If after all three
 * scripts are evaluated, a single `0x01` is left on the stack, the test passes.
 *
 * By testing with separate `setup` and `check` scripts, we can confirm that
 * the tested script works as expected, potentially performing many actions
 * and/or leaving multiple elements on the stack.
 */
export type IDETemplateTestedScript = {
  type: 'tested';
  /**
   * The internal ID of each of this tested script's
   * `IDETemplateTestSetupScript`s.
   */
  childInternalIds: string[];
  pushed: boolean;
} & IDETemplateScriptBase;

export type IDETemplateTestSetupScript = {
  type: 'test-setup';
  testCheckInternalId: string;
  parentInternalId: string;
} & IDETemplateScriptBase &
  TestedByScenarios;

export type IDETemplateTestCheckScript = {
  /**
   * `test-check` scripts share the name of their `test-setup` sibling, since
   * they are both part of the same "test".
   */
  name: '';
  type: 'test-check';
  testSetupInternalId: string;
} & IDETemplateScriptBase;

/**
 * All the script types which are permitted to be "activated" in the editor.
 *
 * In Bitauth IDE, `test-check` scripts are currently tightly-coupled with their
 * sibling `test-setup` scripts. (So the same `test-setup` and `test-check`
 * should always be edited together.) For simplicity, we refer to the pair by
 * it's `test-setup` script.
 */
export type IDEActivatableScript =
  | IDETemplateIsolatedScript
  | IDETemplateUnlockingScript
  | IDETemplateTestSetupScript;

export type IDETemplateScript =
  | IDETemplateLockingScript
  | IDETemplateTestedScript
  | IDETemplateTestCheckScript
  | IDEActivatableScript;

export type DisableId = true;

/**
 * Ordered by import selection preference.
 */
export const IDEVms = [
  'BCH_2023_05',
  'BCH_2025_05',
  'BCH_2026_05',
  'BCH_SPEC',
  'BSV_2020_02',
  'BTC_2017_08',
] as const;
export type IDESupportedVM = (typeof IDEVms)[number];
export type IDEUnsupportedVM = Exclude<
  AuthenticationVirtualMachineIdentifier,
  IDESupportedVM
>;

/**
 * The application dialogs which are managed by Redux.
 */
export enum ActiveDialog {
  none,
  /**
   * The dialog to create a new script in the current template.
   */
  newScript,
  /**
   * The dialog to edit a script's settings.
   */
  editScript,
  /**
   * The dialog to create a new entity in the current template.
   */
  newEntity,
  /**
   * The wallet template import/export dialog.
   */
  importExport,
  /**
   * The dialog to create a new script by importing.
   */
  importScript,
  /**
   * A dialog with guides and help content.
   */
  guide,
}

export type IDETemplate = {
  name: string;
  description: string;
  supportedVirtualMachines: AuthenticationVirtualMachineIdentifier[];
  entitiesByInternalId: { [internalId: string]: IDETemplateEntity };
  scenariosByInternalId: { [internalId: string]: IDETemplateScenario };
  scriptsByInternalId: { [internalId: string]: IDETemplateScript };
  variablesByInternalId: { [internalId: string]: IDEVariable };
};

export enum WalletTreeClass {
  wallet = 'wallet',
  address = 'address',
  utxo = 'utxo',
}

export type IDEWallet = {
  name: string;
  template: WalletTemplate;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletData: any; // TODO: more specific type
  addresses: string[];
  isExpanded: boolean;
  isSelected: boolean;
};

export type IDEAddress = {
  label: string;
  lockingBytecode: Uint8Array;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addressData: any; // TODO: more specific type
  utxos: string[];
  history: { transactionHash: string; balanceChangeSatoshis: number }[];
  isExpanded: boolean;
};
export type IDEUTXOs = {
  satoshis: number;
  confirmedAt: Date | undefined;
};

export type IDEWallets = {
  walletsByInternalId: { [internalId: string]: IDEWallet };
  addressesByInternalId: { [internalId: string]: IDEAddress };
  utxosByChainPath: { [internalId: string]: IDEUTXOs };
};

export type AppState = {
  ideMode: IDEMode;
  /**
   * The internal ID of the script or entity which is currently being edited.
   *
   * Must be an `IDEEditableScript` script (scripts of type, `isolated`,
   * `unlocking`, or `test`) or an entity. Scripts of type `locking` and
   * `tested` can only be edited with one of their "children" scripts.
   */
  currentlyEditingInternalId: string | undefined;
  currentEditingMode:
    | 'welcome'
    | 'script'
    | 'entity'
    | 'template-settings'
    | 'importing';
  /**
   * The state of the Bitauth template currently open in the IDE. This is stored
   * in a significantly different structure than `WalletTemplate`, so it
   * must be serialized and deserialized when copying in and out of the IDE.
   */
  currentTemplate: IDETemplate;
  wallets: IDEWallets;
  /**
   * The internal ID of the wallet currently being viewed in the wallet history
   * explorer.
   */
  currentWalletInternalId: string | undefined;
  /**
   * The internal ID of the scenario currently being tested against in the
   * editor.
   */
  currentScenarioInternalId: string | undefined;
  /**
   * The internal ID of the users most recently selected scenario for testing.
   * Each time a different script is activated, we try to switch back to this
   * scenario (until the user actively chooses a different scenario to test).
   *
   * A more advanced algorithm could use a de-duplicated array of internal IDs
   * for this property: each script activation, we try to activate the most
   * recently chosen scenario (starting from the most recent and working
   * backwards). We don't bother using this stack based approach here because it
   * adds more complexity, is unlikely to be much more helpful in practice, and
   * is hard for users to understand intuitively.
   */
  lastSelectedScenarioInternalId: string | undefined;
  currentVmId: IDESupportedVM;
  evaluationViewerSettings: EvaluationViewerSettings;
  activeDialog: ActiveDialog;
  /**
   * Date from the moment this template was loaded. Set to `undefined` if no
   * template has been loaded yet.
   */
  templateLoadTime: Date | undefined;
  /**
   * If set, contains the stringified contents of the invalid template being
   * imported.
   *
   * This occurs if the user navigates to a sharing link or Gist import which
   * does not validate, usually because it was created with an outdated version
   * of Bitauth IDE. If a pending import exists, the ImportExportDialog should
   * display the pending import rather than the default empty template.
   */
  pendingTemplateImport: string | undefined;
};

export type CurrentScripts = {
  name: string;
  id: string;
  internalId: string;
  type: ScriptType;
}[];

export type CurrentEntities = {
  name: string;
  id: string;
  internalId: string;
}[];

export type CurrentScenarios = {
  name?: string;
  id: string;
  internalId: string;
}[];

export type CurrentVariables = {
  name?: string;
  id: string;
  internalId: string;
}[];

export type IDESupportedProgramState = AuthenticationProgramStateMinimum &
  AuthenticationProgramStateStack &
  AuthenticationProgramStateAlternateStack &
  AuthenticationProgramStateControlStack &
  AuthenticationProgramStateError &
  AuthenticationProgramStateCodeSeparator &
  AuthenticationProgramStateSignatureAnalysis &
  AuthenticationProgramStateTransactionContext;

/**
 * Object representing the current global settings for all evaluation viewers.
 */
export type EvaluationViewerSettings = {
  /**
   * The EvaluationViewer will aggressively attempt to replace valid Script
   * Numbers on the stack with the chosen representation.
   */
  vmNumbersDisplayFormat: 'hex' | 'integer' | 'binary' | 'bigint';
  supportBigInt: boolean;
  /**
   * If `true`, the EvaluationViewer should show the AlternativeStack rather
   * than the normal stack.
   */
  showAlternateStack: boolean;
  /**
   * If `true`, the EvaluationViewer should shorten long stack items by only
   * showing a few of their initial and final bytes. (E.g. `0x1234...7890`.)
   */
  abbreviateLongStackItems: boolean;

  /**
   * Items deeper than this value will be grouped into a single `...`
   * item to prevent cluttering the view. 3 is the default value, as most
   * operations use a maximum of 3 items. (Nearly all other operations only
   * operate on a maximum of 6 items.) If `undefined`, grouping is disabled.
   */
  groupStackItemsDeeperThan: undefined | 3 | 6;

  /**
   * If `true`, reverse the direction of stack items so that new items are
   * pushed from the left. This ensures that the most active part of the stack
   * is displayed first.
   */
  reverseStack: boolean;

  /**
   * If `true`, the viewer will attempt to replace known stack item values with
   * the source variable or script name which produced them (making it easier to
   * follow the origin of specific byte sequences).
   */
  identifyStackItems: boolean;

  /**
   * An array of numbers indicating the iteration index to display of each
   * loop rendered in the EvaluationViewer. Each array item corresponds to a
   * visible loop in source order.
   *
   * Note that this setting is global: when switching between active scripts,
   * the editor attempts to continue displaying the same iteration index as a
   * convenience; this is often useful when reviewing different code paths of
   * the same contract or when switching rapidly between contracts.
   *
   * By design, if any index of the current `loopViewingIndexes` is set to an
   * index which is not valid in the current evaluation, the viewer will
   * automatically display iteration `0` of that particular loop without
   * modifying `loopViewingIndexes`, retaining the user's configured
   * loop-viewing state until the user manually changes the respective loop
   * viewing index. This allows the viewer to maintain the users configured
   * state through program changes which shorten and then revert the number of
   * iterations performed by a particular loop.
   *
   * Note also that tested scripts therefore share loop viewing indexes between
   * the tested script and script test (a useful feature, as the tested script
   * will often iterate in the same way as the tested script).
   */
  loopViewingIndexes: number[];
};
