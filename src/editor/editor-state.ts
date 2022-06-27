import {
  AppState,
  IDETemplateLockingScript,
  IDEActivatableScript,
  IDETemplateTestedScript,
  VariableDetails,
  IDEMode,
  ScenarioDetails,
  ScriptDetails,
} from '../state/types';
import {
  createCompiler,
  extractEvaluationSamplesRecursive,
  CompilationResultSuccess,
  EvaluationSample,
  extractBytecodeResolutions,
  encodeDataPush,
  ScriptReductionTraceScriptNode,
  authenticationTemplateToCompilerConfiguration,
  createVirtualMachineBCH2022,
  createVirtualMachineBCHCHIPs,
} from '@bitauth/libauth';
import {
  StackItemIdentifyFunction,
  ProjectEditorMode,
  IDESupportedProgramState,
  ComputedEditorState,
  ScriptEditorFrame,
  EvaluationViewerLine,
  EvaluationViewerHighlight,
} from './editor-types';
import { exportAuthenticationTemplate } from '../state/import-export';
import { samplesToEvaluationLines } from '../btl-utils/editor-tooling';

/**
 * This method lets us pretend that the provided script was wrapped in a push
 * statement while retaining the correct line/column numbers for segments. This
 * allows sample generation to work as expected for "pushed" tested scripts.
 */
const wrapScriptReductionInPush = <ProgramState>(
  node: ScriptReductionTraceScriptNode<ProgramState>
) => {
  const wrappedBytecode = encodeDataPush(node.bytecode);
  return {
    bytecode: wrappedBytecode,
    range: {
      endColumn: node.range.endColumn,
      endLineNumber: node.range.endLineNumber,
      startColumn: 0,
      startLineNumber: 0,
    },
    script: [
      {
        bytecode: wrappedBytecode,
        push: {
          bytecode: node.bytecode,
          range: node.range,
          script: node.script,
        },
        range: {
          endColumn: node.range.endColumn,
          endLineNumber: node.range.endLineNumber,
          startColumn: 0,
          startLineNumber: 0,
        },
      },
    ],
  } as ScriptReductionTraceScriptNode<ProgramState>;
};

export const computeEditorState = <
  ProgramState extends IDESupportedProgramState
>(
  state: AppState
): ComputedEditorState<ProgramState> => {
  const {
    ideMode,
    currentEditingMode,
    currentlyEditingInternalId,
    currentScenarioInternalId,
  } = state;
  if (ideMode === IDEMode.wallet) {
    return { editorMode: ProjectEditorMode.wallet };
  }
  if (currentEditingMode === 'welcome') {
    return { editorMode: ProjectEditorMode.welcome };
  }
  if (currentEditingMode === 'importing') {
    return { editorMode: ProjectEditorMode.importing };
  }
  if (currentEditingMode === 'template-settings') {
    return { editorMode: ProjectEditorMode.templateSettingsEditor };
  }
  if (currentEditingMode === 'entity') {
    return { editorMode: ProjectEditorMode.entityEditor };
  }
  if (currentlyEditingInternalId === undefined) {
    return { editorMode: ProjectEditorMode.templateSettingsEditor };
  }
  const template = exportAuthenticationTemplate(state.currentTemplate);
  const configuration = authenticationTemplateToCompilerConfiguration(template);
  const vm =
    state.currentVmId === 'BCH_2022_05'
      ? createVirtualMachineBCH2022()
      : createVirtualMachineBCHCHIPs();
  const compiler = createCompiler(configuration);

  /**
   * Map variable InternalIds to entity InternalIds
   */
  const variableOwnership: {
    [variableInternalId: string]: string;
  } = Object.entries(state.currentTemplate.entitiesByInternalId).reduce(
    (previous, [entityInternalId, content]) =>
      content.variableInternalIds
        .map((variableInternalId) => ({
          [variableInternalId]: entityInternalId,
        }))
        .reduce((done, next) => ({ ...done, ...next }), { ...previous }),
    {}
  );
  const variableDetails: VariableDetails = Object.entries(
    state.currentTemplate.variablesByInternalId
  ).reduce((variables, [internalId, variable]) => {
    const entity =
      state.currentTemplate.entitiesByInternalId[variableOwnership[internalId]];
    return {
      ...variables,
      [variable.id]: {
        variable,
        entity: { name: entity.name, id: entity.id },
      },
    };
  }, {});

  const scriptDetails: ScriptDetails = Object.values(
    state.currentTemplate.scriptsByInternalId
  )
    .filter(
      (ideScript) =>
        ideScript.type !== 'test-setup' && ideScript.type !== 'test-check'
    )
    .reduce(
      (scripts, ideScript) => ({ ...scripts, [ideScript.id]: ideScript }),
      {}
    );

  const templateScenario =
    currentScenarioInternalId === undefined
      ? undefined
      : state.currentTemplate.scenariosByInternalId[currentScenarioInternalId];

  const scenarioId = templateScenario?.id;

  const currentScript = state.currentTemplate.scriptsByInternalId[
    currentlyEditingInternalId
  ] as IDEActivatableScript;

  /**
   * If `true`, the scenario is expected to make this script succeed. If
   * `false`, the scenario is expected to make this script fail. If `undefined`,
   * the default scenario is being used and it's expected to pass for all
   * scripts but isolated scripts (which have no verifiable result).
   */
  const scenarioIsExpectedToPass =
    currentScript.type === 'isolated' || currentScenarioInternalId === undefined
      ? undefined
      : currentScript.passesInternalIds.includes(currentScenarioInternalId)
      ? true
      : currentScript.failsInternalIds.includes(currentScenarioInternalId)
      ? false
      : (() => {
          console.error(
            "Invalid application state: it shouldn't be possible to compile a script with a scenario it doesn't support. There's a problem with the reducer."
          );
          return undefined;
        })();

  /**
   * All available scenarios, sorted by `name`.
   */
  const availableScenarios: ScenarioDetails['availableScenarios'] =
    currentScript.type === 'isolated'
      ? []
      : [...currentScript.passesInternalIds, ...currentScript.failsInternalIds]
          .map(
            (internalId) =>
              state.currentTemplate.scenariosByInternalId[internalId]
          )
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((scenario) => ({
            id: scenario.id,
            name: scenario.name,
            internalId: scenario.internalId,
          }));

  const {
    editorMode,
    isPushed,
    /**
     * Either `standard` or the locking type of the locking script unlocked by
     * the current script.
     */
    lockingType,
    /**
     * The internal ID of the script being evaluated (in evaluation order)
     */
    scriptEditorEvaluationTrace,
    lockingScriptId,
    /**
     * The ID of the active "unlocking script". For unlocking/locking script
     * pairs, the unlocking script's ID. For tested scripts, the ID of the
     * "virtualized" unlocking script. For isolate scripts, `undefined`.
     */
    unlockingScriptId,
  } =
    currentScript.type === 'isolated'
      ? {
          editorMode: ProjectEditorMode.isolatedScriptEditor,
          isPushed: false,
          lockingType: 'standard' as const,
          scriptEditorEvaluationTrace: [currentScript.internalId],
          lockingScriptId: currentScript.id,
          unlockingScriptId: undefined,
        }
      : currentScript.type === 'unlocking'
      ? {
          editorMode: ProjectEditorMode.scriptPairEditor,
          isPushed: false,
          lockingType: (
            state.currentTemplate.scriptsByInternalId[
              currentScript.parentInternalId
            ] as IDETemplateLockingScript
          ).lockingType,
          scriptEditorEvaluationTrace: [
            currentScript.internalId,
            currentScript.parentInternalId,
          ],
          lockingScriptId: undefined,
          unlockingScriptId: currentScript.id,
        }
      : {
          editorMode: ProjectEditorMode.testedScriptEditor,
          isPushed: (
            state.currentTemplate.scriptsByInternalId[
              currentScript.parentInternalId
            ] as IDETemplateTestedScript
          ).pushed,
          lockingType: 'standard' as const,
          scriptEditorEvaluationTrace: [
            currentScript.internalId,
            currentScript.parentInternalId,
            currentScript.testCheckInternalId,
          ],
          lockingScriptId: undefined,
          unlockingScriptId: `${
            (
              state.currentTemplate.scriptsByInternalId[
                currentScript.parentInternalId
              ] as IDETemplateTestedScript
            ).id
          }.${currentScript.id}.unlock`,
        };

  /**
   * The id of each source script in use.
   */
  const scriptEditorEvaluationSource = scriptEditorEvaluationTrace.map(
    (internalId) => state.currentTemplate.scriptsByInternalId[internalId].script
  );

  const scenarioGeneration = compiler.generateScenario({
    debug: true,
    lockingScriptId,
    unlockingScriptId,
    scenarioId,
  });

  const { lockingScriptCompilation, unlockingScriptCompilation } =
    typeof scenarioGeneration !== 'string'
      ? {
          lockingScriptCompilation: scenarioGeneration.lockingCompilation,
          unlockingScriptCompilation: scenarioGeneration.unlockingCompilation,
        }
      : {
          lockingScriptCompilation: undefined,
          unlockingScriptCompilation: undefined,
        };

  const { debugTrace, verifyResult } =
    typeof scenarioGeneration !== 'string' &&
    typeof scenarioGeneration.scenario !== 'string'
      ? {
          debugTrace: vm.debug(scenarioGeneration.scenario.program),
          verifyResult: vm.verify(scenarioGeneration.scenario.program),
        }
      : { debugTrace: undefined, verifyResult: undefined };

  const resolvedIdentifiers = [
    lockingScriptCompilation,
    unlockingScriptCompilation,
  ].reduce<{
    [fullIdentifier: string]: Uint8Array;
  }>(
    (vars, result) =>
      result !== undefined && 'resolve' in result
        ? {
            ...vars,
            ...extractBytecodeResolutions(result.resolve).reduce<{
              [fullIdentifier: string]: Uint8Array;
            }>(
              (all, resolution) =>
                ['variable', 'script', 'UTF8Literal'].includes(resolution.type)
                  ? { ...all, [resolution.text]: resolution.bytecode }
                  : all,
              {}
            ),
          }
        : vars,
    {}
  );

  const bytecodeToIdentifierMap = Object.entries(resolvedIdentifiers).reduce<{
    [stringifiedArray: string]: string;
  }>(
    (all, [identifier, bytecode]) => ({
      ...all,
      [bytecode.toString()]: identifier,
    }),
    {}
  );

  const stackItemIdentifyIgnoreList = ['0', '1'];
  const identifyStackItems: StackItemIdentifyFunction = (item) =>
    (stackItemIdentifyIgnoreList.indexOf(item.toString()) === -1 &&
      bytecodeToIdentifierMap[item.toString()]) ||
    false;

  /**
   * The remaining states from the debug trace which have not yet been matched
   * to samples.
   */
  let remainingStates = debugTrace as ProgramState[] | undefined;

  const scriptEditorFrames = scriptEditorEvaluationTrace.map<
    ScriptEditorFrame<ProgramState>
  >((internalId) => {
    const script = state.currentTemplate.scriptsByInternalId[internalId];
    const { used, compilation } =
      script.type === 'test-setup' || script.type === 'unlocking'
        ? { used: 'unlocking', compilation: unlockingScriptCompilation }
        : script.type === 'test-check'
        ? { used: 'check', compilation: lockingScriptCompilation }
        : { used: 'locking', compilation: lockingScriptCompilation };

    let frameSamples: EvaluationSample<ProgramState>[] | undefined;
    let evaluationLines: EvaluationViewerLine<ProgramState>[] | undefined;
    if (debugTrace !== undefined) {
      const successfulCompilation =
        compilation as CompilationResultSuccess<ProgramState>;
      const lastSourceLine = successfulCompilation.parse.end.line;
      const reduction = successfulCompilation.reduce;
      if (lockingType === 'p2sh20' && used === 'locking') {
        const p2shStates = 5;
        /**
         * Trim off P2SH states – we don't show that part in the IDE. (It's always
         * the same, and the compiler should never mess it up.)
         */
        remainingStates = (remainingStates as ProgramState[]).slice(p2shStates);
      } else if (script.type === 'isolated') {
        /**
         * Trim off state from virtualized (empty) unlocking script.
         */
        remainingStates = (remainingStates as ProgramState[]).slice(1);
      } else if (script.type === 'test-check' && !isPushed) {
        /**
         * Since the actual locking script and test-check script are
         * concatenated for evaluation, the "initial state" for the check script
         * is missing, shifting all remaining states back one sample. To avoid
         * this, we simulate the "initial state" by duplicating the first
         * remaining state before extracting samples.
         *
         * However, if a tested script is "pushed" for testing, this effect is
         * offset by the pushed sample, so duplication can be skipped.
         */
        remainingStates =
          remainingStates === undefined || remainingStates.length === 0
            ? []
            : [remainingStates[0], ...remainingStates];
      }
      const nodes =
        isPushed && script.type === 'tested'
          ? wrapScriptReductionInPush(reduction).script
          : reduction.script;
      const evaluationRange = reduction.range;
      const { samples, unmatchedStates } = extractEvaluationSamplesRecursive({
        evaluationRange,
        nodes,
        trace: remainingStates as ProgramState[],
      });
      remainingStates = unmatchedStates;
      frameSamples = samples;
      const linesNeeded = lastSourceLine + 2;
      evaluationLines = samplesToEvaluationLines(samples, linesNeeded);
    }

    const scriptName =
      script.type === 'test-check'
        ? state.currentTemplate.scriptsByInternalId[script.testSetupInternalId]
            .name
        : script.name;

    return {
      compilation,
      // TODO: indicate the offset of the script in compilation for check scripts?
      samples: frameSamples,
      script: script.script,
      scriptId: script.id,
      scriptInternalId: script.internalId,
      scriptName,
      scriptType: script.type,
      evaluationLines,
      monacoModel: script.monacoModel,
    };
  });

  const lastFrame = scriptEditorFrames[scriptEditorFrames.length - 1];
  if (
    scenarioIsExpectedToPass &&
    verifyResult === true &&
    lastFrame.evaluationLines !== undefined
  ) {
    const lastLineWithState = lastFrame.evaluationLines
      .slice()
      .reverse()
      .find((line) => line.state !== undefined);
    if (lastLineWithState !== undefined) {
      lastLineWithState.highlight = EvaluationViewerHighlight.success;
    }
    // TODO: add highlights, help info for failing scenarios (both expected and unexpected)
  }

  const scenarioDetails: ScenarioDetails = {
    availableScenarios,
    generatedScenario:
      typeof scenarioGeneration === 'string'
        ? scenarioGeneration
        : scenarioGeneration.scenario,
    selectedScenario:
      templateScenario === undefined
        ? undefined
        : {
            description: templateScenario.description,
            /**
             * If templateScenario is defined, we should always know whether the
             * selected scenario is expected to pass.
             */
            expectedToPass: scenarioIsExpectedToPass as boolean,
            id: templateScenario.id,
            name: templateScenario.name,
            verifyResult,
          },
  };

  return {
    debugTrace,
    editorMode,
    isPushed,
    lockingType,
    identifyStackItems,
    scenarioDetails,
    scriptDetails,
    scriptEditorEvaluationSource,
    scriptEditorEvaluationTrace,
    scriptEditorFrames,
    variableDetails,
  };
};
