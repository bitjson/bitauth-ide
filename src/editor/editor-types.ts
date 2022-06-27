import {
  AuthenticationProgramCommon,
  CompilationResult,
  EvaluationSample,
  AuthenticationTemplateScriptLocking,
  AuthenticationProgramStateAlternateStack,
  AuthenticationProgramStateControlStack,
  AuthenticationProgramStateError,
  AuthenticationProgramStateMinimum,
  AuthenticationProgramStateStack,
  AuthenticationProgramStateCodeSeparator,
  AuthenticationProgramStateSignatureAnalysis,
  AuthenticationProgramStateTransactionContext,
} from '@bitauth/libauth';
import {
  IDETemplateScript,
  ScriptType,
  VariableDetails,
  ScriptDetails,
  ScenarioDetails,
} from '../state/types';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

export enum ProjectEditorMode {
  /**
   * The first visible view when the IDE loads.
   */
  welcome = 'welcome',
  /**
   * Isolated script editing mode – view and edit an isolated script and its
   * associated tests.
   */
  isolatedScriptEditor = 'isolatedScriptEditor',
  /**
   * Script pair editing mode – view and modify an unlocking and locking script
   * pair.
   */
  scriptPairEditor = 'scriptPairEditor',
  /**
   * Script pair editing mode – view and modify an unlocking and locking script
   * pair.
   */
  testedScriptEditor = 'testedScriptEditor',
  /**
   * Entity editing mode – view and modify the setup of an entity.
   */
  entityEditor = 'entityEditor',
  /**
   * Template settings view – view and modify the settings for the current
   * authentication template.
   */
  templateSettingsEditor = 'templateSettingsEditor',
  /**
   * The view visible while the IDE is importing a template from a remote URL.
   */
  importing = 'importing',

  /**
   * Project editor mode returned when the IDE is in wallet mode.
   */
  wallet = 'wallet',
}

export enum ScriptEditorPane {
  /**
   * Present for all ScriptEditor types (`isolated`, `unlocking`, and `test`).
   */
  zero = 'ScriptEditorPane0',
  /**
   * Present for `unlocking` and `test` ScriptEditor types.
   */
  one = 'ScriptEditorPane1',
  /**
   * Only present for the `test` ScriptEditor type.
   */
  two = 'ScriptEditorPane2',
}

export enum ScriptEvaluationViewerPane {
  /**
   * Present for all ScriptEvaluationViewer types (`isolated`, `unlocking`, and
   * `test`).
   */
  zero = 'ScriptEvaluationViewerPane0',
  /**
   * Present for `unlocking` and `test` ScriptEvaluationViewer types.
   */
  one = 'ScriptEvaluationViewerPane1',
  /**
   * Only present for the `test` ScriptEvaluationViewer type.
   */
  two = 'ScriptEvaluationViewerPane2',
}

/**
 * A function which takes the value of a stack item, and returns either the name
 * of the identifier with that value, or `false`.
 */
export type StackItemIdentifyFunction = (value: Uint8Array) => string | false;

export type IDESupportedProgramState = AuthenticationProgramStateMinimum &
  AuthenticationProgramStateStack &
  AuthenticationProgramStateAlternateStack &
  AuthenticationProgramStateControlStack<boolean | number> &
  AuthenticationProgramStateError &
  AuthenticationProgramStateCodeSeparator &
  AuthenticationProgramStateSignatureAnalysis &
  AuthenticationProgramStateTransactionContext;

export interface IDESupportedAuthenticationProgram
  extends AuthenticationProgramCommon {}

/**
 * Visual indicators which indicate nesting – the end of the line being
 * visualized is currently inside the following evaluations/conditional.
 */
export enum EvaluationViewerSpacer {
  /**
   * Spacer applied to lines ending inside an evaluation.
   */
  evaluation = 'evaluation',
  /**
   * Spacer applied to lines ending inside an OP_IF/OP_NOTIF... OP_ENDIF block
   * where the last instruction was executed, i.e. the top element of
   * `executionStack` is `true`.
   */
  executedConditional = 'executedConditional',
  /**
   * Spacer applied to lines ending inside an OP_IF/OP_NOTIF... OP_ENDIF block
   * where the last instruction was skipped, i.e. the top element of
   * `executionStack` is `false`.
   */
  skippedConditional = 'skippedConditional',
}

/**
 * TODO: highlights (and descriptions) for the other failure scenarios
 */
export enum EvaluationViewerHighlight {
  /**
   * Highlight applied to the final line of a successful evaluation.
   */
  success = 'success',
  /**
   * Highlight applied to the final line of a failed evaluation.
   */
  fail = 'fail',
}

export interface EvaluationViewerLine<
  ProgramState extends IDESupportedProgramState = IDESupportedProgramState
> {
  state?: ProgramState;
  spacers?: EvaluationViewerSpacer[];
  highlight?: EvaluationViewerHighlight;
}

export interface ProjectExplorerTreeNode {
  active: boolean;
  id: IDETemplateScript['id'];
  children?: ProjectExplorerTreeNode[];
}

export interface ScriptEditorFrame<
  ProgramState extends IDESupportedProgramState
> {
  monacoModel?: monacoEditor.editor.ITextModel;
  /**
   * `samples` is undefined if there are compilation errors.
   */
  samples: EvaluationSample<ProgramState>[] | undefined;
  scriptName: string;
  scriptId: string;
  scriptInternalId: string;
  script: string;
  scriptType: ScriptType;
  /**
   * `compilation` is undefined if there are scenario generation errors.
   */
  compilation: CompilationResult<ProgramState> | undefined;
  /**
   * `evaluation` is undefined if there are compilation errors.
   */
  evaluationLines: EvaluationViewerLine<ProgramState>[] | undefined;
}

/**
 * The computed state required by the EvaluationViewer.
 */
export interface EvaluationViewerComputedState {
  frame: ScriptEditorFrame<IDESupportedProgramState>;
  evaluationTrace: string[];
  evaluationSource: string[];
  lookup?: StackItemIdentifyFunction;
}

export type ComputedEditorState<ProgramState extends IDESupportedProgramState> =

    | EditorStateWelcomeMode
    | EditorStateTemplateSettingsMode
    | EditorStateEntityMode
    | EditorStateScriptMode<ProgramState>
    | EditorStateImportingMode
    | EditorStateWalletMode;

interface EditorStateEntityMode {
  editorMode: ProjectEditorMode.entityEditor;
}

interface EditorStateWalletMode {
  editorMode: ProjectEditorMode.wallet;
}

interface EditorStateWelcomeMode {
  editorMode: ProjectEditorMode.welcome;
}

interface EditorStateTemplateSettingsMode {
  editorMode: ProjectEditorMode.templateSettingsEditor;
}

interface EditorStateImportingMode {
  editorMode: ProjectEditorMode.importing;
}

export interface EditorStateScriptMode<
  ProgramState extends IDESupportedProgramState
> {
  debugTrace?: IDESupportedProgramState[];
  editorMode:
    | ProjectEditorMode.isolatedScriptEditor
    | ProjectEditorMode.testedScriptEditor
    | ProjectEditorMode.scriptPairEditor;
  scriptEditorFrames: ScriptEditorFrame<ProgramState>[];
  /**
   * An array of the internalIds of scripts which are part of this evaluation.
   * Used by the EvaluationViewer to recognize switches to a new set of scripts
   * (for cache clearing).
   */
  scriptEditorEvaluationTrace: string[];
  /**
   * An array of the source scripts which are part of this evaluation. Used by
   * the EvaluationViewer to recognize viable updates to its cache.
   */
  scriptEditorEvaluationSource: string[];
  lockingType: AuthenticationTemplateScriptLocking['lockingType'];
  isPushed: boolean;
  /**
   * Set to `undefined` if no compilations were successful (so the previous
   * StackItemIdentifyFunction can continue to be used.)
   */
  identifyStackItems: StackItemIdentifyFunction | undefined;
  variableDetails: VariableDetails;
  scriptDetails: ScriptDetails;
  scenarioDetails: ScenarioDetails;
}

/**
 * Object representing the current global settings for all evaluation viewers.
 */
export interface EvaluationViewerSettings {
  /**
   * If `true`, the EvaluationViewer should aggressively attempt to replace
   * valid Script Numbers on the stack with their numerical representation.
   */
  scriptNumbersDisplayFormat: 'hex' | 'integer' | 'binary';
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
}
