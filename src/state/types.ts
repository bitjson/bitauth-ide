import {
  AuthenticationTemplateVariable,
  AuthenticationVirtualMachineIdentifier,
  AuthenticationTemplate,
  AuthenticationTemplateScriptUnlocking,
  AuthenticationTemplateScenario,
  Scenario,
  AuthenticationTemplateScriptLocking,
} from '@bitauth/libauth';
import { EvaluationViewerSettings } from '../editor/editor-types';
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

export interface IDETemplateEntity {
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
}

/**
 * `IDEVariable`s are equivalent to `AuthenticationTemplateVariable`s except in
 * that they include their own `id` and their assigned `internalId`, and both
 * `name` and `description` are required.
 */
export type IDEVariable = AuthenticationTemplateVariable & {
  description: string;
  id: string;
  internalId: string;
  name: string;
};

/**
 * `IDETemplateScenario`s are equivalent to `AuthenticationTemplateScenario`s
 * except in that they include their own `id` and their assigned `internalId`,
 * and both `name` and `description` are required.
 */
export type IDETemplateScenario = AuthenticationTemplateScenario & {
  description: string;
  id: string;
  internalId: string;
  name: string;
};

export type VariableDetails = {
  [id: string]: {
    variable: AuthenticationTemplateVariable;
    entity: { name: string; id: string };
  };
};

export type ScriptDetails = {
  [id: string]: IDETemplateScript;
};

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
        /**
         * If verification succeeds, `true`. If verification fails, a string
         * indicating the error. (If there was a compilation error, `undefined`.)
         */
        verifyResult: string | true | undefined;
      };
  /**
   * The generated scenario or scenario generation error for this evaluation.
   */
  generatedScenario: Scenario | string;
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
};

export type ScriptType = BaseScriptType | 'tested' | 'test-check';

export type BaseScriptType =
  | 'locking'
  | 'unlocking'
  | 'isolated'
  | 'test-setup';

export interface IDETemplateScriptBase {
  type: ScriptType;
  /**
   * The human-readable name of this script.
   */
  name: string;
  /**
   * The script, in the Bitauth Templating Language (BTL).
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
}

export interface TestedByScenarios {
  /**
   * The list of scenario internal IDs which make this script pass evaluation.
   *
   * If empty, the `passes` property can be excluded from the exported template.
   */
  passesInternalIds: NonNullable<
    AuthenticationTemplateScriptUnlocking['passes']
  >;
  /**
   * The list of scenario internal IDs which make this script fail evaluation.
   *
   * If empty, the `fails` property can be excluded from the exported template.
   */
  failsInternalIds: NonNullable<AuthenticationTemplateScriptUnlocking['fails']>;
}

export interface IDETemplateUnlockingScript
  extends IDETemplateScriptBase,
    TestedByScenarios {
  type: 'unlocking';
  parentInternalId: string;
  timeLockType: AuthenticationTemplateScriptUnlocking['timeLockType'];
  ageLock: AuthenticationTemplateScriptUnlocking['ageLock'];
  estimate: AuthenticationTemplateScriptUnlocking['estimate'];
}

export interface IDETemplateLockingScript extends IDETemplateScriptBase {
  type: 'locking';
  lockingType: AuthenticationTemplateScriptLocking['lockingType'];
  childInternalIds: string[];
}

export interface IDETemplateIsolatedScript extends IDETemplateScriptBase {
  type: 'isolated';
}

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
export interface IDETemplateTestedScript extends IDETemplateScriptBase {
  type: 'tested';
  /**
   * The internal ID of each of this tested script's
   * `IDETemplateTestSetupScript`s.
   */
  childInternalIds: string[];
  pushed: boolean;
}

export interface IDETemplateTestSetupScript
  extends IDETemplateScriptBase,
    TestedByScenarios {
  type: 'test-setup';
  testCheckInternalId: string;
  parentInternalId: string;
}

export interface IDETemplateTestCheckScript extends IDETemplateScriptBase {
  /**
   * `test-check` scripts share the name of their `test-setup` sibling, since
   * they are both part of the same "test".
   */
  name: '';
  type: 'test-check';
  testSetupInternalId: string;
}

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

export type IDESupportedVM =
  | 'BCH_2022_05'
  | 'BCH_SPEC'
  | 'BSV_2020_02'
  | 'BTC_2017_08';
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
   * The authentication template import/export dialog.
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

export interface IDETemplate {
  name: string;
  description: string;
  supportedVirtualMachines: AuthenticationVirtualMachineIdentifier[];
  entitiesByInternalId: { [internalId: string]: IDETemplateEntity };
  scenariosByInternalId: { [internalId: string]: IDETemplateScenario };
  scriptsByInternalId: {
    [internalId: string]: IDETemplateScript;
  };
  variablesByInternalId: {
    [internalId: string]: IDEVariable;
  };
}

export enum WalletTreeClass {
  wallet = 'wallet',
  address = 'address',
  utxo = 'utxo',
}

export interface IDEWallet {
  name: string;
  template: AuthenticationTemplate;
  walletData: any; // TODO: more specific type
  addresses: string[];
  isExpanded: boolean;
  isSelected: boolean;
}

export interface IDEAddress {
  label: string;
  lockingBytecode: Uint8Array;
  addressData: any; // TODO: more specific type
  utxos: string[];
  history: { transactionHash: string; balanceChangeSatoshis: number }[];
  isExpanded: boolean;
}
export interface IDEUTXOs {
  satoshis: number;
  confirmedAt: Date | undefined;
}

export interface IDEWallets {
  walletsByInternalId: {
    [internalId: string]: IDEWallet;
  };
  addressesByInternalId: {
    [internalId: string]: IDEAddress;
  };
  utxosByChainPath: {
    [internalId: string]: IDEUTXOs;
  };
}

export interface AppState {
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
   * in a significantly different structure than `AuthenticationTemplate`, so it
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
}

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
