import './Editor.scss';
import { Mosaic } from 'react-mosaic-component';
import { ProjectExplorer } from './project-explorer/ProjectExplorer';
import { ScriptEditor } from './script-editor/ScriptEditor';
import { EvaluationViewer } from './evaluation-viewer/EvaluationViewer';
import React, { useState, useCallback } from 'react';
import { connect } from 'react-redux';
import { unknownValue } from '../utils';
import { AppState, ActiveDialog, CurrentScripts } from '../state/types';
import {
  ProjectEditorMode,
  IDESupportedProgramState,
  ComputedEditorState,
  EditorStateScriptMode,
  ScriptEditorPane,
  ScriptEvaluationViewerPane,
  EvaluationViewerSettings,
} from './editor-types';
import { ActionCreators } from '../state/reducer';
import { NewScriptDialog } from './dialogs/new-script-dialog/NewScriptDialog';
import { EntitySettingsEditor } from './entity-editor/EntitySettingsEditor';
import { EntityVariableEditor } from './entity-editor/EntityVariableEditor';
import { getUsedIds, getCurrentScripts } from './common';
import { NewEntityDialog } from './dialogs/new-entity-dialog/NewEntityDialog';
import { TemplateSettings } from './template-settings/TemplateSettings';
import { ImportExportDialog } from './dialogs/import-export-dialog/ImportExportDialog';
import { ImportScriptDialog } from './dialogs/import-script-dialog/ImportScriptDialog';
import { WelcomePane } from './welcome-pane/WelcomePane';
import { computeEditorState } from './editor-state';
import { WalletEditor } from './wallet/wallet-editor/WalletEditor';
import { TransactionEditor } from './wallet/transaction-editor/TransactionEditor';
import { WalletHistoryExplorer } from './wallet/wallet-history-explorer/WalletHistoryExplorer';

enum Pane {
  projectExplorer = 'projectExplorerPane',
  templateSettingsEditor = 'templateSettingsEditorPane',
  entitySettingsEditor = 'entitySettingsEditorPane',
  entityVariableEditor = 'entityVariableEditorPane',
  importing = 'importing',
  welcome = 'welcome',
  walletEditor = 'walletEditor',
  walletHistoryExplorer = 'walletHistoryExplorer',
  transactionEditor = 'transactionEditor',
}

interface EditorDispatch {
  updateScript: typeof ActionCreators.updateScript;
  closeDialog: typeof ActionCreators.closeDialog;
  assignScriptModel: typeof ActionCreators.assignScriptModel;
  createScript: typeof ActionCreators.createScript;
  editScript: typeof ActionCreators.editScript;
  deleteScript: typeof ActionCreators.deleteScript;
  createEntity: typeof ActionCreators.createEntity;
  changeEvaluationViewerSettings: typeof ActionCreators.changeEvaluationViewerSettings;
  importExport: typeof ActionCreators.importExport;
  switchScenario: typeof ActionCreators.switchScenario;
}

interface EditorProps<ProgramState extends IDESupportedProgramState>
  extends EditorDispatch {
  computed: ComputedEditorState<ProgramState>;
  currentlyEditingInternalId: string | undefined;
  currentScripts: CurrentScripts;
  activeDialog: ActiveDialog;
  evaluationViewerSettings: EvaluationViewerSettings;
  usedIds: string[];
}

export const Editor = connect(
  (state: AppState) => ({
    computed: computeEditorState(state),
    currentlyEditingInternalId: state.currentlyEditingInternalId,
    currentScripts: getCurrentScripts(state),
    activeDialog: state.activeDialog,
    evaluationViewerSettings: state.evaluationViewerSettings,
    usedIds: getUsedIds(state),
  }),
  {
    closeDialog: ActionCreators.closeDialog,
    assignScriptModel: ActionCreators.assignScriptModel,
    updateScript: ActionCreators.updateScript,
    createScript: ActionCreators.createScript,
    editScript: ActionCreators.editScript,
    deleteScript: ActionCreators.deleteScript,
    createEntity: ActionCreators.createEntity,
    changeEvaluationViewerSettings:
      ActionCreators.changeEvaluationViewerSettings,
    importExport: ActionCreators.importExport,
    switchScenario: ActionCreators.switchScenario,
  }
)((props: EditorProps<IDESupportedProgramState>) => {
  const [projectExplorerWidth, setProjectExplorerWidth] = useState(21);
  const [scriptEditorWidths, setScriptEditorWidths] = useState(40);
  const [settingsWidth, setSettingsWidth] = useState(50);
  const [frames2SplitHeight, setFrames2SplitHeight] = useState(30);
  const [frames3TopSplitHeight, setFrames3TopSplitHeight] = useState(15);
  const [frames3BottomSplitHeight, setFrames3BottomSplitHeight] = useState(50);
  const [cursorLineFrame1, setCursorLineFrame1] = useState(
    undefined as number | undefined
  );
  const [cursorLineFrame2, setCursorLineFrame2] = useState(
    undefined as number | undefined
  );
  const [cursorLineFrame3, setCursorLineFrame3] = useState(
    undefined as number | undefined
  );
  const [walletEditorWidth, setWalletEditorWidth] = useState(45);
  const [walletHistoryHeight, setWalletHistoryHeight] = useState(60);
  const cursorLine = [cursorLineFrame1, cursorLineFrame2, cursorLineFrame3];
  const setCursorLine = [
    setCursorLineFrame1,
    setCursorLineFrame2,
    setCursorLineFrame3,
  ];
  const [viewerElementFrame1, setViewerElementFrame1] = useState<
    HTMLDivElement | undefined
  >(undefined);
  const [viewerElementFrame2, setViewerElementFrame2] = useState<
    HTMLDivElement | undefined
  >(undefined);
  const [viewerElementFrame3, setViewerElementFrame3] = useState<
    HTMLDivElement | undefined
  >(undefined);
  const viewerRefCallbackFrame1 = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setViewerElementFrame1(node);
    }
  }, []);
  const viewerRefCallbackFrame2 = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setViewerElementFrame2(node);
    }
  }, []);
  const viewerRefCallbackFrame3 = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      setViewerElementFrame3(node);
    }
  }, []);
  const viewerElements = [
    viewerElementFrame1,
    viewerElementFrame2,
    viewerElementFrame3,
  ];
  const viewerRefCallbacks = [
    viewerRefCallbackFrame1,
    viewerRefCallbackFrame2,
    viewerRefCallbackFrame3,
  ];

  const renderScriptEditor = (
    computed: EditorStateScriptMode<IDESupportedProgramState>,
    indexFromTop: 0 | 1 | 2
  ) => (
    <ScriptEditor
      assignScriptModel={props.assignScriptModel}
      deleteScript={props.deleteScript}
      editScript={props.editScript}
      frame={computed.scriptEditorFrames[indexFromTop]}
      isP2SH={computed.lockingType === 'p2sh20'}
      isPushed={computed.isPushed}
      scriptDetails={computed.scriptDetails}
      setCursorLine={setCursorLine[indexFromTop]}
      viewer={viewerElements[indexFromTop]}
      updateScript={props.updateScript}
      usedIds={props.usedIds}
      variableDetails={computed.variableDetails}
    />
  );

  const renderEvaluationViewer = (
    computed: EditorStateScriptMode<IDESupportedProgramState>,
    indexFromTop: 0 | 1 | 2
  ) => (
    <EvaluationViewer
      computedState={{
        evaluationSource: computed.scriptEditorEvaluationSource,
        evaluationTrace: computed.scriptEditorEvaluationTrace,
        frame: computed.scriptEditorFrames[indexFromTop],
        lookup: computed.identifyStackItems,
      }}
      changeEvaluationViewerSettings={props.changeEvaluationViewerSettings}
      cursorLine={cursorLine[indexFromTop]}
      debugTrace={computed.debugTrace}
      evaluationViewerSettings={props.evaluationViewerSettings}
      importExport={props.importExport}
      scenarioDetails={computed.scenarioDetails}
      showControls={indexFromTop === 0}
      switchScenario={props.switchScenario}
      viewerRef={viewerRefCallbacks[indexFromTop]}
    />
  );

  return (
    <div className="Editor">
      <Mosaic<Pane | ScriptEditorPane | ScriptEvaluationViewerPane>
        className="mosaic-blueprint-theme bp4-dark"
        renderTile={(id) => {
          const computed =
            props.computed as EditorStateScriptMode<IDESupportedProgramState>;
          switch (id) {
            case Pane.projectExplorer:
              return <ProjectExplorer />;
            case ScriptEditorPane.zero:
              return renderScriptEditor(computed, 0);
            case ScriptEditorPane.one:
              return renderScriptEditor(computed, 1);
            case ScriptEditorPane.two:
              return renderScriptEditor(computed, 2);
            case ScriptEvaluationViewerPane.zero:
              return renderEvaluationViewer(computed, 0);
            case ScriptEvaluationViewerPane.one:
              return renderEvaluationViewer(computed, 1);
            case ScriptEvaluationViewerPane.two:
              return renderEvaluationViewer(computed, 2);

            case Pane.entityVariableEditor:
              return props.currentlyEditingInternalId ? (
                <EntityVariableEditor
                  entityInternalId={props.currentlyEditingInternalId}
                />
              ) : (
                <div className="loading" />
              );
            case Pane.entitySettingsEditor:
              return props.currentlyEditingInternalId ? (
                <EntitySettingsEditor
                  entityInternalId={props.currentlyEditingInternalId}
                />
              ) : (
                <div className="loading" />
              );
            case Pane.templateSettingsEditor:
              return <TemplateSettings />;
            case Pane.welcome:
              return <WelcomePane />;
            case Pane.importing:
              return <div className="loading" />;
            case Pane.walletEditor:
              return <WalletEditor />;
            case Pane.walletHistoryExplorer:
              return <WalletHistoryExplorer />;
            case Pane.transactionEditor:
              return <TransactionEditor />;
            default:
              unknownValue(id);
              return (
                <h3>Editor error – tried to render Mosaic tile: "{id}"</h3>
              );
          }
        }}
        value={
          props.computed.editorMode === ProjectEditorMode.welcome
            ? Pane.welcome
            : props.computed.editorMode === ProjectEditorMode.importing
            ? Pane.importing
            : props.computed.editorMode === ProjectEditorMode.wallet
            ? {
                direction: 'row',
                first: Pane.walletEditor,
                splitPercentage: walletEditorWidth,
                second: {
                  direction: 'column',
                  first: Pane.walletHistoryExplorer,
                  second: Pane.transactionEditor,
                  splitPercentage: walletHistoryHeight,
                },
              }
            : {
                direction: 'row',
                first: Pane.projectExplorer,
                second:
                  props.computed.editorMode ===
                  ProjectEditorMode.templateSettingsEditor
                    ? Pane.templateSettingsEditor
                    : props.computed.editorMode ===
                      ProjectEditorMode.entityEditor
                    ? {
                        direction: 'row',
                        first: Pane.entitySettingsEditor,
                        second: Pane.entityVariableEditor,
                        splitPercentage: settingsWidth,
                      }
                    : props.computed.editorMode ===
                      ProjectEditorMode.isolatedScriptEditor
                    ? {
                        direction: 'row',
                        first: ScriptEditorPane.zero,
                        second: ScriptEvaluationViewerPane.zero,
                        splitPercentage: scriptEditorWidths,
                      }
                    : props.computed.editorMode ===
                      ProjectEditorMode.scriptPairEditor
                    ? {
                        direction: 'row',
                        first: {
                          direction: 'column',
                          first: ScriptEditorPane.zero,
                          second: ScriptEditorPane.one,
                          splitPercentage: frames2SplitHeight,
                        },
                        second: {
                          direction: 'column',
                          first: ScriptEvaluationViewerPane.zero,
                          second: ScriptEvaluationViewerPane.one,
                          splitPercentage: frames2SplitHeight,
                        },
                        splitPercentage: scriptEditorWidths,
                      }
                    : props.computed.editorMode ===
                      ProjectEditorMode.testedScriptEditor
                    ? {
                        direction: 'row',
                        first: {
                          direction: 'column',
                          first: ScriptEditorPane.zero,
                          second: {
                            direction: 'column',
                            first: ScriptEditorPane.one,
                            second: ScriptEditorPane.two,
                            splitPercentage: frames3BottomSplitHeight,
                          },
                          splitPercentage: frames3TopSplitHeight,
                        },
                        second: {
                          direction: 'column',
                          first: ScriptEvaluationViewerPane.zero,
                          second: {
                            direction: 'column',
                            first: ScriptEvaluationViewerPane.one,
                            second: ScriptEvaluationViewerPane.two,
                            splitPercentage: frames3BottomSplitHeight,
                          },
                          splitPercentage: frames3TopSplitHeight,
                        },
                        splitPercentage: scriptEditorWidths,
                      }
                    : unknownValue(props.computed.editorMode),
                splitPercentage: projectExplorerWidth,
              }
        }
        onChange={(node) => {
          if (node && typeof node === 'object') {
            if (
              node.first === Pane.walletEditor &&
              walletEditorWidth !== node.splitPercentage
            ) {
              setWalletEditorWidth(node.splitPercentage as number);
            } else if (
              node.first === Pane.projectExplorer &&
              projectExplorerWidth !== node.splitPercentage
            ) {
              setProjectExplorerWidth(node.splitPercentage as number);
            }
            if (typeof node.second === 'object') {
              if (
                node.second.first === Pane.entitySettingsEditor &&
                settingsWidth !== node.second.splitPercentage
              ) {
                setSettingsWidth(node.second.splitPercentage as number);
              } else if (
                node.second.first === Pane.walletHistoryExplorer &&
                walletHistoryHeight !== node.second.splitPercentage
              ) {
                setWalletHistoryHeight(node.second.splitPercentage as number);
              } else {
                if (scriptEditorWidths !== node.second.splitPercentage) {
                  setScriptEditorWidths(node.second.splitPercentage as number);
                }
                if (
                  typeof node.second.first === 'object' &&
                  typeof node.second.second === 'object'
                ) {
                  if (
                    typeof node.second.first.second === 'object' &&
                    typeof node.second.second.second === 'object'
                  ) {
                    const editorLine1 = node.second.first
                      .splitPercentage as number;
                    const viewerLine1 = node.second.second
                      .splitPercentage as number;
                    setFrames3TopSplitHeight(
                      frames3TopSplitHeight !== editorLine1
                        ? editorLine1
                        : viewerLine1
                    );
                    const editorLine2 = node.second.first.second
                      .splitPercentage as number;
                    const viewerLine2 = node.second.second.second
                      .splitPercentage as number;
                    setFrames3BottomSplitHeight(
                      frames3BottomSplitHeight !== editorLine2
                        ? editorLine2
                        : viewerLine2
                    );
                  } else {
                    const editorLine = node.second.first
                      .splitPercentage as number;
                    const viewerLine = node.second.second
                      .splitPercentage as number;
                    setFrames2SplitHeight(
                      frames2SplitHeight !== editorLine
                        ? editorLine
                        : viewerLine
                    );
                  }
                }
              }
            }
          }
          window.dispatchEvent(new Event('resize'));
        }}
        resize={{ minimumPaneSizePercentage: 10 }}
      />
      <NewEntityDialog
        activeDialog={props.activeDialog}
        closeDialog={props.closeDialog}
        usedIds={props.usedIds}
        createEntity={props.createEntity}
      />
      <NewScriptDialog
        activeDialog={props.activeDialog}
        closeDialog={props.closeDialog}
        createScript={props.createScript}
        currentScripts={props.currentScripts}
        usedIds={props.usedIds}
      />
      <ImportScriptDialog
        activeDialog={props.activeDialog}
        closeDialog={props.closeDialog}
        usedIds={props.usedIds}
        createScript={props.createScript}
      />
      <ImportExportDialog
        activeDialog={props.activeDialog}
        closeDialog={props.closeDialog}
      />
    </div>
  );
});
