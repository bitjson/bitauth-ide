import {
  Range,
  CompilationResultResolve,
  ResolvedScript,
  CompilationResultReduce,
  ScriptReductionTraceChildNode,
  ScriptReductionTraceContainerNode,
  binToHex,
  BuiltInVariables
} from 'bitcoin-ts';
import React, { useEffect, useState } from 'react';
import MonacoEditor from 'react-monaco-editor';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import {
  bitauthTemplatingLanguage,
  bitauthDark,
  monacoOptions,
  prepMonaco
} from './monaco-config';
import './ScriptEditor.scss';
import { ActionCreators } from '../../state/reducer';
import { MonacoMarkerDataRequired } from '../../btl-utils/editor-tooling';
import {
  ScriptType,
  CurrentScripts,
  VariableDetails,
  ScriptDetails
} from '../../state/types';
import { getScriptTooltipIcon } from '../project-explorer/ProjectExplorer';
import { Icon } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import { EditScriptDialog } from '../dialogs/edit-script-dialog/EditScriptDialog';
import { wrapInterfaceTooltip } from '../common';
import { CompilationResult } from 'bitcoin-ts';
import { IDESupportedProgramState } from '../editor-types';
import {
  opcodeHoverProviderBCH,
  opcodeCompletionItemProviderBCH,
  isCorrectScript,
  builtInVariableDetails,
  getSigningSerializationOperationDetails,
  getKeyOperationDetails,
  getKeyOperationDescriptions,
  keyOperationsWhichRequireAParameter,
  signatureOperationParameterDescriptions,
  signingSerializationOperationDetails
} from './bch-language';

const cursorIsAtEndOfRange = (
  cursor: { column: number; lineNumber: number },
  range: Range
) =>
  cursor.lineNumber === range.endLineNumber &&
  cursor.column === range.endColumn;

const isWithinRange = (
  position: { lineNumber: number; column: number },
  range: Range
) =>
  ((range.startLineNumber < position.lineNumber ||
    (range.startLineNumber === position.lineNumber &&
      range.startColumn < position.column)) &&
    range.endLineNumber > position.lineNumber) ||
  (range.endLineNumber === position.lineNumber &&
    range.endColumn > position.column);

const selectResolvedSegmentAtPosition = (
  resolvedScript: ResolvedScript,
  position: { lineNumber: number; column: number }
): ResolvedScript[number] | undefined => {
  const firstMatch = resolvedScript.find(segment =>
    isWithinRange(position, segment.range)
  );
  if (firstMatch !== undefined && Array.isArray(firstMatch.value)) {
    const internalSelected = selectResolvedSegmentAtPosition(
      firstMatch.value,
      position
    );
    return internalSelected === undefined ? firstMatch : internalSelected;
  }
  return firstMatch;
};

const selectReductionSourceSegmentAtPosition = (
  reduce: ScriptReductionTraceChildNode<IDESupportedProgramState>,
  position: { lineNumber: number; column: number }
): ScriptReductionTraceChildNode<IDESupportedProgramState> | undefined => {
  const matchesRange = isWithinRange(position, reduce.range);
  if (matchesRange) {
    const container = reduce as ScriptReductionTraceContainerNode<
      IDESupportedProgramState
    >;
    if (Array.isArray(container.source)) {
      const firstMatch = container.source
        .map(child => selectReductionSourceSegmentAtPosition(child, position))
        .filter(selected => selected !== undefined)[0];
      return firstMatch === undefined ? container : firstMatch;
    }
    return reduce;
  }
  return undefined;
};

const updateMarkers = (
  monaco: typeof monacoEditor,
  editor: monacoEditor.editor.IStandaloneCodeEditor,
  compilation: CompilationResult,
  script: string
) => () => {
  const model = editor.getModel();
  /**
   * Avoid updating markers if the script has changed. (This prevents error
   * markers from flashing on/off while typing.)
   */
  if (model !== null && model.getValue() === script) {
    let markers: MonacoMarkerDataRequired[] = [];
    if (compilation.success !== true) {
      const raw = compilation.errors.map<MonacoMarkerDataRequired>(error => ({
        ...error.range,
        severity: monacoEditor.MarkerSeverity.Error,
        message: error.error
      }));
      const cursor = editor.getPosition();
      const hasFocus = editor.hasTextFocus();
      /**
       * Hide the error if this editor is in focus and the cursor is
       * currently at the end of the error's range (to be less annoying
       * while typing).*/
      markers =
        hasFocus && cursor !== null
          ? raw.filter(marker => !cursorIsAtEndOfRange(cursor, marker))
          : raw;
    }
    monaco.editor.setModelMarkers(model, '', markers);
  }
};

export const ScriptEditor = (props: {
  isP2SH: boolean;
  script: string;
  scriptType: ScriptType;
  internalId: string;
  id: string;
  name: string;
  compilation: CompilationResult;
  scriptDetails: ScriptDetails;
  variableDetails: VariableDetails;
  setScrollOffset: React.Dispatch<React.SetStateAction<number>>;
  currentScripts: CurrentScripts;
  editScript: typeof ActionCreators.editScript;
  deleteScript: typeof ActionCreators.deleteScript;
  updateScript: typeof ActionCreators.updateScript;
}) => {
  const [editor, setEditor] = useState(
    undefined as undefined | monacoEditor.editor.IStandaloneCodeEditor
  );
  const [monaco, setMonaco] = useState(
    undefined as undefined | typeof monacoEditor
  );
  const [editScriptDialogIsOpen, setEditScriptDialogIsOpen] = useState(false);
  const [latestInternalId, setLatestInternalId] = useState('');

  const handleResize = () => editor && editor.layout();
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  useEffect(() => {
    if (monaco !== undefined && editor !== undefined) {
      const bytecodeHoverProvider = monaco.languages.registerHoverProvider(
        bitauthTemplatingLanguage,
        {
          provideHover: (model, position) => {
            if (!isCorrectScript(model, props.script)) {
              return;
            }
            const resolve = (props.compilation as CompilationResultResolve)
              .resolve as ResolvedScript | undefined;
            const reduce = (props.compilation as CompilationResultReduce<
              IDESupportedProgramState
            >).reduce as
              | CompilationResultReduce<IDESupportedProgramState>['reduce']
              | undefined;
            if (resolve && reduce) {
              const resolvedSegment = selectResolvedSegmentAtPosition(
                resolve,
                position
              );
              if (resolvedSegment && resolvedSegment.type === 'comment') {
                return;
              }
              const segment = selectReductionSourceSegmentAtPosition(
                reduce,
                position
              );
              /**
               * Don't provide bytecode hover for the top-level segment to
               * avoid being annoying/distracting.
               */
              if (segment !== undefined && segment !== reduce) {
                return {
                  contents: [
                    {
                      value: `**Compiled**: \`0x${binToHex(segment.bytecode)}\``
                    }
                  ],
                  range: segment.range
                };
              }
            }
          }
        }
      );
      /**
       * We register here to ensure opcode hover information appears above the
       * bytecode hover information.
       */
      const opcodeHoverProvider = monaco.languages.registerHoverProvider(
        bitauthTemplatingLanguage,
        opcodeHoverProviderBCH(props.script)
      );
      const identifierHoverProvider = monaco.languages.registerHoverProvider(
        bitauthTemplatingLanguage,
        {
          provideHover: (model, position) => {
            if (!isCorrectScript(model, props.script)) {
              return;
            }
            const resolve = (props.compilation as CompilationResultResolve)
              .resolve as ResolvedScript | undefined;
            if (resolve) {
              const segment = selectResolvedSegmentAtPosition(
                resolve,
                position
              );
              if (segment !== undefined && segment.type === 'bytecode') {
                const range = segment.range;
                if ('variable' in segment) {
                  const parts = segment.variable.split('.');
                  const variableId = parts[0];
                  switch (variableId) {
                    case BuiltInVariables.currentBlockTime:
                    case BuiltInVariables.currentBlockHeight:
                      return {
                        contents: [
                          {
                            value: `**${builtInVariableDetails[variableId][0]}**`
                          },
                          {
                            value: builtInVariableDetails[variableId][1]
                          }
                        ],
                        range
                      };
                    case BuiltInVariables.signingSerialization:
                      const {
                        description,
                        name
                      } = getSigningSerializationOperationDetails(parts[1]);
                      return {
                        contents: [
                          {
                            value: `**${name}**`
                          },
                          {
                            value: description
                          }
                        ],
                        range
                      };
                    default:
                      const details = props.variableDetails[variableId];
                      if (details !== undefined) {
                        const {
                          hasOperation,
                          operationName,
                          operationDescription
                        } = getKeyOperationDetails(parts);
                        return {
                          contents: [
                            {
                              value: `${
                                details.variable.name
                                  ? `**${details.variable.name}**`
                                  : ''
                              } – ${
                                hasOperation
                                  ? operationName
                                  : details.variable.type
                              } (${details.entity.name})`
                            },
                            ...(hasOperation
                              ? [{ value: operationDescription as string }]
                              : []),
                            ...(details.variable.description
                              ? [{ value: details.variable.description }]
                              : [])
                          ],
                          range
                        };
                      }
                  }
                } else if ('script' in segment) {
                  const details = props.scriptDetails[segment.script];
                  if (details !== undefined) {
                    return {
                      contents: [
                        {
                          value: `**${details.name}** – Script`
                        }
                      ],
                      range
                    };
                  }
                }
              }
            } else {
              /**
               * resolve is not available (i.e. a parse error occurred)
               */
              const query = model.getWordAtPosition(position);
              if (query !== null) {
                const details = props.variableDetails[query.word];
                if (details !== undefined) {
                  return {
                    contents: [
                      {
                        value: `**${details.variable.name}** – ${details.variable.type} (${details.entity.name})`
                      },
                      ...(details.variable.description
                        ? [{ value: details.variable.description }]
                        : [])
                    ]
                  };
                }
              }
            }
          }
        }
      );

      const opcodeCompletionProvider = monaco.languages.registerCompletionItemProvider(
        bitauthTemplatingLanguage,
        opcodeCompletionItemProviderBCH
      );

      const variableCompletionProvider = monaco.languages.registerCompletionItemProvider(
        bitauthTemplatingLanguage,
        {
          provideCompletionItems: (model, position) => {
            if (!isCorrectScript(model, props.script)) {
              return;
            }
            const contentBeforePosition = model.getValueInRange({
              startColumn: 1,
              startLineNumber: position.lineNumber,
              endColumn: position.column,
              endLineNumber: position.lineNumber
            });
            const lastValidIdentifier = /[a-zA-Z_][.a-zA-Z0-9_-]*$/;
            const match = contentBeforePosition.match(lastValidIdentifier);
            /**
             * If match is `null`, the user manually triggered autocomplete:
             * show all potential variable options.
             */
            const assumedMatch = match === null ? [''] : match;
            const parts = assumedMatch[0].split('.');
            const targetId = parts[0];
            const operation = parts[1] as string | undefined;
            const parameter = parts[2] as string | undefined;

            const word = model.getWordUntilPosition(position);
            const range: Range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn
            };

            if (operation === undefined) {
              return {
                suggestions: [
                  ...Object.entries(props.variableDetails)
                    .filter(([id]) => id.indexOf(targetId) !== -1)
                    .map<monacoEditor.languages.CompletionItem>(
                      ([id, { variable, entity }]) => {
                        const triggerNextSuggestion =
                          variable.type === 'Key' || variable.type === 'HDKey';
                        return {
                          label: id,
                          detail: `${variable.name} – ${variable.type} (${entity.name})`,
                          documentation: variable.description,
                          kind: monaco.languages.CompletionItemKind.Variable,
                          insertText: triggerNextSuggestion ? `${id}.` : id,
                          range,
                          ...(triggerNextSuggestion
                            ? {
                                command: {
                                  id: 'editor.action.triggerSuggest',
                                  title: 'Suggest Operation'
                                }
                              }
                            : {})
                        };
                      }
                    ),
                  ...Object.entries(props.scriptDetails)
                    .filter(([id]) => id.indexOf(targetId) !== -1)
                    .map<monacoEditor.languages.CompletionItem>(
                      ([id, script]) => ({
                        label: id,
                        detail: `${script.name} – Script`,
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: id,
                        range
                      })
                    ),
                  ...Object.entries(builtInVariableDetails)
                    .filter(([id]) => id.indexOf(targetId) !== -1)
                    .map<monacoEditor.languages.CompletionItem>(
                      ([id, [name, description]]) => {
                        const triggerNextSuggestion =
                          id === BuiltInVariables.signingSerialization;
                        return {
                          label: id,
                          detail: name,
                          documentation: description,
                          kind: monaco.languages.CompletionItemKind.Variable,
                          insertText: triggerNextSuggestion ? `${id}.` : id,
                          range,
                          ...(triggerNextSuggestion
                            ? {
                                command: {
                                  id: 'editor.action.triggerSuggest',
                                  title: 'Suggest Operation'
                                }
                              }
                            : {})
                        };
                      }
                    )
                ]
              };
            }

            const details = props.variableDetails[targetId] as
              | VariableDetails[string]
              | undefined;

            if (
              details === undefined ||
              (details.variable.type !== 'HDKey' &&
                details.variable.type !== 'Key')
            ) {
              if (targetId === BuiltInVariables.signingSerialization) {
                return {
                  suggestions: Object.entries(
                    signingSerializationOperationDetails
                  )
                    .filter(([op]) => op.indexOf(operation) !== -1)
                    .map<monacoEditor.languages.CompletionItem>(
                      ([op, [name, description]]) => ({
                        label: op,
                        detail: name,
                        documentation: description,
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: op,
                        range
                      })
                    )
                };
              }
              return;
            }

            if (parameter === undefined) {
              const descriptions = getKeyOperationDescriptions();
              return {
                suggestions: Object.entries(descriptions)
                  .filter(([op]) => op.indexOf(operation) !== -1)
                  .map<monacoEditor.languages.CompletionItem>(
                    ([op, descriptions]) => {
                      const requiresParameter =
                        keyOperationsWhichRequireAParameter.indexOf(op) !== -1;
                      return {
                        label: op,
                        detail: descriptions[0],
                        documentation: descriptions[1],
                        kind: monaco.languages.CompletionItemKind.Function,
                        insertText: requiresParameter ? `${op}.` : op,
                        range,
                        ...(requiresParameter
                          ? {
                              command: {
                                id: 'editor.action.triggerSuggest',
                                title: 'Suggest Parameter'
                              }
                            }
                          : {})
                      };
                    }
                  )
              };
            }

            if (keyOperationsWhichRequireAParameter.indexOf(operation) === -1) {
              return;
            }

            if (
              operation === 'signature' ||
              operation === 'schnorr_signature'
            ) {
              return {
                suggestions: Object.entries(
                  signatureOperationParameterDescriptions
                )
                  .filter(([param]) => param.indexOf(parameter) !== -1)
                  .map<monacoEditor.languages.CompletionItem>(
                    ([param, descriptions]) => ({
                      label: param,
                      detail: descriptions[0],
                      documentation: descriptions[1],
                      kind: monaco.languages.CompletionItemKind.Function,
                      insertText: param,
                      range
                    })
                  )
              };
            } else if (
              operation === 'data_signature' ||
              operation === 'schnorr_data_signature'
            ) {
              return {
                suggestions: Object.entries(props.scriptDetails)
                  .filter(([id]) => id.indexOf(parameter) !== -1)
                  .map<monacoEditor.languages.CompletionItem>(
                    ([id, scriptInfo]) => ({
                      label: id,
                      detail: scriptInfo.name,
                      kind: monaco.languages.CompletionItemKind.Variable,
                      insertText: id,
                      range
                    })
                  )
              };
            } else {
              console.error(`Unexpected key operation: ${operation}.`);
              return;
            }
          },
          triggerCharacters: ['.']
        }
      );

      const update = updateMarkers(
        monaco,
        editor,
        props.compilation,
        props.script
      );
      update();
      const watchCursor = editor.onDidChangeCursorPosition(update);
      const watchFocus = editor.onDidFocusEditorText(update);
      const watchBlur = editor.onDidBlurEditorText(update);
      return () => {
        bytecodeHoverProvider.dispose();
        opcodeHoverProvider.dispose();
        identifierHoverProvider.dispose();
        opcodeCompletionProvider.dispose();
        variableCompletionProvider.dispose();
        watchCursor.dispose();
        watchFocus.dispose();
        watchBlur.dispose();
      };
    }
  });

  if (latestInternalId !== props.internalId) {
    /**
     * Since we re-use the same editor instance for multiple scripts, switching
     * to a longer script causes the editor to highlight the range which was
     * suddenly "added". Here we just deselect it to be less annoying.
     */
    editor && editor.setPosition({ column: 1, lineNumber: 1 });
    setLatestInternalId(props.internalId);
    return null;
  }

  return (
    <div className="ScriptEditor">
      <h2 className="title">
        {getScriptTooltipIcon(props.scriptType)}
        {props.name}
        {props.scriptType === 'test-setup' && <span>&nbsp;(Setup)</span>}
        {props.scriptType === 'test-check' && <span>&nbsp;(Check)</span>}
        {props.isP2SH && (
          <span
            className="p2sh-tag"
            title="This is a P2SH script. The P2SH boilerplate has been omitted for debugging, but will be included in the template when exported."
          >
            P2SH
          </span>
        )}
        <div
          className="script-buttons"
          onClick={() => {
            setEditScriptDialogIsOpen(true);
          }}
        >
          {wrapInterfaceTooltip(
            <Icon icon={IconNames.SETTINGS} iconSize={10} />,
            'Edit Script Settings'
          )}
        </div>
      </h2>
      <div className="editor">
        <MonacoEditor
          editorWillMount={prepMonaco}
          editorDidMount={(editor, monaco) => {
            editor.onDidScrollChange(e => {
              props.setScrollOffset(e.scrollTop);
            });
            setEditor(editor);
            setMonaco(monaco);
          }}
          options={monacoOptions}
          language={bitauthTemplatingLanguage}
          theme={bitauthDark}
          value={props.script}
          onChange={(value, event) =>
            props.updateScript({
              script: value,
              internalId: props.internalId
            })
          }
        />
      </div>
      <EditScriptDialog
        isOpen={editScriptDialogIsOpen}
        internalId={props.internalId}
        id={props.id}
        name={props.name}
        scriptType={props.scriptType}
        isP2SH={props.isP2SH}
        closeDialog={() => {
          setEditScriptDialogIsOpen(false);
        }}
        currentScripts={props.currentScripts}
        editScript={props.editScript}
        deleteScript={props.deleteScript}
      />
    </div>
  );
};
