import {
  EvaluationViewerLine,
  EvaluationViewerSpacer,
} from '../editor/editor-types';
import {
  EvaluationViewerSettings,
  IDESupportedProgramState,
} from '../state/types';

import {
  containsRange,
  EvaluationSample,
  Range,
  range,
  rangesAreEqual,
} from '@bitauth/libauth';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';

export type MonacoMarkerDataRequired = {
  severity: monacoEditor.MarkerSeverity;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

const getExecutionSpacers = (
  controlStack: IDESupportedProgramState['controlStack'],
) =>
  controlStack.map((item) =>
    typeof item === 'number'
      ? EvaluationViewerSpacer.loop
      : item
        ? EvaluationViewerSpacer.executedConditional
        : EvaluationViewerSpacer.skippedConditional,
  );

/**
 * @param samples a list of samples ordered by their ending position
 * @param totalLines the total number of lines to return (lines after the last
 * sample will be empty)
 */
export const samplesToEvaluationLines = <
  ProgramState extends IDESupportedProgramState,
>(
  samples: EvaluationSample<ProgramState>[],
  totalLines: number,
  loopViewingIndexes: EvaluationViewerSettings['loopViewingIndexes'],
): EvaluationViewerLine<ProgramState>[] => {
  if (samples.length === 0) {
    return [];
  }

  const rootIdentifier = 'root';
  const evaluationIdentifier = (evaluationRange: Range) =>
    `${evaluationRange.startLineNumber},${evaluationRange.startColumn}`;
  type UniqueEvaluation = {
    latestSample: EvaluationSample<ProgramState>;
    /**
     * either 'root' or the key of the parent evaluation in
     * `uniqueEvaluations`
     */
    parentEvaluation: string;
    evaluationRange: Range;
    spacers: EvaluationViewerSpacer[];
  };
  const uniqueEvaluations = samples.reduce<{
    [beginLineAndColumn: string]: UniqueEvaluation;
  }>((evaluations, sample) => {
    const parentEvaluations = Object.entries(evaluations).filter(([, value]) =>
      containsRange(value.evaluationRange, sample.evaluationRange),
    );
    /**
     * Samples are already sorted, so the last item is always the direct
     * parent. (Previous item is the grandparent, etc.)
     */
    const directParent = parentEvaluations[parentEvaluations.length - 1] as
      | (typeof parentEvaluations)[number]
      | undefined;

    /**
     * The beginLineAndColumn of this evaluation.
     */
    const parentEvaluation = directParent?.[0] ?? rootIdentifier;

    const parentSpacers =
      parentEvaluation === rootIdentifier
        ? []
        : [
            ...evaluations[parentEvaluation]!.spacers,
            ...getExecutionSpacers(
              evaluations[parentEvaluation]!.latestSample.state.controlStack,
            ),
          ];

    const evaluationStartId = evaluationIdentifier(sample.evaluationRange);
    const evaluationIsAlreadyIdentified = evaluationStartId in evaluations;
    return {
      ...evaluations,
      ...(evaluationIsAlreadyIdentified
        ? {
            [evaluationStartId]: {
              ...evaluations[evaluationStartId],
              latestSample: sample,
            } as UniqueEvaluation,
          }
        : {
            [evaluationStartId]: {
              latestSample: sample,
              parentEvaluation,
              evaluationRange: sample.evaluationRange,
              spacers: [
                ...parentSpacers,
                ...(parentEvaluation === rootIdentifier
                  ? []
                  : [EvaluationViewerSpacer.evaluation]),
                ...getExecutionSpacers(sample.state.controlStack),
              ],
            },
          }),
    };
  }, {});

  /**
   * A mapping of `ip` indexes at which visible loops begin (`OP_BEGIN`) to
   * information about that loop.
   */
  const loopMap = samples.reduce<{
    [loopId: string]: {
      beginsAtSample: number;
      endsAtSample: number;
      evaluationRange: Range;
      iterationStateCount: number;
    };
  }>((map, sample, sampleIndex) => {
    const [loopStartIp] = sample.state.controlStack.slice(-1);
    if (typeof loopStartIp !== 'number') return map;
    const loopId = `${sample.evaluationRange.startLineNumber}-${sample.evaluationRange.startColumn}-${loopStartIp}`;
    if (map[loopId] === undefined) {
      map[loopId] = {
        beginsAtSample: sampleIndex,
        endsAtSample: sampleIndex + 1,
        evaluationRange: sample.evaluationRange,
        /**
         * `sample.state` is the first state; `iterations` contains only the
         * remaining states following each repeated execution. Count is
         * incremented by one to account for the initial state.
         */

        iterationStateCount: sample.iterations!.length + 1,
      };
    } else {
      map[loopId]!.endsAtSample = sampleIndex;
    }
    return map;
  }, {});
  const loopViewingInfo = Object.keys(loopMap)
    .sort((a, b) => Number(a) - Number(b))
    .map((loopId, loopIndex) => ({
      loopId,
      ...loopMap[loopId]!,
      viewingIteration: loopViewingIndexes[loopIndex] ?? 0,
      maxIterationIndex: 0,
    }));
  const samplesWithLoopViewingInfo = range(samples.length).map((index) => ({
    sample: samples[index],
    stateOffset: 0,
    offsetMultiple: 1,
    activeLoops: [] as number[],
  }));
  loopViewingInfo.forEach((loopInfo, loopIndex) => {
    samplesWithLoopViewingInfo.forEach((item, index) => {
      if (
        item.sample !== undefined &&
        rangesAreEqual(loopInfo.evaluationRange, item.sample.evaluationRange) &&
        loopInfo.beginsAtSample <= index &&
        loopInfo.endsAtSample >= index
      ) {
        item.activeLoops.push(loopIndex);
        const requestedStateOffset =
          item.stateOffset + item.offsetMultiple * loopInfo.viewingIteration;
        if (
          index === loopInfo.beginsAtSample &&
          item.sample.iterations?.[requestedStateOffset - 1] === undefined
        ) {
          loopInfo.viewingIteration = 0;
          loopViewingInfo[loopIndex]!.viewingIteration = 0;
        }
        item.stateOffset += item.offsetMultiple * loopInfo.viewingIteration;
        item.offsetMultiple += loopInfo.viewingIteration;
      }
    });
    const parentActiveLoops = samplesWithLoopViewingInfo[
      loopInfo.beginsAtSample
    ]!.activeLoops.slice(0, -1);
    const parentIterations =
      parentActiveLoops.length === 0
        ? 0
        : loopViewingInfo[parentActiveLoops[parentActiveLoops.length - 1]!]!
            .iterationStateCount;
    const maxIterations =
      parentIterations === 0
        ? loopInfo.iterationStateCount
        : loopInfo.iterationStateCount / parentIterations;
    loopInfo.maxIterationIndex = maxIterations - 1;
  });

  const initialStateIndex = 0;
  const finalLineContents = samplesWithLoopViewingInfo.reduce<{
    hasError: boolean;
    lines: {
      [line: number]: {
        activeLoops: number[];
        sample: EvaluationSample<ProgramState>;
        spacers: EvaluationViewerSpacer[] | undefined;
        stateOffset: number;
      };
    };
  }>(
    (contents, sampleWrapper) => {
      const sample = sampleWrapper.sample!;
      const { stateOffset, activeLoops } = sampleWrapper;
      if (contents.hasError) {
        return {
          hasError: true,
          lines: {
            ...contents.lines,
            [sample.range.endLineNumber]: {
              activeLoops,
              sample,
              spacers: [],
              stateOffset,
            },
          },
        };
      }
      const parentEvaluation =
        uniqueEvaluations[evaluationIdentifier(sample.evaluationRange)]!;
      const spacers = [
        ...parentEvaluation.spacers,
        ...getExecutionSpacers(sample.state.controlStack),
      ];
      return {
        hasError: sample.state.error !== undefined,
        lines: {
          ...contents.lines,
          [sample.range.endLineNumber]: {
            activeLoops,
            sample,
            spacers,
            stateOffset,
          },
        },
      };
    },
    {
      hasError: false,
      lines: {
        /**
         * The zero-th line for each frame must be the initial state of that frame.
         */
        [initialStateIndex]: {
          activeLoops: [],
          sample: samples[initialStateIndex]!,
          spacers: undefined,
          stateOffset: 0,
        },
      },
    },
  );

  const definedLinesReversed = Object.keys(finalLineContents.lines).reverse();
  const linesWithLoopInfo = range(totalLines).map<{
    activeLoops: number[];
    line: EvaluationViewerLine<ProgramState>;
  }>((lineNumber) => {
    const mostRecentDefinedLineNumber = Number(
      definedLinesReversed.find(
        (definedLineNumber) => Number(definedLineNumber) <= lineNumber,
      ) ?? initialStateIndex,
    );
    const lineHasNewSample = mostRecentDefinedLineNumber === lineNumber;
    const { activeLoops, sample, spacers, stateOffset } =
      finalLineContents.lines[mostRecentDefinedLineNumber]!;
    const line: EvaluationViewerLine<ProgramState> = {
      spacers: spacers?.slice(),
      ...(lineHasNewSample
        ? {
            state:
              stateOffset === 0
                ? sample.state
                : sample.iterations![stateOffset - 1]!,
          }
        : {}),
    };
    return { activeLoops, line };
  });

  const markedBeginning = range(loopViewingInfo.length).map(() => false);
  const lines = linesWithLoopInfo.map(({ activeLoops, line }) => {
    activeLoops.forEach((activeLoop) => {
      if (markedBeginning[activeLoop] === false) {
        markedBeginning[activeLoop] = true;
        const index = line.spacers!.lastIndexOf(EvaluationViewerSpacer.loop);
        const maximumIterationIndex =
          loopViewingInfo[activeLoop]!.maxIterationIndex;
        const iterationIndex = loopViewingInfo[activeLoop]!.viewingIteration;
        line.spacers!.splice(index, 1, {
          iterationIndex,
          maximumIterationIndex,
          loopIndex: activeLoop,
        });
      }
    });
    return line;
  });

  if (finalLineContents.hasError) {
    /**
     * Hide any stray spacers after an error occurs.
     */
    const linesTrimmedAfterError = lines.map((line) =>
      line.state === undefined ? {} : line,
    );
    return linesTrimmedAfterError;
  }

  return lines;
};
