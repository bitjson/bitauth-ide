import {
  IDESupportedProgramState,
  IDETemplateScript,
  ScenarioDetails,
  ScriptDetails,
  ScriptType,
  VariableDetails,
} from '../state/types';

import {
  AuthenticationProgramCommon,
  CompilationResult,
  EvaluationSample,
  StackItemLabel,
  WalletTemplateScriptLocking,
  walletTemplateToCompilerConfiguration,
} from '@bitauth/libauth';
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
   * wallet template.
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

export type IDESupportedAuthenticationProgram = AuthenticationProgramCommon;

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
   * Spacer applied to intermediate lines ending inside a loop.
   *
   * Note that the first line of each loop is instead marked by
   * a {@link EvaluationViewerBeginLoop}.
   */
  loop = 'loop',
  /**
   * Spacer applied to lines ending inside an OP_IF/OP_NOTIF... OP_ENDIF block
   * where the last instruction was skipped, i.e. the top element of
   * `executionStack` is `false`.
   */
  skippedConditional = 'skippedConditional',
}

export type EvaluationViewerBeginLoop = {
  /**
   * The index of this loop in the script source.
   */
  loopIndex: number;
  /**
   * The iteration index of this loop currently being displayed.
   */
  iterationIndex: number;
  /**
   * The maximum iteration index for this loop in the current evaluation.
   */
  maximumIterationIndex: number;
};

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

export type EvaluationViewerLine<
  ProgramState extends IDESupportedProgramState = IDESupportedProgramState,
> = {
  state?: ProgramState;
  spacers?: (EvaluationViewerSpacer | EvaluationViewerBeginLoop)[];
  highlight?: EvaluationViewerHighlight;
};

export type ProjectExplorerTreeNode = {
  active: boolean;
  id: IDETemplateScript['id'];
  children?: ProjectExplorerTreeNode[];
};

export type ScriptEditorFrame<ProgramState extends IDESupportedProgramState> = {
  monacoModel?: monacoEditor.editor.ITextModel;
  /**
   * The `ip` offset of `test-check` scripts.
   */
  ipOffset: number | undefined;
  labels: StackItemLabel[] | undefined;
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
};

/**
 * The computed state required by the EvaluationViewer.
 */
export type EvaluationViewerComputedState = {
  frame: ScriptEditorFrame<IDESupportedProgramState>;
  evaluationTrace: string[];
  evaluationSource: string[];
  lookup?: StackItemIdentifyFunction;
};

export type ComputedEditorState<ProgramState extends IDESupportedProgramState> =

    | EditorStateWelcomeMode
    | EditorStateTemplateSettingsMode
    | EditorStateEntityMode
    | EditorStateScriptMode<ProgramState>
    | EditorStateImportingMode
    | EditorStateWalletMode;

type EditorStateEntityMode = {
  editorMode: ProjectEditorMode.entityEditor;
};

type EditorStateWalletMode = {
  editorMode: ProjectEditorMode.wallet;
};

type EditorStateWelcomeMode = {
  editorMode: ProjectEditorMode.welcome;
};

type EditorStateTemplateSettingsMode = {
  editorMode: ProjectEditorMode.templateSettingsEditor;
};

type EditorStateImportingMode = {
  editorMode: ProjectEditorMode.importing;
};

export type EditorStateScriptMode<
  ProgramState extends IDESupportedProgramState,
> = {
  debugTrace?: IDESupportedProgramState[];
  editorMode:
    | ProjectEditorMode.isolatedScriptEditor
    | ProjectEditorMode.testedScriptEditor
    | ProjectEditorMode.scriptPairEditor;
  /**
   * Set to `undefined` if no compilations were successful (so the previous
   * StackItemIdentifyFunction can continue to be used.)
   */
  identifyStackItems: StackItemIdentifyFunction | undefined;
  isProcessing: boolean;
  isPushed: boolean;
  lockingType: WalletTemplateScriptLocking['lockingType'];
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
  scriptDetails: ScriptDetails;
  scenarioDetails: ScenarioDetails;
  variableDetails: VariableDetails;
  workerDetails: {
    program: IDESupportedAuthenticationProgram | undefined;
    compilerConfiguration: ReturnType<
      typeof walletTemplateToCompilerConfiguration
    >;
    lockingScriptId: string | undefined;
    unlockingScriptId: string | undefined;
    scenarioId: string | undefined;
  };
};
