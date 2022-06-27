import {
  Range,
  ResolvedScript,
  ScriptReductionTraceChildNode,
  binToHex,
  BuiltInVariables,
  ScriptReductionTraceScriptNode,
  extractUnexecutedRanges,
  containsRange,
} from '@bitauth/libauth';
import React, { useEffect, useState } from 'react';
import MonacoEditor from 'react-monaco-editor';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import {
  bitauthTemplatingLanguage,
  bitauthDark,
  monacoOptions,
  prepMonaco,
} from './monaco-config';
import './ScriptEditor.scss';
import { ActionCreators } from '../../state/reducer';
import { MonacoMarkerDataRequired } from '../../btl-utils/editor-tooling';
import { VariableDetails, ScriptDetails } from '../../state/types';
import { getScriptTooltipIcon } from '../project-explorer/ProjectExplorer';
import { Icon } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import { EditScriptDialog } from '../dialogs/edit-script-dialog/EditScriptDialog';
import { wrapInterfaceTooltip } from '../common';
import { CompilationResult } from '@bitauth/libauth';
import { IDESupportedProgramState, ScriptEditorFrame } from '../editor-types';
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
  signingSerializationOperationDetails,
} from './bch-language';
import { compilationErrorAssistance } from './error-assistance';

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
  containsRange(
    range,
    {
      endColumn: position.column,
      endLineNumber: position.lineNumber,
      startColumn: position.column,
      startLineNumber: position.lineNumber,
    },
    false
  );

const selectResolvedSegmentAtPosition = (
  resolvedScript: ResolvedScript,
  position: { lineNumber: number; column: number }
): ResolvedScript[number] | undefined => {
  const firstMatch = resolvedScript.find((segment) =>
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
  reduce:
    | ScriptReductionTraceScriptNode<IDESupportedProgramState>
    | ScriptReductionTraceChildNode<IDESupportedProgramState>,
  position: { lineNumber: number; column: number }
): ScriptReductionTraceChildNode<IDESupportedProgramState> | undefined => {
  const matchesRange = isWithinRange(position, reduce.range);
  if (matchesRange) {
    if ('source' in reduce) {
      return (
        selectReductionSourceSegmentAtPosition(reduce.source, position) ??
        reduce
      );
    }
    if ('push' in reduce) {
      return (
        selectReductionSourceSegmentAtPosition(reduce.push, position) ?? reduce
      );
    }
    if ('script' in reduce && Array.isArray(reduce.script)) {
      const matches = reduce.script
        .map((child) => selectReductionSourceSegmentAtPosition(child, position))
        .filter((selected) => selected !== undefined);
      const closestMatch = matches[0];
      return closestMatch === undefined ? reduce : closestMatch;
    }
    return reduce;
  }
  return undefined;
};

type ActiveHint = {
  range: Range;
  hoverContents: monacoEditor.IMarkdownString[];
};

const updateMarkers =
  ({
    compilation,
    editor,
    frame,
    monaco,
    script,
    setActiveHints,
  }: {
    compilation: CompilationResult | undefined;
    editor: monacoEditor.editor.IStandaloneCodeEditor;
    frame: ScriptEditorFrame<IDESupportedProgramState>;
    monaco: typeof monacoEditor;
    script: string;
    setActiveHints: React.Dispatch<
      React.SetStateAction<ActiveHint[] | undefined>
    >;
  }) =>
  () => {
    const model = editor.getModel();
    /**
     * Avoid updating markers if the script has changed. (This prevents error
     * markers from flashing on/off while typing.)
     */
    if (model !== null && model.getValue() === script) {
      let markers: MonacoMarkerDataRequired[] = [];
      let activeHints: ActiveHint[] = [];
      if (compilation !== undefined && compilation.success !== true) {
        const raw = compilation.errors.map<MonacoMarkerDataRequired>(
          (error) => ({
            ...error.range,
            severity: monacoEditor.MarkerSeverity.Error,
            message: error.error,
          })
        );
        const cursor = editor.getPosition();
        const hasFocus = editor.hasTextFocus();
        /**
         * Hide the error if this editor is in focus and the cursor is
         * currently at the end of the error's range (to be less annoying
         * while typing).*/
        const markersNotUnderEdit =
          hasFocus && cursor !== null
            ? raw.filter((marker) => !cursorIsAtEndOfRange(cursor, marker))
            : raw;

        const hints = markersNotUnderEdit.reduce((all, marker) => {
          const helpItem = compilationErrorAssistance.find((item) =>
            item.regex.test(marker.message)
          );
          if (helpItem !== undefined) {
            const hint: ActiveHint = {
              hoverContents: helpItem
                .generateHints(marker.message, frame)
                .map((markdown) => ({ value: markdown })),
              range: {
                endColumn: marker.endColumn,
                endLineNumber: marker.endLineNumber,
                startColumn: marker.startColumn,
                startLineNumber: marker.startLineNumber,
              },
            };
            return [...all, hint];
          }
          return all;
        }, [] as ActiveHint[]);
        activeHints = hints;
        markers = markersNotUnderEdit;
      }
      setActiveHints(activeHints);
      monaco.editor.setModelMarkers(model, '', markers);
    }
  };

export const ScriptEditor = (props: {
  frame: ScriptEditorFrame<IDESupportedProgramState>;
  isP2SH: boolean;
  isPushed: boolean;
  scriptDetails: ScriptDetails;
  variableDetails: VariableDetails;
  setCursorLine: React.Dispatch<React.SetStateAction<undefined | number>>;
  viewer: HTMLDivElement | undefined;
  usedIds: string[];
  assignScriptModel: typeof ActionCreators.assignScriptModel;
  editScript: typeof ActionCreators.editScript;
  deleteScript: typeof ActionCreators.deleteScript;
  updateScript: typeof ActionCreators.updateScript;
}) => {
  const {
    compilation,
    monacoModel,
    samples,
    script,
    scriptId: id,
    scriptInternalId: internalId,
    scriptName: name,
    scriptType,
  } = props.frame;
  const [editor, setEditor] = useState(
    undefined as undefined | monacoEditor.editor.IStandaloneCodeEditor
  );
  const [monaco, setMonaco] = useState(
    undefined as undefined | typeof monacoEditor
  );
  const [editScriptDialogIsOpen, setEditScriptDialogIsOpen] = useState(false);
  const [latestInternalId, setLatestInternalId] = useState('');
  const [activeHints, setActiveHints] = useState(
    undefined as ActiveHint[] | undefined
  );

  const tryResize = () => {
    if (editor !== undefined) {
      editor.layout();
    }
  };
  const handleResize = () => {
    tryResize();
    /**
     * With the new React Concurrent Mode enabled, rendering may not yet be
     * complete. This just ensures that the layout will eventually be right,
     * even if there's significant lag.
     */
    setTimeout(tryResize, 2000);
    setTimeout(tryResize, 10000);
  };
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  useEffect(() => {
    if (monaco !== undefined && editor !== undefined) {
      if (monacoModel === undefined) {
        const newModel = monaco.editor.createModel(
          script,
          bitauthTemplatingLanguage
        );
        props.assignScriptModel({ internalId, monacoModel: newModel });
      } else {
        if (editor.getModel() !== monacoModel) {
          editor.setModel(monacoModel);
          /**
           * https://github.com/bitauth/bitauth-ide/issues/39
           */
          editor.changeViewZones((accessor) => {
            const domNode = document.createElement('div');
            domNode.classList.add('editor-top-margin-view-zone');
            accessor.addZone({ afterLineNumber: 0, domNode });
          });
        }
      }
      editor.layout();
    }
  }, [editor, internalId, monaco, monacoModel, props, script]);

  useEffect(() => {
    if (monaco !== undefined && editor !== undefined) {
      const compilationErrorAssistanceHoverProvider =
        monaco.languages.registerHoverProvider(bitauthTemplatingLanguage, {
          provideHover: (model, position) => {
            if (!isCorrectScript(model, script)) {
              return;
            }
            if (activeHints !== undefined) {
              const matchingHint = activeHints.find((hint) =>
                isWithinRange(position, hint.range)
              );
              if (matchingHint !== undefined) {
                return {
                  contents: matchingHint.hoverContents,
                  range: matchingHint.range,
                };
              }
            }
          },
        });
      return () => {
        compilationErrorAssistanceHoverProvider.dispose();
      };
    }
  }, [monaco, editor, compilation, activeHints, script]);

  useEffect(() => {
    if (monaco !== undefined && editor !== undefined) {
      const bytecodeHoverProvider = monaco.languages.registerHoverProvider(
        bitauthTemplatingLanguage,
        {
          provideHover: (model, position) => {
            if (!isCorrectScript(model, script)) {
              return;
            }
            if (
              compilation !== undefined &&
              'resolve' in compilation &&
              'reduce' in compilation
            ) {
              const resolvedSegment = selectResolvedSegmentAtPosition(
                compilation.resolve,
                position
              );
              if (resolvedSegment && resolvedSegment.type === 'comment') {
                return;
              }
              const segment = selectReductionSourceSegmentAtPosition(
                compilation.reduce,
                position
              );
              /**
               * To avoid being annoying/distracting, we only show the bytecode
               * hover when the selected segment begins or ends on the same line
               * as the hover position – this prevents large container nodes
               * from being highlighted when the cursor is hovering in some
               * internal whitespace (like the top-level script or within
               * multi-line pushes or evaluations).
               */
              const beginsOrEndsNearPosition =
                segment !== undefined &&
                (position.lineNumber === segment.range.startLineNumber ||
                  position.lineNumber === segment.range.endLineNumber);
              if (segment !== undefined && beginsOrEndsNearPosition) {
                return {
                  contents: [
                    {
                      value: `**Compiled**: \`0x${binToHex(
                        segment.bytecode
                      )}\``,
                    },
                  ],
                  range: segment.range,
                };
              }
            }
          },
        }
      );
      /**
       * We register here to ensure opcode hover information appears above the
       * bytecode hover information.
       */
      const opcodeHoverProvider = monaco.languages.registerHoverProvider(
        bitauthTemplatingLanguage,
        opcodeHoverProviderBCH(script)
      );
      const identifierHoverProvider = monaco.languages.registerHoverProvider(
        bitauthTemplatingLanguage,
        {
          provideHover: (model, position) => {
            if (!isCorrectScript(model, script)) {
              return;
            }
            if (compilation !== undefined && 'resolve' in compilation) {
              const segment = selectResolvedSegmentAtPosition(
                compilation.resolve,
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
                            value: `**${builtInVariableDetails[variableId][0]}**`,
                          },
                          {
                            value: builtInVariableDetails[variableId][1],
                          },
                        ],
                        range,
                      };
                    case BuiltInVariables.signingSerialization:
                      const { description, name } =
                        getSigningSerializationOperationDetails(parts[1]);
                      return {
                        contents: [
                          {
                            value: `**${name}**`,
                          },
                          {
                            value: description,
                          },
                        ],
                        range,
                      };
                    default:
                      const details = props.variableDetails[variableId];
                      if (details !== undefined) {
                        const {
                          hasOperation,
                          operationName,
                          operationDescription,
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
                              } (${details.entity.name})`,
                            },
                            ...(hasOperation
                              ? [{ value: operationDescription as string }]
                              : []),
                            ...(details.variable.description
                              ? [{ value: details.variable.description }]
                              : []),
                          ],
                          range,
                        };
                      }
                  }
                } else if ('script' in segment) {
                  const details = props.scriptDetails[segment.script];
                  if (details !== undefined) {
                    return {
                      contents: [
                        {
                          value: `**${details.name}** – Script`,
                        },
                      ],
                      range,
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
                        value: `**${details.variable.name}** – ${details.variable.type} (${details.entity.name})`,
                      },
                      ...(details.variable.description
                        ? [{ value: details.variable.description }]
                        : []),
                    ],
                  };
                }
              }
            }
          },
        }
      );

      const opcodeCompletionProvider =
        monaco.languages.registerCompletionItemProvider(
          bitauthTemplatingLanguage,
          opcodeCompletionItemProviderBCH
        );

      const variableCompletionProvider =
        monaco.languages.registerCompletionItemProvider(
          bitauthTemplatingLanguage,
          {
            provideCompletionItems: (model, position) => {
              if (!isCorrectScript(model, script)) {
                return;
              }
              const contentBeforePosition = model.getValueInRange({
                startColumn: 1,
                startLineNumber: position.lineNumber,
                endColumn: position.column,
                endLineNumber: position.lineNumber,
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
                endColumn: word.endColumn,
              };

              if (operation === undefined) {
                return {
                  suggestions: [
                    ...Object.entries(props.variableDetails)
                      .filter(([id]) => id.indexOf(targetId) !== -1)
                      .map<monacoEditor.languages.CompletionItem>(
                        ([id, { variable, entity }]) => {
                          const triggerNextSuggestion =
                            variable.type === 'Key' ||
                            variable.type === 'HdKey';
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
                                    title: 'Suggest Operation',
                                  },
                                }
                              : {}),
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
                          range,
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
                                    title: 'Suggest Operation',
                                  },
                                }
                              : {}),
                          };
                        }
                      ),
                  ],
                };
              }

              const details = props.variableDetails[targetId] as
                | VariableDetails[string]
                | undefined;

              if (
                details === undefined ||
                (details.variable.type !== 'HdKey' &&
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
                          range,
                        })
                      ),
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
                          keyOperationsWhichRequireAParameter.indexOf(op) !==
                          -1;
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
                                  title: 'Suggest Parameter',
                                },
                              }
                            : {}),
                        };
                      }
                    ),
                };
              }

              if (
                keyOperationsWhichRequireAParameter.indexOf(operation) === -1
              ) {
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
                        range,
                      })
                    ),
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
                        range,
                      })
                    ),
                };
              } else {
                console.error(`Unexpected key operation: ${operation}.`);
                return;
              }
            },
            triggerCharacters: ['.'],
          }
        );

      const update = updateMarkers({
        compilation,
        editor,
        frame: props.frame,
        monaco,
        script,
        setActiveHints,
      });
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
  }, [
    monaco,
    editor,
    script,
    compilation,
    props.variableDetails,
    props.scriptDetails,
    props.frame,
  ]);

  useEffect(() => {
    if (editor !== undefined && samples !== undefined) {
      const unexecutedRanges = extractUnexecutedRanges(samples);
      const decorations = editor.deltaDecorations(
        [],
        [
          ...unexecutedRanges.map((range) => ({
            range,
            options: { inlineClassName: 'unexecuted-sample' },
          })),
        ]
      );
      return () => {
        /**
         * We don't bother diffing the previous decorations and modifying only
         * the ones which changed. Instead, we remove and replace them all. If
         * performance became a problem here, we could make this update smarter.
         */
        editor.deltaDecorations(decorations, []);
      };
    }
  }, [editor, samples]);

  /**
   * This is used to manually synchronize scroll position between the
   * ScriptEditor and EvaluationViewer for a particular editor frame. (This
   * dramatically improves scrolling performance over normal React renders.)
   */
  useEffect(() => {
    if (props.viewer !== undefined && editor !== undefined) {
      const editorSubscription = editor.onDidScrollChange((e) => {
        if (props.viewer !== undefined) {
          props.viewer.scrollTop = e.scrollTop;
          if (e.scrollTop > 3) {
            props.viewer.classList.add('header-scroll-decoration');
          } else {
            props.viewer.classList.remove('header-scroll-decoration');
          }
        }
      });
      const viewerListener: EventListener = (ev: Event): any => {
        if (editor !== undefined && props.viewer !== undefined) {
          editor.setScrollTop(props.viewer.scrollTop);
        }
      };
      props.viewer.addEventListener('scroll', viewerListener);
      return () => {
        editorSubscription.dispose();
        props.viewer?.removeEventListener('scroll', viewerListener);
      };
    }
  }, [editor, props.viewer]);

  if (latestInternalId !== internalId) {
    /**
     * Since we re-use the same editor instance for multiple scripts, switching
     * to a longer script causes the editor to highlight the range which was
     * suddenly "added". Here we just deselect it to be less annoying.
     */
    editor && editor.setPosition({ column: 1, lineNumber: 1 });
    setLatestInternalId(internalId);
    return null;
  }

  return (
    <div className={`ScriptEditor ScriptEditor-${scriptType}`}>
      <h2 className="title">
        {getScriptTooltipIcon(scriptType)}
        {name}
        {scriptType === 'test-setup' && <span>&nbsp;(Setup)</span>}
        {scriptType === 'test-check' && <span>&nbsp;(Check)</span>}
        {props.isP2SH && (
          <span
            className="script-tag p2sh-tag"
            title="This is a P2SH script. The P2SH boilerplate is automatically included during compilation."
          >
            P2SH
          </span>
        )}
        {props.isPushed && scriptType === 'tested' && (
          <span
            className="script-tag pushed-tag"
            title="This is a pushed script. The script is automatically wrapped with a push statement during testing."
          >
            Pushed
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
            editor.onDidBlurEditorText(() => {
              editor.updateOptions({ renderLineHighlight: 'none' });
              props.setCursorLine(undefined);
            });
            editor.onDidFocusEditorText(() => {
              editor.updateOptions({ renderLineHighlight: 'line' });
              props.setCursorLine(editor.getPosition()?.lineNumber);
            });
            editor.onDidChangeCursorPosition((e) => {
              props.setCursorLine(e.position.lineNumber);
            });
            setEditor(editor);
            setMonaco(monaco);
          }}
          options={monacoOptions}
          language={bitauthTemplatingLanguage}
          theme={bitauthDark}
          /**
           * Use uncontrolled mode – once the Monaco model is created, we don't
           * update it from outside of the editor. (We let Monaco handle all
           * editing.)
           */
          value={undefined}
          onChange={(value, event) =>
            props.updateScript({
              script: value,
              internalId,
            })
          }
        />
      </div>
      <EditScriptDialog
        isOpen={editScriptDialogIsOpen}
        internalId={internalId}
        id={id}
        name={name}
        scriptType={scriptType}
        isP2SH={props.isP2SH}
        isPushed={props.isPushed}
        closeDialog={() => {
          setEditScriptDialogIsOpen(false);
        }}
        usedIds={props.usedIds}
        editScript={props.editScript}
        deleteScript={props.deleteScript}
      />
    </div>
  );
};
