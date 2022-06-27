import {
  ImmerReducer,
  createReducerFunction,
  createActionCreators,
  setPrefix,
} from 'immer-reducer';
import {
  AppState,
  IDEMode,
  ActiveDialog,
  BaseScriptType,
  IDETemplateLockingScript,
  IDETemplateIsolatedScript,
  IDETemplateTestedScript,
  IDESupportedVM,
  IDEVariable,
  WalletTreeClass,
  IDEActivatableScript,
  IDETemplateUnlockingScript,
  IDETemplateTestCheckScript,
  IDETemplateTestSetupScript,
} from './types';
import { defaultState, emptyTemplate } from './defaults';
import { unknownValue } from '../utils';
import { createInsecureUuidV4 } from './utils';
import { ideImportAuthenticationTemplate } from './import-export';
import { EvaluationViewerSettings } from '../editor/editor-types';
import { AuthenticationTemplateScriptLocking } from '@bitauth/libauth';

class App extends ImmerReducer<AppState> {
  setIDEMode(mode: IDEMode) {
    this.draftState.ideMode = mode;
  }
  openWelcomePane() {
    this.draftState.currentEditingMode = 'welcome';
  }
  openTemplateSettings() {
    this.draftState.currentEditingMode = 'template-settings';
  }
  attemptInvalidImport(invalidTemplate: string) {
    this.draftState.pendingTemplateImport = invalidTemplate;
    this.openWelcomePane();
    this.importExport();
  }
  updateTemplateName(name: string) {
    this.draftState.currentTemplate.name = name;
  }
  updateTemplateDescription(description: string) {
    this.draftState.currentTemplate.description = description;
  }
  updateTemplateSupportedVM(vm: IDESupportedVM, enable: boolean) {
    const vms = this.draftState.currentTemplate.supportedVirtualMachines.filter(
      (id) => id !== vm
    );
    this.draftState.currentTemplate.supportedVirtualMachines = enable
      ? [...vms, vm]
      : vms;
  }
  openGuide() {
    this.draftState.activeDialog = ActiveDialog.guide;
  }
  importExport() {
    this.draftState.activeDialog = ActiveDialog.importExport;
  }
  resetTemplate() {
    const empty = ideImportAuthenticationTemplate(emptyTemplate);
    if (typeof empty === 'string') {
      throw new Error('Invalid empty template.');
    }
    this.draftState.templateLoadTime = new Date();
    this.draftState.currentTemplate = empty;
  }
  showWelcomePane() {
    this.draftState.currentEditingMode = 'welcome';
  }
  newEntity() {
    this.draftState.activeDialog = ActiveDialog.newEntity;
  }
  createEntity({
    internalId,
    name,
    id,
  }: {
    internalId: string;
    name: string;
    id: string;
  }) {
    this.draftState.currentTemplate.entitiesByInternalId[internalId] = {
      internalId,
      id,
      name,
      description: '',
      scriptInternalIds: [],
      usesAllScripts: true,
      variableInternalIds: [],
    };
    this.draftState.currentEditingMode = 'entity';
    this.draftState.currentlyEditingInternalId = internalId;
  }
  activateEntity(internalId: string) {
    this.draftState.currentEditingMode = 'entity';
    this.draftState.currentlyEditingInternalId = internalId;
  }
  updateEntityName(internalId: string, name: string) {
    this.draftState.currentTemplate.entitiesByInternalId[internalId].name =
      name;
  }
  updateEntityDescription(internalId: string, description: string) {
    this.draftState.currentTemplate.entitiesByInternalId[
      internalId
    ].description = description;
  }
  updateEntityId(internalId: string, id: string) {
    this.draftState.currentTemplate.entitiesByInternalId[internalId].id = id;
  }
  updateEntityScriptUsage(internalId: string, usesAllScripts: boolean) {
    this.draftState.currentTemplate.entitiesByInternalId[
      internalId
    ].usesAllScripts = usesAllScripts;
  }
  updateEntityScripts(
    internalId: string,
    changes: { [scriptInternalId: string]: boolean }
  ) {
    const previousValues = this.draftState.currentTemplate.entitiesByInternalId[
      internalId
    ].scriptInternalIds.reduce(
      (map, internalId) => ({
        ...map,
        [internalId]: true,
      }),
      {} as { [internalId: string]: boolean }
    );
    const merged = { ...previousValues, ...changes };
    const result = Object.keys(merged).filter(
      (internalId) => merged[internalId]
    );
    this.draftState.currentTemplate.entitiesByInternalId[
      internalId
    ].scriptInternalIds = result;
  }
  deleteEntity(internalId: string) {
    const variables =
      this.draftState.currentTemplate.entitiesByInternalId[internalId]
        .variableInternalIds;
    variables.forEach((variableInternalId) => {
      delete this.draftState.currentTemplate.variablesByInternalId[
        variableInternalId
      ];
    });
    delete this.draftState.currentTemplate.entitiesByInternalId[internalId];
    this.draftState.currentlyEditingInternalId = undefined;
  }
  upsertVariable({
    owningEntityInternalId,
    internalId,
    name,
    description,
    id,
    type,
  }: {
    owningEntityInternalId: string;
    internalId?: string;
    name: string;
    description: string;
    id: string;
    type: IDEVariable['type'];
  }) {
    const variableInternalId = internalId || createInsecureUuidV4();
    const variable =
      this.draftState.currentTemplate.variablesByInternalId[
        variableInternalId
      ] || {};
    variable.name = name;
    variable.description = description;
    variable.id = id;
    variable.type = type;
    this.draftState.currentTemplate.variablesByInternalId[variableInternalId] =
      variable;
    const target =
      this.draftState.currentTemplate.entitiesByInternalId[
        owningEntityInternalId
      ].variableInternalIds;
    if (target.indexOf(variableInternalId) === -1) {
      target.push(variableInternalId);
    }
  }
  deleteVariable(internalId: string) {
    const entities = Object.keys(
      this.draftState.currentTemplate.entitiesByInternalId
    );
    entities.forEach((entityInternalId) => {
      const variables =
        this.draftState.currentTemplate.entitiesByInternalId[entityInternalId]
          .variableInternalIds;
      this.draftState.currentTemplate.entitiesByInternalId[
        entityInternalId
      ].variableInternalIds = variables.filter(
        (variableInternalId) => variableInternalId !== internalId
      );
    });
    delete this.draftState.currentTemplate.variablesByInternalId[internalId];
  }
  updateScript({ internalId, script }: { internalId: string; script: string }) {
    this.draftState.currentTemplate.scriptsByInternalId[internalId].script =
      script;
  }
  activateScript(internalId: string) {
    this.draftState.currentEditingMode = 'script';
    this.draftState.currentlyEditingInternalId = internalId;

    const activatedScript = this.draftState.currentTemplate.scriptsByInternalId[
      internalId
    ] as IDEActivatableScript;

    const passesScenarioInternalIds =
      'passesInternalIds' in activatedScript &&
      activatedScript.passesInternalIds !== undefined
        ? activatedScript.passesInternalIds
        : [];

    const failsScenarioInternalIds =
      'failsInternalIds' in activatedScript &&
      activatedScript.failsInternalIds !== undefined
        ? activatedScript.failsInternalIds
        : [];

    const availableScenarioInternalIds = [
      ...passesScenarioInternalIds,
      ...failsScenarioInternalIds,
    ];

    if (
      this.draftState.lastSelectedScenarioInternalId !== undefined &&
      availableScenarioInternalIds.includes(
        this.draftState.lastSelectedScenarioInternalId
      )
    ) {
      this.draftState.currentScenarioInternalId =
        this.draftState.lastSelectedScenarioInternalId;
      return;
    }

    const hydratedSortScenarios = (internalIds: string[]) =>
      internalIds
        .map(
          (internalId) =>
            this.draftState.currentTemplate.scenariosByInternalId[internalId]
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((scenario) => scenario.internalId);

    /**
     * The list of scenarios which apply to this script, with `passes` before
     * `fails`, sorted lexicographically.
     */
    const lexicographicallySortedPassThenFail = [
      ...hydratedSortScenarios(passesScenarioInternalIds),
      ...hydratedSortScenarios(failsScenarioInternalIds),
    ];

    const firstInternalId = lexicographicallySortedPassThenFail[0] as
      | string
      | undefined;
    this.draftState.currentScenarioInternalId = firstInternalId;
  }
  importScript() {
    this.draftState.activeDialog = ActiveDialog.importScript;
  }
  assignScriptModel({
    internalId,
    monacoModel,
  }: {
    internalId: string;
    monacoModel: any;
  }) {
    this.draftState.currentTemplate.scriptsByInternalId[
      internalId
    ].monacoModel = monacoModel;
  }
  newScript() {
    this.draftState.activeDialog = ActiveDialog.newScript;
  }
  editScript({
    internalId,
    name,
    id,
    lockingType,
    isPushed,
  }: {
    internalId: string;
    name: string;
    id: string;
    lockingType?: AuthenticationTemplateScriptLocking['lockingType'];
    isPushed?: boolean;
  }) {
    const currentScript =
      this.draftState.currentTemplate.scriptsByInternalId[internalId];
    if (currentScript.type === 'test-check') {
      const setupInternalId = currentScript.testSetupInternalId;
      this.draftState.currentTemplate.scriptsByInternalId[
        setupInternalId
      ].name = name;
      return;
    }
    this.draftState.currentTemplate.scriptsByInternalId[internalId].name = name;
    this.draftState.currentTemplate.scriptsByInternalId[internalId].id = id;
    if (lockingType !== undefined) {
      (
        this.draftState.currentTemplate.scriptsByInternalId[
          internalId
        ] as IDETemplateLockingScript
      ).lockingType = lockingType;
    }
    if (isPushed !== undefined) {
      (
        this.draftState.currentTemplate.scriptsByInternalId[
          internalId
        ] as IDETemplateTestedScript
      ).pushed = isPushed;
    }
  }
  createScript(script: {
    internalId: string;
    id: string;
    name: string;
    type: BaseScriptType;
    parentInternalId?: string;
    contents?: string;
  }) {
    this.draftState.currentEditingMode = 'script';
    switch (script.type) {
      case 'isolated':
        this.draftState.currentTemplate.scriptsByInternalId[script.internalId] =
          {
            internalId: script.internalId,
            type: script.type,
            script: script.contents || '',
            id: script.id,
            name: script.name,
          } as IDETemplateIsolatedScript;
        this.draftState.currentlyEditingInternalId = script.internalId;
        return;
      case 'locking':
        const childUnlockingId = createInsecureUuidV4();
        this.draftState.currentTemplate.scriptsByInternalId[script.internalId] =
          {
            internalId: script.internalId,
            type: script.type,
            script: '',
            id: script.id,
            name: script.name,
            childInternalIds: [childUnlockingId],
            lockingType: 'p2sh20',
          } as IDETemplateLockingScript;
        this.draftState.currentTemplate.scriptsByInternalId[childUnlockingId] =
          {
            ageLock: undefined,
            estimate: undefined,
            failsInternalIds: [],
            id: `unlock_${script.id}`,
            internalId: childUnlockingId,
            name: 'Unlock',
            parentInternalId: script.internalId,
            passesInternalIds: [],
            script: '',
            timeLockType: undefined,
            type: 'unlocking',
          } as IDETemplateUnlockingScript;
        this.draftState.currentlyEditingInternalId = undefined;
        return;
      case 'unlocking':
        const lockingInternalId = script.parentInternalId as string;
        this.draftState.currentTemplate.scriptsByInternalId[script.internalId] =
          {
            ageLock: undefined,
            estimate: undefined,
            failsInternalIds: [],
            id: script.id,
            internalId: script.internalId,
            name: script.name,
            parentInternalId: lockingInternalId,
            passesInternalIds: [],
            script: '',
            timeLockType: undefined,
            type: script.type,
          } as IDETemplateUnlockingScript;
        const lock =
          this.draftState.currentTemplate.scriptsByInternalId[
            lockingInternalId
          ];
        if (lock.type !== 'locking') {
          this.draftState.currentTemplate.scriptsByInternalId[
            lockingInternalId
          ] = {
            childInternalIds: [],
            id: lock.id,
            internalId: lock.internalId,
            lockingType: 'p2sh20',
            name: lock.name,
            script: lock.script,
            type: 'locking',
          } as IDETemplateLockingScript;
        }
        (
          this.draftState.currentTemplate.scriptsByInternalId[
            lockingInternalId
          ] as IDETemplateLockingScript
        ).childInternalIds.push(script.internalId);
        this.draftState.currentlyEditingInternalId = script.internalId;
        return;
      case 'test-setup':
        const testSetupInternalId = script.internalId;
        const checkInternalId = createInsecureUuidV4();
        const parentInternalId = script.parentInternalId as string;
        this.draftState.currentlyEditingInternalId = script.internalId;
        this.draftState.currentTemplate.scriptsByInternalId[checkInternalId] = {
          type: 'test-check',
          script: '',
          id: `${script.id}_check`,
          internalId: checkInternalId,
          name: '',
          testSetupInternalId,
        } as IDETemplateTestCheckScript;
        this.draftState.currentTemplate.scriptsByInternalId[
          testSetupInternalId
        ] = {
          failsInternalIds: [],
          id: script.id,
          internalId: testSetupInternalId,
          name: script.name,
          parentInternalId,
          passesInternalIds: [],
          script: '',
          testCheckInternalId: checkInternalId,
          type: script.type,
        } as IDETemplateTestSetupScript;
        const parent = this.draftState.currentTemplate.scriptsByInternalId[
          parentInternalId
        ] as IDETemplateIsolatedScript | IDETemplateTestedScript;
        if (parent.type === 'tested') {
          parent.childInternalIds.push(testSetupInternalId);
        } else {
          const cast = parent as unknown as IDETemplateTestedScript;
          cast.type = 'tested';
          cast.childInternalIds = [testSetupInternalId];
        }
        return;
      default:
        unknownValue(script.type);
    }
  }
  deleteScript(internalId: string) {
    const deleteTarget =
      this.draftState.currentTemplate.scriptsByInternalId[internalId];
    const deleteInternalIds = [
      internalId,
      ...(deleteTarget.type === 'locking' || deleteTarget.type === 'tested'
        ? deleteTarget.childInternalIds
        : deleteTarget.type === 'test-setup'
        ? [deleteTarget.testCheckInternalId]
        : []),
    ];
    deleteInternalIds.forEach((scriptInternalId) => {
      delete this.draftState.currentTemplate.scriptsByInternalId[
        scriptInternalId
      ];
    });

    const remaining = Object.keys(
      this.draftState.currentTemplate.scriptsByInternalId
    );
    remaining.forEach((iId) => {
      const script = this.draftState.currentTemplate.scriptsByInternalId[iId];
      if (script.type === 'tested' || script.type === 'locking') {
        script.childInternalIds = script.childInternalIds.filter(
          (childId) => deleteInternalIds.indexOf(childId) === -1
        );
        if (script.childInternalIds.length === 0) {
          this.draftState.currentTemplate.scriptsByInternalId[iId] = {
            type: 'isolated',
            id: script.id,
            script: script.script,
            internalId: script.internalId,
            name: script.name,
          };
        }
      }
    });

    const entities = Object.keys(
      this.draftState.currentTemplate.entitiesByInternalId
    );
    entities.forEach((entityInternalId) => {
      const entity =
        this.draftState.currentTemplate.entitiesByInternalId[entityInternalId];
      this.draftState.currentTemplate.entitiesByInternalId[
        entityInternalId
      ].scriptInternalIds = entity.scriptInternalIds.filter(
        (iId) => deleteInternalIds.indexOf(iId) === -1
      );
    });
    this.draftState.currentEditingMode = 'template-settings';
    this.draftState.currentlyEditingInternalId = '';
  }
  closeDialog() {
    this.draftState.activeDialog = ActiveDialog.none;
  }
  importTemplate(template: AppState['currentTemplate']) {
    const firstSupportedVm =
      template.supportedVirtualMachines.find<IDESupportedVM>(
        (templateSupported): templateSupported is IDESupportedVM =>
          [
            'BCH_2022_05_SPEC',
            'BCH_2020_05',
            'BSV_2020_02',
            'BTC_2017_08',
          ].includes(templateSupported)
      );
    if (
      !template.supportedVirtualMachines.includes(this.state.currentVmId) &&
      firstSupportedVm !== undefined
    ) {
      this.draftState.currentVmId = firstSupportedVm;
    }
    this.draftState.templateLoadTime = new Date();
    this.draftState.currentTemplate = template;
    this.draftState.currentlyEditingInternalId = '';
    this.draftState.currentEditingMode = 'template-settings';
    this.draftState.pendingTemplateImport = undefined;
  }
  changeEvaluationViewerSettings(settings: EvaluationViewerSettings) {
    this.draftState.evaluationViewerSettings = settings;
  }
  toggleWalletTreeNode(id: string, className: string, isExpanded: boolean) {
    if (className === WalletTreeClass.wallet) {
      this.draftState.wallets.walletsByInternalId[id].isExpanded = isExpanded;
    }
    if (className === WalletTreeClass.address) {
      this.draftState.wallets.addressesByInternalId[id].isExpanded = isExpanded;
    }
  }
  toggleAllWalletTreeNodes(isExpanded: boolean) {
    [
      ...Object.values(this.draftState.wallets.walletsByInternalId),
      ...Object.values(this.draftState.wallets.addressesByInternalId),
    ].map((node) => (node.isExpanded = isExpanded));
  }
  switchScenario(scenarioInternalId: string) {
    this.draftState.currentScenarioInternalId = scenarioInternalId;
  }
  activateVm(vm: IDESupportedVM) {
    this.draftState.currentVmId = vm;
  }
}

setPrefix('BITAUTH_IDE');
export const rootReducer = createReducerFunction(App, defaultState);
export const ActionCreators = createActionCreators(App);
