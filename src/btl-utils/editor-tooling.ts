import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import {
  EvaluationViewerLine,
  IDESupportedProgramState,
  EvaluationViewerSpacer,
} from '../editor/editor-types';
import {
  EvaluationSample,
  Range,
  range,
  containsRange,
} from '@bitauth/libauth';

export interface MonacoMarkerDataRequired {
  severity: monacoEditor.MarkerSeverity;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

const getExecutionSpacers = (
  controlStack: IDESupportedProgramState['controlStack']
) =>
  controlStack.map((isExecuting) =>
    isExecuting === true
      ? EvaluationViewerSpacer.executedConditional
      : EvaluationViewerSpacer.skippedConditional
  );

/**
 * @param samples a list of samples ordered by their ending position
 * @param totalLines the total number of lines to return (lines after the last
 * sample will be empty)
 */
export const samplesToEvaluationLines = <
  ProgramState extends IDESupportedProgramState
>(
  samples: EvaluationSample<ProgramState>[],
  totalLines: number
): EvaluationViewerLine<ProgramState>[] => {
  if (samples.length === 0) {
    return [];
  }

  const rootIdentifier = 'root';
  const evaluationIdentifier = (evaluationRange: Range) =>
    `${evaluationRange.startLineNumber},${evaluationRange.startColumn}`;
  const uniqueEvaluations = samples.reduce<{
    [beginLineAndColumn: string]: {
      /**
       * either 'root' or the key of the parent evaluation in
       * `uniqueEvaluations`
       */
      parentEvaluation: string;
      evaluationRange: Range;
      spacers: EvaluationViewerSpacer[];
    };
  }>((evaluations, sample) => {
    const parentEvaluations = Object.entries(evaluations).filter(
      ([beginLineAndColumn, value]) =>
        containsRange(value.evaluationRange, sample.evaluationRange)
    );
    /**
     * Samples are already sorted, so the last item is always the direct
     * parent. (Previous item is the grandparent, etc.)
     */
    const directParent = parentEvaluations[parentEvaluations.length - 1] as
      | typeof parentEvaluations[number]
      | undefined;

    /**
     * The beginLineAndColumn of this evaluation.
     */
    const parentEvaluation = directParent?.[0] ?? rootIdentifier;

    const parentSpacers =
      parentEvaluation === rootIdentifier
        ? []
        : evaluations[parentEvaluation].spacers;

    const evaluationStartId = evaluationIdentifier(sample.evaluationRange);
    const evaluationIsAlreadyIdentified = evaluationStartId in evaluations;
    return {
      ...evaluations,
      ...(evaluationIsAlreadyIdentified
        ? {}
        : {
            [evaluationIdentifier(sample.evaluationRange)]: {
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
  const initialStateIndex = 0;
  const finalLineContents = samples.reduce<{
    hasError: boolean;
    lines: {
      [line: number]: {
        sample: EvaluationSample<ProgramState>;
        spacers: EvaluationViewerSpacer[] | undefined;
      };
    };
  }>(
    (contents, sample) => {
      if (contents.hasError) {
        return {
          hasError: true,
          lines: {
            ...contents.lines,
            [sample.range.endLineNumber]: { spacers: [], sample },
          },
        };
      }
      const parentEvaluation =
        uniqueEvaluations[evaluationIdentifier(sample.evaluationRange)];
      const spacers = [
        ...parentEvaluation.spacers,
        ...getExecutionSpacers(sample.state.controlStack),
      ];
      return {
        hasError: sample.state.error !== undefined,
        lines: {
          ...contents.lines,
          [sample.range.endLineNumber]: { sample, spacers },
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
          sample: samples[initialStateIndex],
          spacers: undefined,
        },
      },
    }
  );

  const definedLinesReversed = Object.keys(finalLineContents.lines).reverse();
  const lines = range(totalLines).map<EvaluationViewerLine<ProgramState>>(
    (lineNumber) => {
      const mostRecentDefinedLineNumber = Number(
        definedLinesReversed.find(
          (definedLineNumber) => Number(definedLineNumber) <= lineNumber
        ) ?? initialStateIndex
      );
      const lineHasNewSample = mostRecentDefinedLineNumber === lineNumber;
      const { sample, spacers } =
        finalLineContents.lines[mostRecentDefinedLineNumber];
      const line: EvaluationViewerLine<ProgramState> = {
        spacers,
        ...(lineHasNewSample ? { state: sample.state } : {}),
      };
      return line;
    }
  );

  if (finalLineContents.hasError) {
    /**
     * Hide any stray spacers after an error occurs.
     */
    const linesTrimmedAfterError = lines.map((line) =>
      line.state === undefined ? {} : line
    );
    return linesTrimmedAfterError;
  }

  return lines;
};
