import '../editor-dialog.css';
import { ActionCreators } from '../../../state/reducer';
import {
  LockingType,
  lockingTypeDescriptions,
  lockingTypes,
  ScriptType,
} from '../../../state/types';
import { toConventionalId } from '../../common';

import {
  Alert,
  Button,
  Classes,
  Dialog,
  FormGroup,
  HTMLSelect,
  InputGroup,
  Intent,
  Switch,
} from '@blueprintjs/core';
import { Trash, WarningSign } from '@blueprintjs/icons';
import React, { useState } from 'react';

export const EditScriptDialog = ({
  scriptType,
  name,
  internalId,
  id,
  lockingType,
  isPushed,
  isOpen,
  closeDialog,
  editScript,
  deleteScript,
  usedIds,
}: {
  scriptType: ScriptType;
  name: string;
  internalId: string;
  id: string;
  lockingType: LockingType;
  isPushed: boolean;
  usedIds: string[];
  editScript: typeof ActionCreators.editScript;
  deleteScript: typeof ActionCreators.deleteScript;
  isOpen: boolean;
  closeDialog: () => void;
}) => {
  const [scriptName, setScriptName] = useState(name);
  const [scriptId, setScriptId] = useState(id);
  const [scriptLockingType, setScriptLockingType] = useState(lockingType);
  const [scriptIsPushed, setScriptIsPushed] = useState(isPushed);
  const [nonUniqueId, setNonUniqueId] = useState('');
  const [promptDelete, setPromptDelete] = useState(false);
  const isTest = scriptType === 'test-setup' || scriptType === 'test-check';
  const otherIds = usedIds.filter((usedId) => usedId !== id);
  return (
    <Dialog
      className="editor-dialog EditScriptDialog"
      onOpening={() => {
        setScriptName(name);
        setScriptId(id);
        setScriptLockingType(lockingType);
        setNonUniqueId('');
      }}
      onClose={() => {
        closeDialog();
      }}
      title="Edit Script Settings"
      isOpen={isOpen}
      canOutsideClickClose={false}
    >
      <div className={Classes.DIALOG_BODY}>
        <FormGroup
          helperText={`A single-line, human-readable name for this ${
            isTest ? 'test' : 'script'
          }.`}
          label={`${isTest ? 'Test' : 'Script'} Name`}
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
        {!isTest && (
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
                setScriptId(value);
              }}
              onBlur={(e) => {
                const value = e.target.value;
                setScriptId(toConventionalId(value));
              }}
            />
          </FormGroup>
        )}
        {scriptType === 'locking' && (
          <FormGroup
            helperText={lockingTypeDescriptions[scriptLockingType]}
            label="Script Mode"
            labelFor="script-p2sh"
            inline={true}
          >
            <HTMLSelect
              id="script-p2sh"
              value={scriptLockingType}
              options={lockingTypes}
              onChange={(e) => {
                setScriptLockingType(e.currentTarget.value as LockingType);
              }}
            />
          </FormGroup>
        )}
        {scriptType === 'tested' && (
          <FormGroup
            helperText={
              <span>
                If enabled, this script will be wrapped in a push statement for
                testing. This is useful for scripts which serve as
                &ldquo;bytecode templates&rdquo; – e.g. formatted messages or
                signature preimages. These scripts are typically not evaluated
                as bytecode but appear within push statements elsewhere in the
                template.
              </span>
            }
            label="Pushed Script"
            labelFor="pushed-script"
            inline={true}
          >
            <Switch
              checked={scriptIsPushed}
              id="pushed-script"
              label="Test as Pushed Script"
              onChange={() => {
                setScriptIsPushed(!scriptIsPushed);
              }}
            />
          </FormGroup>
        )}
        <Button
          className="ide-secondary-button delete-item-button"
          onClick={() => {
            setPromptDelete(true);
          }}
        >
          <Trash size={10}></Trash>
          Delete {isTest ? 'Test' : 'Script'}
        </Button>
        <Alert
          cancelButtonText="Cancel"
          confirmButtonText="Delete Script"
          intent={Intent.DANGER}
          isOpen={promptDelete}
          canEscapeKeyCancel={true}
          canOutsideClickCancel={true}
          onCancel={() => {
            setPromptDelete(false);
          }}
          onConfirm={() => deleteScript(internalId)}
        >
          <p>Are you sure you want to delete the script “{name}”?</p>
          {scriptType === 'locking' ? (
            <p>This will also delete all associated unlocking scripts.</p>
          ) : (
            scriptType === 'tested' && (
              <p>This will also delete all associated script tests.</p>
            )
          )}
          <p>This cannot be undone.</p>
        </Alert>
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
              (scriptName === name &&
                scriptId === id &&
                scriptLockingType === lockingType &&
                scriptIsPushed === isPushed) ||
              (!isTest && scriptId === '')
            }
            onClick={() => {
              if (!isTest && otherIds.includes(scriptId)) {
                setNonUniqueId(scriptId);
              } else {
                editScript({
                  internalId,
                  name: scriptName,
                  id: scriptId,
                  lockingType: scriptLockingType,
                  isPushed: scriptIsPushed,
                });
                closeDialog();
              }
            }}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
