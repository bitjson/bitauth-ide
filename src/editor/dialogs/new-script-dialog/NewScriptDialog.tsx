import '../editor-dialog.css';
import { ActionCreators } from '../../../state/reducer';
import {
  ActiveDialog,
  BaseScriptType,
  CurrentScripts,
  scriptTypes,
  typeDescriptions,
} from '../../../state/types';
import { createInsecureUuidV4 } from '../../../utils';
import { toConventionalId } from '../../common';

import {
  Button,
  Classes,
  Dialog,
  FormGroup,
  HTMLSelect,
  InputGroup,
} from '@blueprintjs/core';
import { WarningSign } from '@blueprintjs/icons';
import React, { useState } from 'react';

const hasParent = (scriptType: BaseScriptType) =>
  scriptType === 'unlocking' || scriptType === 'test-setup';

export const NewScriptDialog = ({
  activeDialog,
  closeDialog,
  currentScripts,
  createScript,
  usedIds,
}: {
  currentScripts: CurrentScripts;
  activeDialog: ActiveDialog;
  closeDialog: typeof ActionCreators.closeDialog;
  createScript: typeof ActionCreators.createScript;
  usedIds: string[];
}) => {
  const [scriptType, setScriptType] = useState<BaseScriptType>('locking');
  const [scriptName, setScriptName] = useState('');
  const [scriptId, setScriptId] = useState('');
  const [scriptParentId, setScriptParentId] = useState('');
  const [nonUniqueId, setNonUniqueId] = useState('');
  const availableParents = currentScripts
    .filter(
      (script) =>
        script.type === 'isolated' ||
        (scriptType === 'unlocking'
          ? script.type === 'locking'
          : script.type === 'tested'),
    )
    .map((script) => ({
      label: script.name,
      value: script.internalId,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return (
    <Dialog
      className="editor-dialog"
      onClose={() => closeDialog()}
      title="Add Script to wallet template"
      isOpen={activeDialog === ActiveDialog.newScript}
      canOutsideClickClose={false}
    >
      <div className={Classes.DIALOG_BODY}>
        <FormGroup
          helperText={typeDescriptions[scriptType]}
          label="Script Type"
          labelFor="script-type"
          inline={true}
        >
          <HTMLSelect
            id="script-type"
            options={scriptTypes}
            onChange={(e) => {
              setScriptType(e.currentTarget.value as BaseScriptType);
              setScriptParentId('');
            }}
          />
        </FormGroup>
        <FormGroup
          style={{
            ...(!hasParent(scriptType) && {
              display: 'none',
            }),
          }}
          label={scriptType === 'unlocking' ? 'Unlocks' : 'Tested Script'}
          labelFor="parent-script"
          inline={true}
        >
          <HTMLSelect
            id="parent-script"
            options={availableParents}
            value={scriptParentId}
            onChange={(e) => {
              setScriptParentId(e.currentTarget.value);
            }}
          />
        </FormGroup>
        <FormGroup
          helperText="A single-line, human-readable name for this script."
          label="Script Name"
          labelFor="script-name"
          inline={true}
        >
          <InputGroup
            id="script-name"
            value={scriptName}
            autoComplete="off"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const value = e.target.value;
              setScriptName(value);
              setScriptId(toConventionalId(value));
            }}
          />
        </FormGroup>
        <FormGroup
          helperText={
            <span>
              A unique script identifier (must begin with a-z, A-Z, or
              <code>_</code>, remaining characters may include numbers,
              <code>.</code>, and
              <code>-</code>). This is used to reference the script during
              compilation and from within other scripts.
            </span>
          }
          label="Script ID"
          labelFor="script-id"
          inline={true}
        >
          <InputGroup
            id="script-id"
            value={scriptId}
            autoComplete="off"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const value = e.target.value;
              setScriptId(toConventionalId(value));
            }}
          />
        </FormGroup>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <div className="error">
            {nonUniqueId === '' ? (
              <span />
            ) : (
              <span>
                <WarningSign size={12} />
                The ID <code>{nonUniqueId}</code> is already in use.
              </span>
            )}
          </div>
          <Button
            disabled={
              scriptName === '' ||
              scriptId === '' ||
              (scriptType !== 'isolated' &&
                scriptType !== 'locking' &&
                availableParents.length === 0)
            }
            onClick={() => {
              if (usedIds.includes(scriptId)) {
                setNonUniqueId(scriptId);
              } else {
                setScriptName('');
                setScriptId('');
                setScriptParentId('');
                setNonUniqueId('');
                createScript({
                  name: scriptName,
                  id: scriptId,
                  internalId: createInsecureUuidV4(),
                  type: scriptType,
                  ...(hasParent(scriptType) && {
                    parentInternalId:
                      scriptParentId !== ''
                        ? scriptParentId
                        : availableParents[0]!.value,
                  }),
                });
                closeDialog();
              }
            }}
          >
            Add Script
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
