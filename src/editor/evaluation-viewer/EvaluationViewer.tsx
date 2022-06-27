import React, { useState } from 'react';
import './EvaluationViewer.scss';
import {
  binToHex,
  binToBinString,
  Range,
  stringify,
  vmNumberToBigInt,
  stringifyDebugTraceSummary,
  summarizeDebugTrace,
} from '@bitauth/libauth';
import * as libauth from '@bitauth/libauth';
import {
  EvaluationViewerHighlight,
  EvaluationViewerSpacer,
  StackItemIdentifyFunction,
  EvaluationViewerLine,
  IDESupportedProgramState,
  EvaluationViewerSettings,
  EvaluationViewerComputedState,
  ScriptEditorFrame,
} from '../editor-types';
import { Tooltip, Popover, Button, HTMLSelect, Icon } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import { ActionCreators } from '../../state/reducer';
import { ScenarioDetails } from '../../state/types';
import {
  vmErrorAssistanceBCH,
  compilationErrorAssistance,
  renderSimpleMarkdown,
} from '../script-editor/error-assistance';
import { abbreviateStackItem } from '../common';

(window as any).libauth = libauth;

// cspell:ignore clibauth cwindow
console.log(
  `%cWelcome to Bitauth IDE!
  
%cThe %clibauth%c library is available at%c libauth%c (%cwindow.libauth%c).
You can click a line in the evaluation viewer to inspect the program state at that point in the evaluation.

%cTip: to quickly stringify an object which %cJSON.stringify%c doesn't support, try%c libauth.stringify%c.`,
  'font-weight: bold;',
  '',
  'color: #2a5b8b; font-weight: bold;',
  '',
  'color: #cb1b15; font-weight: bold;',
  '',
  'color: #cb1b15; font-weight: bold;',
  '',
  'color: #888; font-style: italic;',
  'color: #cb1b15; font-weight: bold; font-style: italic;',
  'color: #888; font-style: italic;',
  'color: #cb1b15; font-weight: bold; font-style: italic;',
  'color: #888; font-style: italic;'
);

const stackItem = (
  itemIndex: number,
  content: string,
  element: JSX.Element
) => (
  <Popover
    key={`${itemIndex}:${content}`}
    content={content}
    portalClassName="stack-popover"
    interactionKind="hover"
  >
    {element}
  </Popover>
);

const getStackItemDisplaySettings = (
  item: Uint8Array,
  settings: EvaluationViewerSettings,
  lookup?: StackItemIdentifyFunction
) => {
  const name =
    lookup !== undefined && settings.identifyStackItems ? lookup(item) : false;
  const hex = `0x${binToHex(item)}`;
  if (name !== false) {
    return {
      hex,
      type: 'named' as const,
      label: name,
    };
  }
  const number = vmNumberToBigInt(item);
  if (typeof number === 'bigint') {
    if (settings.scriptNumbersDisplayFormat === 'integer') {
      return {
        hex,
        type: 'number' as const,
        label: `${number}`,
      };
    }
    if (settings.scriptNumbersDisplayFormat === 'binary') {
      return {
        hex,
        type: 'binary' as const,
        label: `0b${binToBinString(item)}`,
      };
    }
  }
  return {
    hex,
    type: 'hex' as const,
    label: settings.abbreviateLongStackItems ? abbreviateStackItem(hex) : hex,
  };
};

const hasVmHelp = (
  error?: string
): error is keyof typeof vmErrorAssistanceBCH =>
  error !== undefined &&
  (vmErrorAssistanceBCH as { [key: string]: any })[error] !== undefined;

/**
 * Renders some common virtual machine errors with friendly help information.
 */
const VmErrorLine = ({ state }: { state: IDESupportedProgramState }) =>
  hasVmHelp(state.error) ? (
    <span className="stack-item error error-with-help">
      <Popover
        content={vmErrorAssistanceBCH[state.error]?.(state)}
        portalClassName="help-popover"
        interactionKind="hover"
      >
        {state.error}
      </Popover>
    </span>
  ) : (
    <span className="stack-item error">{state.error}</span>
  );

/**
 * Renders some common compilation errors with friendly help information.
 */
const CompilationErrorLine = ({
  error,
  frame,
  range,
}: {
  error: string;
  frame: ScriptEditorFrame<IDESupportedProgramState>;
  range: Range;
}) => {
  const firstMatch = compilationErrorAssistance.find((item) =>
    item.regex.test(error)
  );
  return (
    <li
      key={`${error}${range.startLineNumber}${range.endLineNumber}${range.startColumn}${range.endColumn}`}
    >
      {firstMatch === undefined ? (
        <span className="error-message">{error}</span>
      ) : (
        <Popover
          content={
            <div className="help-popover-scroll">
              {firstMatch
                .generateHints(error, frame)
                .map(renderSimpleMarkdown)
                .map((content) => (
                  <div className="assistance-section">{content}</div>
                ))}
            </div>
          }
          portalClassName="help-popover"
          interactionKind="hover"
          className="assistance-popover-target"
        >
          <span className="error-message">{error}</span>
        </Popover>
      )}
      <span className="line-and-column">{`[${range.startLineNumber},${range.startColumn}]`}</span>
    </li>
  );
};

const EvaluationLine = ({
  hasError,
  hasActiveCursor,
  line,
  lineNumber,
  lookup,
  settings,
}: {
  hasError: boolean;
  hasActiveCursor: boolean;
  line: EvaluationViewerLine<IDESupportedProgramState>;
  lineNumber: number;
  lookup?: StackItemIdentifyFunction;
  settings: EvaluationViewerSettings;
}) => {
  const firstSkippedSpacer =
    line.spacers === undefined
      ? undefined
      : line.spacers.findIndex(
          (spacer) => spacer === EvaluationViewerSpacer.skippedConditional
        );
  const sliceSpacersAtIndex =
    firstSkippedSpacer === undefined || firstSkippedSpacer === -1
      ? undefined
      : firstSkippedSpacer + 1;

  /**
   * Individual and grouped stack items (when enabled, stacks larger than 6
   * items group remaining items into a single "grouped" ellipsis item)
   */
  const stackItemsAndGroups = [
    (
      (settings.showAlternateStack
        ? line.state?.alternateStack
        : line.state?.stack) ?? []
    )
      .map((item, index, stack) =>
        settings.groupStackItemsDeeperThan === undefined
          ? item
          : index > stack.length - (settings.groupStackItemsDeeperThan + 1)
          ? item
          : index === stack.length - (settings.groupStackItemsDeeperThan + 1)
          ? stack.slice(
              0,
              stack.length - (settings.groupStackItemsDeeperThan + 1)
            )
          : undefined
      )
      .filter((item): item is Uint8Array | Uint8Array[] => item !== undefined),
  ]
    .map((stack) => (settings.reverseStack ? stack.reverse() : stack))
    .flat();

  return (
    <div
      className={`state${hasActiveCursor ? ' active-cursor' : ''}${
        line.highlight === undefined
          ? ''
          : ` highlight${
              line.highlight === EvaluationViewerHighlight.success
                ? ' success'
                : ''
            }`
      }`}
      onClick={() => {
        console.log(`ProgramState after line #${lineNumber}:`);
        console.dir(line.state);
      }}
    >
      {line.spacers &&
        line.spacers.slice(0, sliceSpacersAtIndex).map((type, index) => (
          <span
            key={index}
            className={`spacer ${
              type === EvaluationViewerSpacer.evaluation
                ? 'spacer-evaluation'
                : type === EvaluationViewerSpacer.executedConditional
                ? 'spacer-conditional-executed'
                : 'spacer-conditional-skipped'
            }`}
          >
            &nbsp;
          </span>
        ))}
      {hasError ? (
        <VmErrorLine
          state={line.state as IDESupportedProgramState}
        ></VmErrorLine>
      ) : line.spacers &&
        line.spacers.indexOf(EvaluationViewerSpacer.skippedConditional) !==
          -1 ? (
        <span className="unchanged" />
      ) : (
        stackItemsAndGroups.map((item, itemIndex) => {
          if (Array.isArray(item)) {
            const labels = item
              .map((innerItem) =>
                getStackItemDisplaySettings(innerItem, settings, lookup)
              )
              .map((item) => item.label)
              .join(' ');
            return stackItem(
              itemIndex,
              labels,
              <span className="stack-item group">&hellip;</span>
            );
          }
          const { hex, label, type } = getStackItemDisplaySettings(
            item,
            settings,
            lookup
          );
          return stackItem(
            itemIndex,
            hex,
            <span className={`stack-item ${type}`}>{label}</span>
          );
        })
      )}
    </div>
  );
};

const emptyEvaluation = [] as EvaluationViewerLine[];
const emptyLookup = {
  lookup: () => false as const,
};

/**
 * Scenario IDs may not begin with a number, so these values cannot overlap with
 * real scenario IDs.
 */
enum ScenarioSwitcherSpecialValues {
  defaultScenario = '0',
  editScenarios = '1',
}

const ScenarioSwitcher = ({
  scenarioDetails,
  switchScenario,
  importExport,
}: {
  scenarioDetails: ScenarioDetails;
  importExport: typeof ActionCreators.importExport;
  switchScenario: typeof ActionCreators.switchScenario;
}) => (
  <Popover
    content={
      scenarioDetails.selectedScenario === undefined
        ? 'Change the scenario used in the below evaluation'
        : scenarioDetails.selectedScenario.description
    }
    portalClassName="control-popover"
    interactionKind="hover"
  >
    <HTMLSelect
      className="scenario-switcher"
      iconProps={{ iconSize: 12 }}
      options={[
        ...(scenarioDetails.selectedScenario === undefined
          ? [
              {
                value: ScenarioSwitcherSpecialValues.defaultScenario,
                label: 'Default Scenario',
              },
            ]
          : scenarioDetails.availableScenarios.map((available) => ({
              value: available.id,
              label: available.name,
            }))),
        {
          value: ScenarioSwitcherSpecialValues.editScenarios,
          label: 'Edit Scenarios...',
        },
      ]}
      onChange={(e) => {
        if (
          e.currentTarget.value ===
          ScenarioSwitcherSpecialValues.defaultScenario
        ) {
          /**
           * If the default scenario is show, there are no
           * other scenarios to switch to/from, so we can
           * just ignore this selection.
           */
          return;
        }
        if (
          e.currentTarget.value === ScenarioSwitcherSpecialValues.editScenarios
        ) {
          const flag = '_editScenariosWIPHasBeenExplained';
          const explanation = `Bitauth IDE does not yet have a simplified interface for editing scenarios, but scenarios can still be edited directly in the template. Add or make changes to the "scenarios" property in the template JSON, then import your changes to finish. See the guide for information about scenarios.`;
          console.log(explanation);
          importExport();
          if ((window as any)[flag] === undefined) {
            (window as any)[flag] = true;
            setTimeout(() => {
              window.alert(explanation);
            }, 1000);
          }
          return;
        }
        const scenarioId = e.currentTarget.value;
        const nextScenario = scenarioDetails.availableScenarios.find(
          (available) => available.id === scenarioId
        );
        const internalId = nextScenario?.internalId;
        if (internalId !== undefined) {
          switchScenario(internalId);
        }
      }}
      value={
        scenarioDetails.selectedScenario === undefined
          ? 0
          : scenarioDetails.selectedScenario.id
      }
    />
  </Popover>
);

export const ViewerControls = ({
  changeEvaluationViewerSettings,
  debugTrace,
  evaluationViewerSettings,
  importExport,
  scenarioDetails,
  switchScenario,
}: {
  changeEvaluationViewerSettings: typeof ActionCreators.changeEvaluationViewerSettings;
  debugTrace: IDESupportedProgramState[] | undefined;
  evaluationViewerSettings: EvaluationViewerSettings;
  importExport: typeof ActionCreators.importExport;
  scenarioDetails: ScenarioDetails;
  switchScenario: typeof ActionCreators.switchScenario;
}) => (
  <div className="controls">
    <div className="viewing-stack">
      {evaluationViewerSettings.showAlternateStack ? (
        <Tooltip
          content="Currently showing the alternate stack. Click to switch to the stack."
          portalClassName="control-tooltip"
          position="bottom-left"
        >
          <Button
            className="alt-stack"
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                showAlternateStack: false,
              });
            }}
          >
            Alternate Stack
          </Button>
        </Tooltip>
      ) : (
        <Tooltip
          content="Currently showing the stack. Click to switch the alternate stack."
          portalClassName="control-tooltip"
          position="bottom-left"
        >
          <Button
            className="stack"
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                showAlternateStack: true,
              });
            }}
          >
            Stack
          </Button>
        </Tooltip>
      )}
    </div>
    <div className="toggles">
      <ScenarioSwitcher
        importExport={importExport}
        scenarioDetails={scenarioDetails}
        switchScenario={switchScenario}
      ></ScenarioSwitcher>
      {typeof scenarioDetails.generatedScenario === 'string' ? (
        <Popover
          content={scenarioDetails.generatedScenario}
          portalClassName="control-popover"
          interactionKind="hover"
          position="bottom-right"
        >
          <Icon
            className="shrink scenario-detail-icon scenario-generation-error"
            icon={IconNames.ERROR}
          ></Icon>
        </Popover>
      ) : (
        /**
         * Scenario generation was successful
         */
        <Popover
          content={
            <div>
              <p>
                {scenarioDetails.selectedScenario === undefined
                  ? 'This is the default scenario. To test for success or failure, add a scenario to this script.'
                  : `This scenario is expected to ${
                      scenarioDetails.selectedScenario.expectedToPass
                        ? 'pass'
                        : 'fail'
                    }. The scenario ${
                      typeof scenarioDetails.selectedScenario?.verifyResult ===
                      'string'
                        ? `failed with the error: ${scenarioDetails.selectedScenario.verifyResult}`
                        : 'passed.'
                    }`}
              </p>
              <p className="scenario-logging-options">
                <button
                  onClick={() => {
                    console.log(
                      'Generated Scenario:',
                      scenarioDetails.generatedScenario
                    );
                  }}
                >
                  Log Scenario to Developer Console
                </button>
                <button
                  onClick={() => {
                    if (debugTrace !== undefined) {
                      console.log(
                        'Trace Summary:',
                        stringifyDebugTraceSummary(
                          summarizeDebugTrace(debugTrace)
                        )
                      );
                    }
                    console.log('Debug Trace:', debugTrace);
                  }}
                >
                  Log Debug Trace to Developer Console
                </button>
              </p>
              <code className="generated-scenario">
                <pre>{stringify(scenarioDetails.generatedScenario)}</pre>
              </code>
            </div>
          }
          portalClassName="control-popover"
          interactionKind="hover"
          placement="auto"
        >
          {scenarioDetails.selectedScenario === undefined ||
          (scenarioDetails.selectedScenario?.verifyResult === true &&
            scenarioDetails.selectedScenario.expectedToPass === true) ||
          (typeof scenarioDetails.selectedScenario?.verifyResult === 'string' &&
            scenarioDetails.selectedScenario.expectedToPass === false) ? (
            <Icon
              className="shrink scenario-detail-icon"
              icon={IconNames.TICK}
            ></Icon>
          ) : (
            <Icon
              className="shrink scenario-detail-icon scenario-detail-icon-error"
              icon={IconNames.CROSS}
            ></Icon>
          )}
        </Popover>
      )}

      {evaluationViewerSettings.scriptNumbersDisplayFormat === 'integer' ? (
        <Tooltip
          content="Showing Script Numbers in integer format"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                scriptNumbersDisplayFormat: 'hex',
              });
            }}
          >
            <span className="number-format">123</span>
          </Button>
        </Tooltip>
      ) : evaluationViewerSettings.scriptNumbersDisplayFormat === 'hex' ? (
        <Tooltip
          content="Showing Script Numbers in hex format"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                scriptNumbersDisplayFormat: 'binary',
              });
            }}
          >
            <span className="number-format">0x</span>
          </Button>
        </Tooltip>
      ) : (
        <Tooltip
          content="Showing Script Numbers in binary format"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                scriptNumbersDisplayFormat: 'integer',
              });
            }}
          >
            <span className="number-format">0b</span>
          </Button>
        </Tooltip>
      )}

      {evaluationViewerSettings.abbreviateLongStackItems ? (
        <Tooltip
          content="Show full contents of long stack items"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            className="shrink"
            icon={IconNames.MAXIMIZE}
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                abbreviateLongStackItems: false,
              });
            }}
          />
        </Tooltip>
      ) : (
        <Tooltip
          content="Abbreviate long stack items (e.g. '0x1233...7890')"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            className="shrink"
            icon={IconNames.MINIMIZE}
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                abbreviateLongStackItems: true,
              });
            }}
          />
        </Tooltip>
      )}
      {evaluationViewerSettings.identifyStackItems ? (
        <Tooltip
          content="Disable identification of bytecode from variables, scripts, and UTF8 literals"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            className="shrink"
            icon={IconNames.PIN}
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                identifyStackItems: false,
              });
            }}
          />
        </Tooltip>
      ) : (
        <Tooltip
          content="Identify bytecode from variables, scripts, and UTF8 literals"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            className="shrink"
            icon={IconNames.UNPIN}
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                identifyStackItems: true,
              });
            }}
          />
        </Tooltip>
      )}
      {evaluationViewerSettings.groupStackItemsDeeperThan === 6 ? (
        <Tooltip
          content="Ungroup stack items deeper than 6"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            className="shrink"
            icon={IconNames.UNGROUP_OBJECTS}
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                groupStackItemsDeeperThan: undefined,
              });
            }}
          />
        </Tooltip>
      ) : evaluationViewerSettings.groupStackItemsDeeperThan === 3 ? (
        <Tooltip
          content="Group stack items deeper than 6"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            className="shrink"
            icon={IconNames.GROUP_OBJECTS}
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                groupStackItemsDeeperThan: 6,
              });
            }}
          />
        </Tooltip>
      ) : (
        <Tooltip
          content="Group stack items deeper than 3"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            className="shrink"
            icon={IconNames.GROUP_OBJECTS}
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                groupStackItemsDeeperThan: 3,
              });
            }}
          />
        </Tooltip>
      )}
      {evaluationViewerSettings.reverseStack ? (
        <Tooltip
          content="Order stack items normally"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            className="shrink"
            icon={IconNames.UNDO}
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                reverseStack: false,
              });
            }}
          />
        </Tooltip>
      ) : (
        <Tooltip
          content="Reverse the order of stack items"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            className="shrink"
            icon={IconNames.REDO}
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                reverseStack: true,
              });
            }}
          />
        </Tooltip>
      )}
    </div>
  </div>
);

export const EvaluationViewer = (props: {
  changeEvaluationViewerSettings: typeof ActionCreators.changeEvaluationViewerSettings;
  debugTrace: IDESupportedProgramState[] | undefined;
  importExport: typeof ActionCreators.importExport;
  switchScenario: typeof ActionCreators.switchScenario;
  cursorLine: number | undefined;
  computedState: EvaluationViewerComputedState;
  evaluationViewerSettings: EvaluationViewerSettings;
  viewerRef: (viewer: HTMLDivElement | null) => void;
  showControls: boolean;
  scenarioDetails: ScenarioDetails;
}) => {
  const { evaluationSource, evaluationTrace, frame, lookup } =
    props.computedState;
  const { compilation, evaluationLines } = frame;
  const [cachedEvaluation, setCachedEvaluation] = useState(emptyEvaluation);
  const [cachedEvaluationSource, setCachedEvaluationSource] = useState('');
  const [cachedEvaluationTrace, setCachedEvaluationTrace] = useState(['']);
  const [cachedLookup, setCachedLookup] = useState<{
    lookup: StackItemIdentifyFunction | undefined;
  }>(emptyLookup);

  if (evaluationTrace.join() !== cachedEvaluationTrace.join()) {
    setCachedEvaluation(emptyEvaluation);
    setCachedLookup(emptyLookup);
    setCachedEvaluationTrace(evaluationTrace);
    return null;
  }
  const hasError =
    typeof evaluationLines === 'undefined' || evaluationLines.length === 0;
  const cacheIsUpdated = cachedEvaluationSource === evaluationSource.join();
  if (!hasError && !cacheIsUpdated) {
    setCachedEvaluationSource(evaluationSource.join());
    setCachedEvaluation(evaluationLines as EvaluationViewerLine[]);
    setCachedLookup({ lookup });
    return null;
  }

  const cacheIsAvailable = cachedEvaluation.length !== 0;
  const showCached = hasError && cacheIsAvailable;
  const evaluation = showCached ? cachedEvaluation : evaluationLines;
  const activeLookup = showCached ? cachedLookup.lookup : lookup;

  return (
    <div
      className={`EvaluationViewer EvaluationViewer-${frame.scriptType}`}
      ref={props.viewerRef}
    >
      <div className={`content${showCached ? ' cached' : ''}`}>
        {evaluation && evaluation.length > 0 ? (
          <div>
            <div className="header-bar">
              {props.showControls ? undefined : (
                <div className="header-bar-content-fade"></div>
              )}
              <div className="header-bar-content">
                {props.showControls ? (
                  <ViewerControls
                    changeEvaluationViewerSettings={
                      props.changeEvaluationViewerSettings
                    }
                    debugTrace={props.debugTrace}
                    evaluationViewerSettings={props.evaluationViewerSettings}
                    importExport={props.importExport}
                    scenarioDetails={props.scenarioDetails}
                    switchScenario={props.switchScenario}
                  />
                ) : (
                  <EvaluationLine
                    hasError={false}
                    hasActiveCursor={false}
                    line={evaluation[0]}
                    lineNumber={0}
                    lookup={activeLookup}
                    settings={props.evaluationViewerSettings}
                  />
                )}
              </div>
            </div>

            <div className="evaluation">
              {evaluation.slice(1).map((line, lineIndex, lines) => (
                <EvaluationLine
                  hasError={line.state?.error !== undefined}
                  hasActiveCursor={props.cursorLine === lineIndex + 1}
                  key={lineIndex}
                  line={line}
                  lineNumber={lineIndex + 1}
                  lookup={activeLookup}
                  settings={props.evaluationViewerSettings}
                />
              ))}
            </div>
          </div>
        ) : typeof props.scenarioDetails.generatedScenario === 'string' &&
          (frame.scriptType === 'isolated' ||
            frame.scriptType === 'unlocking' ||
            frame.scriptType === 'test-setup') ? (
          <div className="compilation-error-without-cache">
            <div className="header-bar">
              <div className="header-bar-content">
                <div className="controls">
                  The selected scenario cannot be generated:
                  <div className="toggles">
                    <ScenarioSwitcher
                      importExport={props.importExport}
                      scenarioDetails={props.scenarioDetails}
                      switchScenario={props.switchScenario}
                    ></ScenarioSwitcher>
                  </div>
                </div>
              </div>
            </div>
            <ul className="list">
              {CompilationErrorLine({
                error: props.scenarioDetails.generatedScenario,
                range: {
                  endColumn: 0,
                  endLineNumber: 0,
                  startColumn: 0,
                  startLineNumber: 0,
                },
                frame,
              })}
            </ul>
          </div>
        ) : compilation?.success === false ? (
          <div className="compilation-error-without-cache">
            <div className="header-bar">
              <div className="header-bar-content">
                <div className="controls">
                  There{' '}
                  {compilation.errors.length === 1
                    ? 'is an error'
                    : `are ${compilation.errors.length} errors`}{' '}
                  preventing compilation:
                  <div className="toggles">
                    {(frame.scriptType === 'isolated' ||
                      frame.scriptType === 'unlocking' ||
                      frame.scriptType === 'test-setup') && (
                      <ScenarioSwitcher
                        importExport={props.importExport}
                        scenarioDetails={props.scenarioDetails}
                        switchScenario={props.switchScenario}
                      ></ScenarioSwitcher>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <ul className="list">
              {compilation.errors.map(({ error, range }) =>
                CompilationErrorLine({ error, range, frame })
              )}
            </ul>
          </div>
        ) : (
          <div className="header-bar">
            {props.showControls && (
              <div className="header-bar-content">
                <div className="controls">
                  <div className="toggles">
                    <ScenarioSwitcher
                      importExport={props.importExport}
                      scenarioDetails={props.scenarioDetails}
                      switchScenario={props.switchScenario}
                    ></ScenarioSwitcher>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
