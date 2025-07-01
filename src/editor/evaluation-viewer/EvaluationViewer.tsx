import './EvaluationViewer.css';
import { ActionCreators } from '../../state/reducer';
import {
  EvaluationViewerSettings,
  IDESupportedProgramState,
  ScenarioDetails,
} from '../../state/types';
import { abbreviateStackItem } from '../common';
import {
  EvaluationViewerComputedState,
  EvaluationViewerHighlight,
  EvaluationViewerLine,
  EvaluationViewerSpacer,
  ScriptEditorFrame,
  StackItemIdentifyFunction,
} from '../editor-types';
import {
  compilationErrorAssistance,
  renderSimpleMarkdown,
} from '../script-editor/error-assistance';

import * as libauth from '@bitauth/libauth';
import {
  binToBinString,
  binToHex,
  Range,
  stringify,
  stringifyDebugTraceSummary,
  summarizeDebugTrace,
  vmNumberToBigInt,
} from '@bitauth/libauth';
import {
  Button,
  HTMLSelect,
  Popover,
  Slider,
  Tooltip,
} from '@blueprintjs/core';
import {
  Cross,
  Error,
  GroupObjects,
  Maximize,
  Minimize,
  Pin,
  Redo,
  Tick,
  Undo,
  UngroupObjects,
  Unpin,
} from '@blueprintjs/icons';
import { useState } from 'react';

// TODO: remove this workaround when https://github.com/PostHog/posthog-js/issues/968 lands
declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface BigInt {
    toJSON: () => string;
  }
}
BigInt.prototype.toJSON = function () {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return this.toString();
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
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
  'color: #888; font-style: italic;',
);

const stackItem = (
  itemIndex: number,
  content: string,
  element: JSX.Element,
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

const elideAt = 200;
const splitAt = 100;
const elideDigits = (digits: string) =>
  digits.length < elideAt
    ? digits
    : `${digits.slice(0, splitAt)} \u2026 (${digits.length - elideAt} total digits) \u2026 ${digits.slice(-splitAt)}`;
const elideHex = (characters: string) =>
  characters.length < elideAt
    ? characters
    : `${characters.slice(0, splitAt)} \u2026 (${(characters.length - 2) / 2} total bytes) \u2026 ${characters.slice(-splitAt)}`;

const getStackItemDisplaySettings = (
  item: Uint8Array,
  settings: EvaluationViewerSettings,
  lookup?: StackItemIdentifyFunction,
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
  const number = vmNumberToBigInt(item, {
    maximumVmNumberByteLength:
      settings.vmNumbersDisplayFormat === 'bigint'
        ? 10_000
        : settings.supportBigInt
          ? 19
          : 8,
  });
  if (typeof number === 'bigint') {
    if (
      settings.vmNumbersDisplayFormat === 'integer' ||
      settings.vmNumbersDisplayFormat === 'bigint'
    ) {
      return { hex, type: 'number' as const, label: elideDigits(`${number}`) };
    }
    if (settings.vmNumbersDisplayFormat === 'binary') {
      return {
        hex,
        type: 'binary' as const,
        label: elideDigits(`0b${binToBinString(item)}`),
      };
    }
  }
  return { hex, type: 'hex' as const, label: elideHex(hex) };
};

// TODO: modernize
const hasVmHelp = (_error?: string) => false;
// error !== undefined && vmErrorAssistanceBCH[error] !== undefined;

/**
 * Renders some common virtual machine errors with friendly help information.
 */
const VmErrorLine = ({ state }: { state: IDESupportedProgramState }) =>
  hasVmHelp(state.error) ? (
    <span className="stack-item error error-with-help">
      <Popover
        // content={vmErrorAssistanceBCH[state.error]?.(state)}
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
    item.regex.test(error),
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
                .map((content, index) => (
                  <div className="assistance-section" key={index}>
                    {content}
                  </div>
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
  changeEvaluationViewerSettings,
  setStackItemDifferState,
  stackItemDifferState,
}: {
  hasError: boolean;
  hasActiveCursor: boolean;
  line: EvaluationViewerLine;
  lineNumber: number;
  lookup?: StackItemIdentifyFunction;
  settings: EvaluationViewerSettings;
  changeEvaluationViewerSettings: typeof ActionCreators.changeEvaluationViewerSettings;
  stackItemDifferState: StackItemDifferState;
  setStackItemDifferState: React.Dispatch<
    React.SetStateAction<StackItemDifferState>
  >;
}) => {
  const firstSkippedSpacer =
    line.spacers === undefined
      ? undefined
      : line.spacers.findIndex(
          (spacer) => spacer === EvaluationViewerSpacer.skippedConditional,
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
                  stack.length - settings.groupStackItemsDeeperThan,
                )
              : undefined,
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
        if (stackItemDifferState.lineNumber !== lineNumber) {
          console.log(`ProgramState after line #${lineNumber}:`);
          console.log(line.state);
        }
      }}
    >
      {line.spacers?.slice(0, sliceSpacersAtIndex).map((type, index) =>
        typeof type === 'object' ? (
          <Tooltip
            content={`Evaluated ${type.maximumIterationIndex + 1} time${type.maximumIterationIndex === 0 ? '' : 's'}, displaying iteration ${type.iterationIndex + 1} (index ${type.iterationIndex}).`}
            key={index}
            portalClassName="loop-tooltip"
            position="bottom-right"
          >
            <Popover
              position="left"
              content={
                type.maximumIterationIndex === 0 ? (
                  <>
                    This <code>OP_BEGIN</code> is not repeated.
                  </>
                ) : (
                  <div className="loop-controls">
                    <Slider
                      min={0}
                      max={type.maximumIterationIndex}
                      stepSize={1}
                      labelStepSize={
                        type.maximumIterationIndex < 3
                          ? 1
                          : Math.round(type.maximumIterationIndex / 2)
                      }
                      value={type.iterationIndex}
                      onChange={(value) => {
                        const newIndexes = settings.loopViewingIndexes.slice();
                        newIndexes.splice(type.loopIndex, 1, value);
                        changeEvaluationViewerSettings({
                          ...settings,
                          loopViewingIndexes: newIndexes,
                        });
                      }}
                    />
                  </div>
                )
              }
              portalClassName="stack-popover"
              interactionKind="click"
            >
              <span key={index} className={'spacer spacer-loop loop-start'}>
                {type.iterationIndex}
              </span>
            </Popover>
          </Tooltip>
        ) : (
          <span
            key={index}
            className={`spacer ${
              type === EvaluationViewerSpacer.evaluation
                ? 'spacer-evaluation'
                : type === EvaluationViewerSpacer.loop
                  ? 'spacer-loop'
                  : type === EvaluationViewerSpacer.executedConditional
                    ? 'spacer-conditional-executed'
                    : 'spacer-conditional-skipped'
            }`}
          >
            &nbsp;
          </span>
        ),
      )}
      {hasError ? (
        <VmErrorLine state={line.state!}></VmErrorLine>
      ) : lineNumber === 1 && line.state?.ip === 0 ? (
        <span className="skip-comment" />
      ) : line.spacers &&
        line.spacers.includes(EvaluationViewerSpacer.skippedConditional) ? (
        <span className="unchanged" />
      ) : (
        stackItemsAndGroups.map((item, itemIndex) => {
          if (Array.isArray(item)) {
            const labels = item
              .map((innerItem) =>
                getStackItemDisplaySettings(innerItem, settings, lookup),
              )
              .map((item) => item.label)
              .join(' ');
            return stackItem(
              itemIndex,
              labels,
              <span className="stack-item group">&hellip;</span>,
            );
          }
          const { hex, label, type } = getStackItemDisplaySettings(
            item,
            settings,
            lookup,
          );
          return stackItem(
            itemIndex,
            elideHex(hex),
            <span
              className={`stack-item ${type}`}
              onClick={() => {
                if (
                  stackItemDifferState.diffNext &&
                  !(
                    stackItemDifferState.lineNumber === lineNumber &&
                    stackItemDifferState.itemIndex === itemIndex
                  )
                ) {
                  const expected = stackItemDifferState.hex;
                  const got = hex;
                  const diff = diffHexBytes(expected, got);
                  const [formatted1, ...styles1] = buildStyledLog(
                    expected,
                    diff,
                    'expected',
                  );
                  const [formatted2, ...styles2] = buildStyledLog(
                    got,
                    diff,
                    'got',
                  );
                  console.log(
                    `Comparing stack items – Expected: line ${lineNumber}, item ${itemIndex} | Got: line ${lineNumber}, item ${itemIndex}
%cExpected:%c  ${formatted1}
%cGot:%c ${formatted2}`,
                    highlight,
                    fade,
                    ...styles1,
                    highlight,
                    fade,
                    ...styles2,
                  );
                  console.log('diff:', diff);
                  setStackItemDifferState(initialStackItemDifferState);
                }
                if (
                  stackItemDifferState.lineNumber === lineNumber &&
                  stackItemDifferState.itemIndex === itemIndex &&
                  stackItemDifferState.hex === hex
                ) {
                  console.log(
                    `Diff viewer: set multi-clicked stack item (line ${lineNumber}, item ${itemIndex}) as "Expected". Click on another stack item to diff the two items.`,
                  );
                  setStackItemDifferState({
                    diffNext: true,
                    lineNumber,
                    itemIndex,
                    hex,
                  });
                } else {
                  setStackItemDifferState({
                    diffNext: false,
                    lineNumber,
                    itemIndex,
                    hex,
                  });
                }
              }}
            >
              {settings.abbreviateLongStackItems
                ? abbreviateStackItem(label)
                : label}
            </span>,
          );
        })
      )}
    </div>
  );
};

type DiffSegment = { i: number; expected: string; got: string };

const diffHexBytes = (
  expectedHex: string,
  receivedHex: string,
): DiffSegment[] => {
  const segments: DiffSegment[] = [];
  const maxChars = Math.max(expectedHex.length, receivedHex.length);

  for (let pos = 0; pos < maxChars; pos += 2) {
    const expectedByte = expectedHex.slice(pos, pos + 2);
    const receivedByte = receivedHex.slice(pos, pos + 2);

    if (expectedByte !== receivedByte) {
      const byteIndex = pos / 2;
      const last = segments[segments.length - 1];
      last && last.i + last.expected.length / 2 === byteIndex
        ? ((last.expected += expectedByte), (last.got += receivedByte))
        : segments.push({
            i: byteIndex,
            expected: expectedByte,
            got: receivedByte,
          });
    }
  }
  return segments;
};

const fade = 'color:#888;';
const highlight = 'font-weight:bold;';
const buildStyledLog = (
  hex: string,
  diffs: DiffSegment[],
  side: 'expected' | 'got',
): [string, ...string[]] => {
  let fmt = '';
  const styles: string[] = [];
  let cursor = 0;
  for (const { i, expected, got } of diffs) {
    const diffBytes = side === 'expected' ? expected : got;
    const start = i * 2;
    if (start > cursor) {
      const slice = hex.slice(cursor, start);
      fmt += `%c${slice}`;
      styles.push(fade);
    }
    fmt += `%c${diffBytes}`;
    styles.push(highlight);
    cursor = start + diffBytes.length;
  }
  if (cursor < hex.length) {
    fmt += `%c${hex.slice(cursor)}`;
    styles.push(fade);
  }
  return [fmt, ...styles];
};

type StackItemDifferState = {
  diffNext: boolean;
  lineNumber: number;
  itemIndex: number;
  hex: string;
};
const initialStackItemDifferState: StackItemDifferState = {
  diffNext: false,
  lineNumber: 0,
  itemIndex: 0,
  hex: '',
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
      iconProps={{ size: 12 }}
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
          (ScenarioSwitcherSpecialValues.defaultScenario as string)
        ) {
          /**
           * If the default scenario is showing, there are no
           * other scenarios to switch to/from, so we can
           * just ignore this selection.
           */
          return;
        }
        if (
          e.currentTarget.value ===
          (ScenarioSwitcherSpecialValues.editScenarios as string)
        ) {
          const flag = '_editScenariosWIPHasBeenExplained';
          const explanation = `Bitauth IDE does not yet have a simplified interface for editing scenarios, but scenarios can still be edited directly in the template. Add or make changes to the "scenarios" property in the template JSON, then import your changes to finish. See the guide for information about scenarios.`;
          console.log(explanation);
          importExport();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
          if ((window as any)[flag] === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
            (window as any)[flag] = true;
            setTimeout(() => {
              window.alert(explanation);
            }, 1000);
          }
          return;
        }
        const scenarioId = e.currentTarget.value;
        const nextScenario = scenarioDetails.availableScenarios.find(
          (available) => available.id === scenarioId,
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
          content="Currently showing the stack. Click to switch to the alternate stack."
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
          <Error className="shrink scenario-detail-icon scenario-generation-error" />
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
                  ? 'This is the default scenario. To modify this scenario or test for failure, add a scenario to this script.'
                  : `This scenario is expected to ${
                      scenarioDetails.selectedScenario.expectedToPass
                        ? 'pass'
                        : 'fail'
                    }.`}
              </p>
              <p>
                {`The scenario ${
                  typeof scenarioDetails.verifyResult === 'string'
                    ? `failed with the error: ${scenarioDetails.verifyResult}`
                    : 'passed.'
                }`}
              </p>
              <p className="scenario-logging-options">
                <button
                  onClick={() => {
                    console.log('Scenario Generation Debugging Result:');
                    console.log(scenarioDetails.generatedScenario);
                  }}
                >
                  Log Scenario Generation Result to Developer Console
                </button>
                <button
                  onClick={() => {
                    if (debugTrace !== undefined) {
                      console.log('Trace Summary:');
                      console.log(
                        stringifyDebugTraceSummary(
                          summarizeDebugTrace(debugTrace),
                        ),
                      );
                    }
                    console.log('Debug Trace:');
                    console.log(debugTrace);
                  }}
                >
                  Log Debug Trace to Developer Console
                </button>
              </p>
              <code className="generated-scenario">
                <pre>
                  {scenarioDetails.generatedScenario === undefined
                    ? 'Generating scenario...'
                    : stringify(scenarioDetails.generatedScenario.scenario)}
                </pre>
              </code>
            </div>
          }
          portalClassName="control-popover"
          interactionKind="hover"
          placement="auto"
        >
          {(scenarioDetails.verifyResult === true &&
            (scenarioDetails.selectedScenario === undefined ||
              scenarioDetails.selectedScenario.expectedToPass)) ||
          (typeof scenarioDetails.verifyResult === 'string' &&
            scenarioDetails.selectedScenario?.expectedToPass === false) ? (
            <Tick className="shrink scenario-detail-icon" />
          ) : (
            <Cross className="shrink scenario-detail-icon scenario-detail-icon-error" />
          )}
        </Popover>
      )}

      {evaluationViewerSettings.vmNumbersDisplayFormat === 'integer' ? (
        <Tooltip
          content="Showing VM Numbers in integer format"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                vmNumbersDisplayFormat: evaluationViewerSettings.supportBigInt
                  ? 'bigint'
                  : 'hex',
              });
            }}
          >
            <span className="number-format">123</span>
          </Button>
        </Tooltip>
      ) : evaluationViewerSettings.vmNumbersDisplayFormat === 'bigint' ? (
        <Tooltip
          content="Showing VM Numbers in integer format (up to maximum length)"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                vmNumbersDisplayFormat: 'hex',
              });
            }}
          >
            <span className="number-format">123...</span>
          </Button>
        </Tooltip>
      ) : evaluationViewerSettings.vmNumbersDisplayFormat === 'hex' ? (
        <Tooltip
          content="Showing VM Numbers in hex format"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                vmNumbersDisplayFormat: 'binary',
              });
            }}
          >
            <span className="number-format">0x</span>
          </Button>
        </Tooltip>
      ) : (
        <Tooltip
          content="Showing VM Numbers in binary format"
          portalClassName="control-tooltip"
          position="bottom-right"
        >
          <Button
            onClick={() => {
              changeEvaluationViewerSettings({
                ...evaluationViewerSettings,
                vmNumbersDisplayFormat: 'integer',
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
            icon={<Maximize />}
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
            icon={<Minimize />}
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
            icon={<Pin />}
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
            icon={<Unpin />}
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
            icon={<UngroupObjects />}
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
            icon={<GroupObjects />}
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
            icon={<GroupObjects />}
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
            icon={<Undo />}
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
            icon={<Redo />}
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
  isProcessing: boolean;
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
  const [stackItemDifferState, setStackItemDifferState] =
    useState<StackItemDifferState>(initialStackItemDifferState);

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
    setCachedEvaluation(evaluationLines);
    setCachedLookup({ lookup });
    return null;
  }

  const cacheIsAvailable = cachedEvaluation.length !== 0;
  const showCached = hasError && cacheIsAvailable;
  const fadeCached = showCached; // && props.isProcessing; // TODO: props.isProcessing should be false for compilation errors in tested scripts
  const evaluation = showCached ? cachedEvaluation : evaluationLines;
  const activeLookup = showCached ? cachedLookup.lookup : lookup;

  return (
    <div
      className={`EvaluationViewer EvaluationViewer-${frame.scriptType}`}
      ref={props.viewerRef}
    >
      <div className={`content${fadeCached ? ' cached' : ''}`}>
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
                    line={evaluation[0]!}
                    lineNumber={0}
                    lookup={activeLookup}
                    settings={props.evaluationViewerSettings}
                    changeEvaluationViewerSettings={
                      props.changeEvaluationViewerSettings
                    }
                    stackItemDifferState={stackItemDifferState}
                    setStackItemDifferState={setStackItemDifferState}
                  />
                )}
              </div>
            </div>

            <div className="evaluation">
              {evaluation.slice(1).map((line, lineIndex) => (
                <EvaluationLine
                  hasError={line.state?.error !== undefined}
                  hasActiveCursor={props.cursorLine === lineIndex + 1}
                  key={lineIndex}
                  line={line}
                  lineNumber={lineIndex + 1}
                  lookup={activeLookup}
                  settings={props.evaluationViewerSettings}
                  changeEvaluationViewerSettings={
                    props.changeEvaluationViewerSettings
                  }
                  stackItemDifferState={stackItemDifferState}
                  setStackItemDifferState={setStackItemDifferState}
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
                CompilationErrorLine({ error, range, frame }),
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
