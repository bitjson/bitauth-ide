import React from 'react';
import {
  AppState,
  CurrentScripts,
  CurrentEntities,
  CurrentVariables,
  IDEVariable
} from '../state/types';
import { IconNames } from '@blueprintjs/icons';
import { unknownValue } from '../utils';
import { Tooltip, Position } from '@blueprintjs/core';
import { compileScriptText } from 'bitcoin-ts';

/**
 * RegExp(`[a-zA-Z_][.a-zA-Z0-9_-]*`)
 */
export const sanitizeId = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/\s/g, '_')
    .replace(/^[^a-zA-Z_]/g, '')
    .replace(/[^.a-zA-Z0-9_-]/g, '');

export const getCurrentScripts = (state: AppState) =>
  Object.entries(state.currentTemplate.scriptsByInternalId)
    .reduce<CurrentScripts>(
      (prev, [internalId, obj]) => [
        ...prev,
        { internalId, id: obj.id, name: obj.name, type: obj.type }
      ],
      []
    )
    .sort((a, b) => a.name.localeCompare(b.name));

export const getCurrentEntities = (state: AppState) =>
  Object.entries(state.currentTemplate.entitiesByInternalId).reduce<
    CurrentEntities
  >(
    (prev, [internalId, entity]) => [
      ...prev,
      { internalId, name: entity.name, id: entity.id }
    ],
    []
  );

export const getCurrentVariables = (state: AppState) =>
  Object.entries(state.currentTemplate.variablesByInternalId).reduce<
    CurrentVariables
  >(
    (prev, [internalId, variable]) => [
      ...prev,
      { internalId, name: variable.name, id: variable.id }
    ],
    []
  );

export const wrapInterfaceTooltip = (
  content?: JSX.Element,
  tooltipValue?: string
) => (
  <Tooltip
    content={tooltipValue}
    portalClassName="interface-tooltip"
    targetClassName="interface-tooltip-target"
    position={Position.RIGHT}
    boundary="window"
  >
    {content}
  </Tooltip>
);

export const variableIcon = (type: IDEVariable['type']) => {
  switch (type) {
    case 'HDKey':
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

export const compileScriptMock = (script: string) =>
  compileScriptText(script, {}, { scripts: {} });
