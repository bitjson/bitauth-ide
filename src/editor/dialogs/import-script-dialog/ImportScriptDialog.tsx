import '../editor-dialog.css';
import './ImportScriptDialog.css';
import { ActionCreators } from '../../../state/reducer';
import { ActiveDialog } from '../../../state/types';
import { createInsecureUuidV4 } from '../../../utils';
import { toConventionalId } from '../../common';

import { disassembleBytecodeBch, hexToBin } from '@bitauth/libauth';
import {
  Button,
  Classes,
  Dialog,
  FormGroup,
  InputGroup,
} from '@blueprintjs/core';
import { WarningSign } from '@blueprintjs/icons';
import React, { useState } from 'react';

const disassembleHex = (hex: string) => disassembleBytecodeBch(hexToBin(hex));
const tokenizeHex = (hex: string) => {
  const splitAtErrors = disassembleHex(hex).split('[');
  return [
    ...splitAtErrors[0]!.split(' '),
    ...(splitAtErrors.length > 1 ? [`[${splitAtErrors[1]}`] : []),
  ];
};

export const ImportScriptDialog = ({
  activeDialog,
  closeDialog,
  createScript,
  usedIds,
}: {
  activeDialog: ActiveDialog;
  closeDialog: typeof ActionCreators.closeDialog;
  createScript: typeof ActionCreators.createScript;
  usedIds: string[];
}) => {
  const [bytecode, setBytecode] = useState('');
  const [scriptName, setScriptName] = useState('');
  const [scriptId, setScriptId] = useState('');
  const [nonUniqueId, setNonUniqueId] = useState('');

  return (
    <Dialog
      className="editor-dialog ImportScriptDialog"
      onClose={() => closeDialog()}
      title="Import Script from Bytecode"
      isOpen={activeDialog === ActiveDialog.importScript}
      canOutsideClickClose={false}
    >
      <div className={Classes.DIALOG_BODY}>
        <FormGroup
          helperText={
            <span>
              {bytecode === '' ? (
                'Paste the hexadecimal-encoded bytecode here.'
              ) : (
                <p>
                  <code className="preview">
                    {tokenizeHex(bytecode).map((token, i) => (
                      <span key={i}>
                        <span className="preview-token">{token}</span>{' '}
                      </span>
                    ))}
                  </code>
                </p>
              )}
            </span>
          }
          label="Bytecode"
          labelFor="bytecode"
          inline={true}
        >
          <InputGroup
            id="bytecode"
            value={bytecode}
            autoComplete="off"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const value = e.target.value;
              setBytecode(value.replace(/[^a-fA-F0-9]/, '').toLowerCase());
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
            disabled={scriptName === '' || scriptId === ''}
            onClick={() => {
              if (usedIds.includes(scriptId)) {
                setNonUniqueId(scriptId);
              } else {
                setBytecode('');
                setScriptName('');
                setScriptId('');
                setNonUniqueId('');
                createScript({
                  name: scriptName,
                  id: scriptId,
                  internalId: createInsecureUuidV4(),
                  type: 'isolated',
                  contents: disassembleHex(bytecode)
                    .split('[')[0]!
                    .split(' ')
                    .join('\n'),
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
