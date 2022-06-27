import {
  AppState,
  IDETemplateEntity,
  IDETemplateUnlockingScript,
  IDETemplateLockingScript,
  IDETemplateTestCheckScript,
  IDETemplateTestedScript,
  IDETemplateTestSetupScript,
  IDETemplateIsolatedScript,
  IDEVariable,
  IDETemplateScenario,
} from './types';
import {
  AuthenticationTemplate,
  importAuthenticationTemplate,
  AuthenticationTemplateEntity,
  AuthenticationTemplateVariable,
  AuthenticationTemplateScriptTested,
  AuthenticationTemplateScriptLocking,
  AuthenticationTemplateScriptUnlocking,
  AuthenticationTemplateScript,
} from '@bitauth/libauth';
import { createInsecureUuidV4 } from './utils';
import { bitauthAuthenticationTemplateSchema } from '../editor/constants';
import { unknownValue } from '../utils';

/**
 * Normalize an authentication template, giving every item a unique internal ID
 * for use in the IDE.
 *
 * @param maybeTemplate -  the authentication template to import
 * @param generateId - an optional method which returns a new ID each time it's
 * called (defaults to `createInsecureUuidV4`, but can be modified to allow for
 * determinism in testing)
 */
export const ideImportAuthenticationTemplate = (
  maybeTemplate: unknown,
  generateId = createInsecureUuidV4
): AppState['currentTemplate'] | string => {
  const template = importAuthenticationTemplate(maybeTemplate);
  if (typeof template === 'string') {
    return template;
  }

  const { locking, other, tested, unlocking } = Object.entries(
    template.scripts
  ).reduce<{
    locking: [string, AuthenticationTemplateScriptLocking][];
    other: [string, AuthenticationTemplateScript][];
    tested: [string, AuthenticationTemplateScriptTested][];
    unlocking: [string, AuthenticationTemplateScriptUnlocking][];
  }>(
    ({ locking, other, tested, unlocking }, [scriptId, scriptDefinition]) => {
      if ('lockingType' in scriptDefinition) {
        return {
          locking: [...locking, [scriptId, scriptDefinition]],
          other,
          tested,
          unlocking,
        };
      }
      if ('unlocks' in scriptDefinition) {
        return {
          locking,
          other,
          tested,
          unlocking: [...unlocking, [scriptId, scriptDefinition]],
        };
      }
      if ('tests' in scriptDefinition) {
        return {
          locking,
          other,
          tested: [...tested, [scriptId, scriptDefinition]],
          unlocking,
        };
      }
      return {
        locking,
        other: [...other, [scriptId, scriptDefinition]],
        tested,
        unlocking,
      };
    },
    { locking: [], other: [], tested: [], unlocking: [] }
  );

  const scriptsIds = Object.keys(template.scripts);
  const entityIds = Object.keys(template.entities);
  const variableIds = Object.values(template.entities).reduce<string[]>(
    (all, entity) =>
      entity.variables === undefined
        ? all
        : [...all, ...Object.keys(entity.variables)],
    []
  );
  const scenarioIds =
    template.scenarios === undefined ? [] : Object.keys(template.scenarios);

  const templateIds = [
    ...entityIds,
    ...scriptsIds,
    ...variableIds,
    ...scenarioIds,
  ];

  /**
   * An object mapping each ID to its newly generated `internalId`. (Note,
   * internal IDs for script tests are generated later.)
   */
  const internalIdMap = templateIds.reduce<{
    [templateId: string]: string;
  }>((map, templateId) => ({ ...map, [templateId]: generateId() }), {});

  const unlockingIdeScripts = unlocking.map<IDETemplateUnlockingScript>(
    ([id, script]) => ({
      ageLock: script.ageLock,
      estimate: script.estimate,
      failsInternalIds:
        script.fails === undefined
          ? []
          : script.fails.map((id) => internalIdMap[id]),
      id,
      internalId: internalIdMap[id],
      name: script.name ?? 'Unnamed Unlock',
      parentInternalId: internalIdMap[script.unlocks],
      passesInternalIds:
        script.passes === undefined
          ? []
          : script.passes.map((id) => internalIdMap[id]),
      script: script.script,
      timeLockType: script.timeLockType,
      type: 'unlocking',
    })
  );

  const lockingIdeScripts = locking.map<IDETemplateLockingScript>(
    ([id, script]) => ({
      id,
      internalId: internalIdMap[id],
      name: script.name ?? 'Unnamed Lock',
      script: script.script,
      type: 'locking',
      lockingType: script.lockingType,
      childInternalIds: Object.values(unlockingIdeScripts)
        .filter((script) => script.parentInternalId === internalIdMap[id])
        .map((script) => script.internalId),
    })
  );

  const otherIdeScripts = other.map<IDETemplateIsolatedScript>(
    ([id, script]) => ({
      id,
      internalId: internalIdMap[id],
      name: script.name ?? 'Unnamed Script',
      script: script.script,
      type: 'isolated',
    })
  );

  const testedAndTestIdeScripts = tested.reduce<
    (
      | IDETemplateTestedScript
      | IDETemplateTestSetupScript
      | IDETemplateTestCheckScript
    )[]
  >((all, testedScriptEntries) => {
    const [testedScriptId, testedScript] = testedScriptEntries;
    const testedInternalId = internalIdMap[testedScriptId];

    const testScripts = Object.entries(testedScript.tests).reduce<
      (IDETemplateTestSetupScript | IDETemplateTestCheckScript)[]
    >((tScripts, [testId, test]) => {
      const setupId = generateId();
      const checkId = generateId();
      const setup: IDETemplateTestSetupScript = {
        type: 'test-setup',
        id: testId,
        internalId: setupId,
        name: test.name ?? 'Unnamed Test',
        parentInternalId: testedInternalId,
        script: test.setup ?? '',
        testCheckInternalId: checkId,
        failsInternalIds:
          test.fails === undefined
            ? []
            : test.fails.map((id) => internalIdMap[id]),
        passesInternalIds:
          test.passes === undefined
            ? []
            : test.passes.map((id) => internalIdMap[id]),
      };
      const check: IDETemplateTestCheckScript = {
        type: 'test-check',
        id: `${testId}.check`,
        internalId: checkId,
        name: '',
        script: test.check,
        testSetupInternalId: setupId,
      };
      return [...tScripts, setup, check];
    }, []);

    const testSetupInternalIds = testScripts
      .filter((script) => script.type === 'test-setup')
      .map((script) => script.internalId);

    const ideTestedScript: IDETemplateTestedScript = {
      id: testedScriptId,
      internalId: testedInternalId,
      pushed: testedScript.pushed ?? false,
      childInternalIds: testSetupInternalIds,
      name: testedScript.name ?? 'Unnamed Tested Script',
      script: testedScript.script,
      type: 'tested',
    };

    return [...all, ideTestedScript, ...testScripts];
  }, []);

  const allScripts = [
    ...unlockingIdeScripts,
    ...lockingIdeScripts,
    ...otherIdeScripts,
    ...testedAndTestIdeScripts,
  ];

  const scriptsByInternalId: AppState['currentTemplate']['scriptsByInternalId'] =
    allScripts.reduce(
      (all, script) => ({
        ...all,
        [script.internalId]: script,
      }),
      {}
    );

  const entitiesByInternalId: AppState['currentTemplate']['entitiesByInternalId'] =
    Object.entries(template.entities).reduce((all, entityEntry) => {
      const [id, entity] = entityEntry;
      const internalId = internalIdMap[id];
      const scriptInternalIds =
        entity.scripts === undefined
          ? []
          : entity.scripts.map((scriptId) => internalIdMap[scriptId]);
      const variableInternalIds =
        entity.variables === undefined
          ? []
          : Object.keys(entity.variables).map(
              (variableId) => internalIdMap[variableId]
            );

      const ideEntity: IDETemplateEntity = {
        description: entity.description ?? '',
        id,
        internalId,
        name: entity.name ?? 'Unnamed Entity',
        scriptInternalIds,
        usesAllScripts: false,
        variableInternalIds,
      };
      return { ...all, [internalId]: ideEntity };
    }, {});

  const variables = Object.values(template.entities).reduce<IDEVariable[]>(
    (all, entity) =>
      entity.variables === undefined
        ? all
        : [
            ...all,
            ...Object.entries(entity.variables).reduce<IDEVariable[]>(
              (entityVariables, entries) => {
                const [variableId, variable] = entries;
                return [
                  ...entityVariables,
                  {
                    id: variableId,
                    internalId: internalIdMap[variableId],
                    ...variable,
                    description: variable.description ?? '',
                    name: variable.name ?? variableId,
                  },
                ];
              },
              []
            ),
          ],
    []
  );

  const variablesByInternalId: AppState['currentTemplate']['variablesByInternalId'] =
    variables.reduce(
      (all, variable) => ({
        ...all,
        [variable.internalId]: variable,
      }),
      {}
    );

  const scenariosByInternalId: AppState['currentTemplate']['scenariosByInternalId'] =
    template.scenarios === undefined
      ? {}
      : Object.entries(template.scenarios).reduce((all, scenarioEntry) => {
          const [id, scenario] = scenarioEntry;
          const internalId = internalIdMap[id];
          const ideScenario: IDETemplateScenario = {
            data: scenario.data,
            description: scenario.description ?? '',
            extends: scenario.extends,
            id,
            internalId,
            name: scenario.name ?? 'Unnamed Scenario',
            transaction: scenario.transaction,
            sourceOutputs: scenario.sourceOutputs,
          };
          return { ...all, [internalId]: ideScenario };
        }, {});

  return {
    name: template.name ?? 'Unnamed Template',
    description: template.description ?? '',
    entitiesByInternalId,
    scenariosByInternalId,
    scriptsByInternalId,
    supportedVirtualMachines: template.supported ?? [],
    variablesByInternalId,
  };
};

// TODO: fix usesAllScripts everywhere

export const exportAuthenticationTemplate = (
  currentTemplate: AppState['currentTemplate']
): AuthenticationTemplate => {
  const entities = Object.values(currentTemplate.entitiesByInternalId).reduce<
    AuthenticationTemplate['entities']
  >((allEntities, entity) => {
    const variables =
      entity.variableInternalIds.length === 0
        ? undefined
        : entity.variableInternalIds
            .map(
              (variableInternalId) =>
                currentTemplate.variablesByInternalId[variableInternalId]
            )
            .reduce<NonNullable<AuthenticationTemplateEntity['variables']>>(
              (all, variable) => {
                const nextVariable: AuthenticationTemplateVariable =
                  variable.type === 'HdKey'
                    ? {
                        ...(variable.addressOffset === undefined
                          ? {}
                          : { addressOffset: variable.addressOffset }),
                        description: variable.description,
                        ...(variable.hdPublicKeyDerivationPath === undefined
                          ? {}
                          : {
                              hdPublicKeyDerivationPath:
                                variable.hdPublicKeyDerivationPath,
                            }),
                        name: variable.name,
                        ...(variable.privateDerivationPath === undefined
                          ? {}
                          : {
                              privateDerivationPath:
                                variable.privateDerivationPath,
                            }),
                        ...(variable.publicDerivationPath === undefined
                          ? {}
                          : {
                              publicDerivationPath:
                                variable.publicDerivationPath,
                            }),
                        type: variable.type,
                      }
                    : {
                        description: variable.description,
                        name: variable.name,
                        type: variable.type,
                      };

                return {
                  ...all,
                  [variable.id]: nextVariable,
                };
              },
              {}
            );

    const scripts =
      entity.scriptInternalIds.length === 0
        ? undefined
        : entity.scriptInternalIds.map(
            (scriptInternalId) =>
              currentTemplate.scriptsByInternalId[scriptInternalId].id
          );

    const nextEntity = {
      description: entity.description,
      name: entity.name,
      ...(scripts === undefined ? {} : { scripts }),
      ...(variables === undefined ? {} : { variables }),
    };
    return { ...allEntities, [entity.id]: nextEntity };
  }, {});

  const hydrateAndSortScenariosByName = (internalIds: string[]) =>
    internalIds
      .map((internalId) => currentTemplate.scenariosByInternalId[internalId])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((scenario) => scenario.id);

  const scripts = Object.values(currentTemplate.scriptsByInternalId).reduce<
    AuthenticationTemplate['scripts']
  >((allScripts, script) => {
    if (script.type === 'tested') {
      const testedScript: AuthenticationTemplateScriptTested = {
        name: script.name,
        ...(script.pushed ? { pushed: true } : {}),
        script: script.script,
        tests: script.childInternalIds
          .map(
            (testSetupInternalId) =>
              currentTemplate.scriptsByInternalId[
                testSetupInternalId
              ] as IDETemplateTestSetupScript
          )
          .reduce(
            (tests, setupTest) => ({
              ...tests,
              [setupTest.id]: {
                ...(setupTest.failsInternalIds.length === 0
                  ? {}
                  : {
                      fails: hydrateAndSortScenariosByName(
                        setupTest.failsInternalIds
                      ),
                    }),
                ...(setupTest.passesInternalIds.length === 0
                  ? {}
                  : {
                      passes: hydrateAndSortScenariosByName(
                        setupTest.passesInternalIds
                      ),
                    }),
                check: (
                  currentTemplate.scriptsByInternalId[
                    setupTest.testCheckInternalId
                  ] as IDETemplateTestCheckScript
                ).script,
                name: setupTest.name,
                ...(setupTest.script.trim() === ''
                  ? {}
                  : { setup: setupTest.script }),
              },
            }),
            {}
          ),
      };
      return {
        ...allScripts,
        [script.id]: testedScript,
      };
    }

    if (script.type === 'locking') {
      const lockingScript: AuthenticationTemplateScriptLocking = {
        lockingType: script.lockingType,
        name: script.name,
        script: script.script,
      };
      return {
        ...allScripts,
        [script.id]: lockingScript,
      };
    }

    if (script.type === 'unlocking') {
      const unlockingScript: AuthenticationTemplateScriptUnlocking = {
        ...(script.ageLock === undefined ? {} : { ageLock: script.ageLock }),
        ...(script.estimate === undefined ? {} : { estimate: script.estimate }),
        ...(script.failsInternalIds.length === 0
          ? {}
          : {
              fails: hydrateAndSortScenariosByName(script.failsInternalIds),
            }),
        ...(script.passesInternalIds.length === 0
          ? {}
          : {
              passes: hydrateAndSortScenariosByName(script.passesInternalIds),
            }),
        name: script.name,
        script: script.script,
        ...(script.timeLockType === undefined
          ? {}
          : { timeLockType: script.timeLockType }),
        unlocks: (
          currentTemplate.scriptsByInternalId[
            script.parentInternalId
          ] as IDETemplateLockingScript
        ).id,
      };
      return {
        ...allScripts,
        [script.id]: unlockingScript,
      };
    }

    if (script.type === 'isolated') {
      const isolatedScript: AuthenticationTemplateScript = {
        name: script.name,
        script: script.script,
      };
      return {
        ...allScripts,
        [script.id]: isolatedScript,
      };
    }
    if (script.type === 'test-check' || script.type === 'test-setup')
      return allScripts;
    unknownValue(script);
    return allScripts;
  }, {});

  const scenarios = Object.values(currentTemplate.scenariosByInternalId).reduce<
    NonNullable<AuthenticationTemplate['scenarios']>
  >(
    (allScenarios, scenario) => ({
      ...allScenarios,
      [scenario.id]: {
        ...(scenario.data === undefined ? {} : { data: scenario.data }),
        description: scenario.description,
        ...(scenario.extends === undefined
          ? {}
          : { extends: scenario.extends }),
        name: scenario.name,
        ...(scenario.transaction === undefined
          ? {}
          : { transaction: scenario.transaction }),
        ...(scenario.sourceOutputs === undefined
          ? {}
          : { sourceOutputs: scenario.sourceOutputs }),
      },
    }),
    {}
  );

  return {
    $schema: bitauthAuthenticationTemplateSchema,
    description: currentTemplate.description,
    name: currentTemplate.name,
    entities,
    ...(Object.keys(scenarios).length === 0 ? {} : { scenarios }),
    scripts,
    supported: [...currentTemplate.supportedVirtualMachines].sort((a, b) =>
      a.localeCompare(b)
    ),
    version: 0,
  };
};
