import React from 'react';
import './WelcomePane.scss';
import { AppState, IDETemplate } from '../../state/types';
import { connect } from 'react-redux';
import { IconNames } from '@blueprintjs/icons';
import { ActionCreators } from '../../state/reducer';
import multi from '../../templates/2-of-3.json';
import recoverable from '../../templates/2-of-2-recoverable.json';
import { ideImportAuthenticationTemplate } from '../../state/import-export';
import {
  AuthenticationTemplate,
  authenticationTemplateP2pkh,
} from '@bitauth/libauth';
import { Icon } from '@blueprintjs/core';
import { createInsecureUuidV4 } from '../../state/utils';

const isValidTemplate = (result: IDETemplate | string): result is IDETemplate =>
  typeof result !== 'string';
const assertValidTemplate = (result: IDETemplate | string) => {
  if (!isValidTemplate(result)) {
    throw new Error(`Default template is invalid: ${result}`);
  }
  return result;
};

const defaultTemplates = {
  single: assertValidTemplate(
    ideImportAuthenticationTemplate(authenticationTemplateP2pkh)
  ),
  multi: assertValidTemplate(
    ideImportAuthenticationTemplate(multi as AuthenticationTemplate)
  ),
  recoverable: assertValidTemplate(
    ideImportAuthenticationTemplate(recoverable as AuthenticationTemplate)
  ),
};

interface WelcomePaneDispatch {
  importExport: typeof ActionCreators.importExport;
  importTemplate: typeof ActionCreators.importTemplate;
  openTemplateSettings: typeof ActionCreators.openTemplateSettings;
  resetTemplate: typeof ActionCreators.resetTemplate;
  createScript: typeof ActionCreators.createScript;
}

const templateIconSize = 12;

export const WelcomePane = connect((state: AppState) => ({}), {
  importExport: ActionCreators.importExport,
  importTemplate: ActionCreators.importTemplate,
  openTemplateSettings: ActionCreators.openTemplateSettings,
  resetTemplate: ActionCreators.resetTemplate,
  createScript: ActionCreators.createScript,
})((props: WelcomePaneDispatch) => (
  <div className="WelcomePane EditorPane">
    <div className="EditorPaneContents">
      <div className="welcome-box">
        <h3 className="instructions">Choose a template to begin</h3>
        <button
          className="starter-template"
          onClick={() => {
            props.importTemplate(defaultTemplates.single);
            props.openTemplateSettings();
          }}
        >
          <h4>
            <Icon icon={IconNames.PERSON} iconSize={templateIconSize} />
            Single Signature (P2PKH) &rarr;
          </h4>
          <p>Transactions are signed by only a single key.</p>
        </button>
        <button
          className="starter-template"
          onClick={() => {
            props.importTemplate(defaultTemplates.multi);
            props.openTemplateSettings();
          }}
        >
          <h4>
            <Icon icon={IconNames.PEOPLE} iconSize={templateIconSize} />
            2-of-3 Multi-Signature &rarr;
          </h4>
          <p>Transactions require any two of three co-owners to sign.</p>
        </button>
        <button
          className="starter-template"
          onClick={() => {
            props.importTemplate(defaultTemplates.recoverable);
            props.openTemplateSettings();
          }}
        >
          <h4>
            <Icon icon={IconNames.TIME} iconSize={templateIconSize} />
            2-of-2 Recoverable Vault &rarr;
          </h4>
          <p>
            Transactions require either both co-owners to sign, or after a
            delay, one co-owner and another trusted party.
          </p>
        </button>
        {/* <div
            className="starter-template"
            onClick={() => {
              // props.importTemplate(defaultTemplates.tree);
              props.openTemplateSettings();
            }}
          >
            <h4>
              <Icon icon={IconNames.DIAGRAM_TREE} iconSize={templateIconSize} />
              1-of-8 Tree Signature &rarr;
            </h4>
            <p>
              Transactions require any of 8 signers, without requiring the
              public revelation of the other 7 signers' public keys.
            </p>
          </div> */}
        {/* <div
            className="starter-template"
            onClick={() => {
              props.importTemplate(defaultTemplates.zcf);
              props.openTemplateSettings();
            }}
          >
            <h4>
              <Icon icon={IconNames.OFFLINE} iconSize={templateIconSize} />
              Zero-Confirmation Forfeit (ZCF) &rarr;
            </h4>
            <p>
              A single-signature wallet with a public bounty – if the owner
              attempts to double-spend, the bounty is forfeited to a miner.
            </p>
          </div> */}
        <button
          className="starter-template"
          onClick={() => {
            props.resetTemplate();
            props.createScript({
              name: 'Scratch Pad',
              id: 'scratch_pad',
              internalId: createInsecureUuidV4(),
              type: 'isolated',
              contents: `/**
* This simple template makes it easy to experiment 
* with most opcodes.
* 
* Note, this script is evaluated as a locking script.
* To work with keys and signatures, add an unlocking
* script and key variables, or try starting from
* another template.
*/

<'hello'> <'🌎'>
OP_CAT
OP_HASH160
<0xfec6d89ec9eb8665b1fd48c9e7ff2aa2aaf2a200>
OP_EQUAL
<2>
OP_ADD`,
            });
          }}
        >
          <h4>
            <Icon icon={IconNames.CLEAN} iconSize={templateIconSize} />
            Scratch Pad &rarr;
          </h4>
          <p>A blank slate, ready for some creative genius.</p>
        </button>
        <button
          className="starter-template"
          onClick={() => {
            props.resetTemplate();
            props.importExport();
          }}
        >
          <h4>
            <Icon icon={IconNames.REPEAT} iconSize={templateIconSize} />
            Import or Restore Template &rarr;
          </h4>
          <p>Import or restore a template from a previous session.</p>
        </button>
      </div>
    </div>
  </div>
));
