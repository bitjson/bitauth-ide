import React from 'react';
import {
  AppState,
  CurrentScripts,
  CurrentEntities,
  CurrentVariables,
  IDEVariable,
  CurrentScenarios,
} from '../state/types';
import { IconNames } from '@blueprintjs/icons';
import { unknownValue } from '../utils';
import { Tooltip } from '@blueprintjs/core';
import { BuiltInVariables } from '@bitauth/libauth';

/**
 * Disallow use of built-in IDs (if found, prefix them with an underscore)
 */
const disallowBuiltInIdentifiers = (id: string) =>
  [
    BuiltInVariables.currentBlockHeight,
    BuiltInVariables.currentBlockTime,
    BuiltInVariables.signingSerialization,
  ].includes(id as any)
    ? `_${id}`
    : id;

/**
 * Convert a name or title into a conventional ID, e.g. `Some Name` -> `some_name`.
 *
 * RegExp(`[a-zA-Z_][.a-zA-Z0-9_-]*`)
 */
export const toConventionalId = (input: string) =>
  disallowBuiltInIdentifiers(
    input
      .toLowerCase()
      .trim()
      .replace(/\s/g, '_')
      .replace(/^[^a-zA-Z_]/g, '')
      .replace(/[^.a-zA-Z0-9_-]/g, '')
  );

const abbreviationPrefixAndSuffixLength = 12;
export const abbreviateStackItem = (hex: string) =>
  hex.length <= abbreviationPrefixAndSuffixLength * 2
    ? hex
    : `${hex.substring(
        0,
        abbreviationPrefixAndSuffixLength
      )}\u2026${hex.substring(
        hex.length - abbreviationPrefixAndSuffixLength,
        hex.length
      )}`;

export const getCurrentScripts = (state: AppState) =>
  Object.entries(state.currentTemplate.scriptsByInternalId)
    .reduce<CurrentScripts>(
      (prev, [internalId, obj]) => [
        ...prev,
        { internalId, id: obj.id, name: obj.name, type: obj.type },
      ],
      []
    )
    .sort((a, b) => a.name.localeCompare(b.name));

export const getCurrentEntities = (state: AppState) =>
  Object.entries(
    state.currentTemplate.entitiesByInternalId
  ).reduce<CurrentEntities>(
    (prev, [internalId, entity]) => [
      ...prev,
      { internalId, name: entity.name, id: entity.id },
    ],
    []
  );

export const getCurrentVariables = (state: AppState) =>
  Object.entries(
    state.currentTemplate.variablesByInternalId
  ).reduce<CurrentVariables>(
    (prev, [internalId, variable]) => [
      ...prev,
      { internalId, name: variable.name, id: variable.id },
    ],
    []
  );

export const getCurrentScenarios = (state: AppState) =>
  Object.entries(
    state.currentTemplate.scenariosByInternalId
  ).reduce<CurrentScenarios>(
    (prev, [internalId, scenario]) => [
      ...prev,
      { internalId, name: scenario.name, id: scenario.id },
    ],
    []
  );

export const getUsedIds = (state: AppState) => {
  const entities = getCurrentEntities(state).map((entity) => entity.id);
  const scenarios = getCurrentScenarios(state).map((scenario) => scenario.id);
  const scripts = getCurrentScripts(state).map((script) => script.id);
  const variables = getCurrentVariables(state).map((variable) => variable.id);
  return [...entities, ...scenarios, ...scripts, ...variables];
};

export const wrapInterfaceTooltip = (
  content?: JSX.Element,
  tooltipValue?: string
) => (
  <Tooltip
    content={tooltipValue}
    portalClassName="interface-tooltip"
    targetClassName="interface-tooltip-target"
    position="bottom-left"
    boundary="window"
  >
    {content}
  </Tooltip>
);

export const variableIcon = (type: IDEVariable['type']) => {
  switch (type) {
    case 'HdKey':
      return IconNames.DIAGRAM_TREE;
    case 'Key':
      return IconNames.KEY;
    case 'AddressData':
      return IconNames.FLOW_LINEAR;
    case 'WalletData':
      return IconNames.FLOW_BRANCH;
    default:
      return unknownValue(type);
  }
};
