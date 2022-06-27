import React, { useState } from 'react';
import './TemplateSettings.scss';
import {
  EditableText,
  FormGroup,
  Button,
  Icon,
  Intent,
  Alert,
  Checkbox,
} from '@blueprintjs/core';
import { AppState, IDESupportedVM } from '../../state/types';
import { connect } from 'react-redux';
import { IconNames } from '@blueprintjs/icons';
import { ActionCreators } from '../../state/reducer';
import { AuthenticationVirtualMachineIdentifier } from '@bitauth/libauth';

const availableVms: { [key in IDESupportedVM]: React.ReactNode } = {
  BCH_2022_05: (
    <span className="vm">
      <code>BCH_2022_05</code>
      <span className="chain">Bitcoin Cash</span>
      <span className="version">2022 May Upgrade</span>
      <span className="tag live">live</span>
    </span>
  ),
  BCH_SPEC: (
    <span className="vm">
      <code>BCH_CHIPs</code>
      <span className="chain">Bitcoin Cash</span>
      <span className="version">2023 May Proposals</span>
      <span className="tag spec">Spec</span>
    </span>
  ),
  BSV_2020_02: (
    <span className="vm">
      <code>BSV_2020_02</code>
      <span className="chain">Bitcoin SV</span>
      <span className="version">2020 Genesis Update</span>
      <span className="tag live">Live</span>
    </span>
  ),
  BTC_2017_08: (
    <span className="vm">
      <code>BTC_2017_08</code>
      <span className="chain">Bitcoin</span>
      <span className="version">2017 August Update</span>
      <span className="tag live">Live</span>
    </span>
  ),
};

interface TemplateSettingsProps {
  name: string;
  description: string;
  supportedVirtualMachines: AuthenticationVirtualMachineIdentifier[];
}

interface TemplateSettingsDispatch {
  updateTemplateName: typeof ActionCreators.updateTemplateName;
  updateTemplateDescription: typeof ActionCreators.updateTemplateDescription;
  updateTemplateSupportedVM: typeof ActionCreators.updateTemplateSupportedVM;
  resetTemplate: typeof ActionCreators.resetTemplate;
  importExport: typeof ActionCreators.importExport;
  showWelcomePane: typeof ActionCreators.showWelcomePane;
}

const urlRegExp =
  /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g;
const captureGroups = 4;
const activateLinks = (description: string) => {
  const matches = description.match(urlRegExp);
  if (matches === null) {
    return description;
  }
  const links = matches.map((match) => (
    <a
      target="_blank"
      rel="noopener noreferrer"
      key={match}
      href={
        ['http://', 'https://'].indexOf(match) === -1
          ? `https://${match}`
          : match
      }
    >
      {match}
    </a>
  ));
  return description
    .split(urlRegExp)
    .filter((_, i) => i % (captureGroups + 1) === 0)
    .map((slice, i) => [
      <React.Fragment key={slice}>{slice}</React.Fragment>,
      links[i],
    ])
    .flat();
};

export const TemplateSettings = connect(
  (state: AppState) => ({
    name: state.currentTemplate.name,
    description: state.currentTemplate.description,
    supportedVirtualMachines: state.currentTemplate.supportedVirtualMachines,
  }),
  {
    updateTemplateName: ActionCreators.updateTemplateName,
    updateTemplateDescription: ActionCreators.updateTemplateDescription,
    updateTemplateSupportedVM: ActionCreators.updateTemplateSupportedVM,
    resetTemplate: ActionCreators.resetTemplate,
    importExport: ActionCreators.importExport,
    showWelcomePane: ActionCreators.showWelcomePane,
  }
)((props: TemplateSettingsProps & TemplateSettingsDispatch) => {
  const [promptDelete, setPromptDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fastName, setFastName] = useState(props.name);
  const [fastDescription, setFastDescription] = useState(props.description);
  return (
    <div className="TemplateSettings EditorPane">
      <div className="EditorPaneContents template-settings">
        <h3 className="name">
          <EditableText
            maxLength={100}
            placeholder="Template Name"
            selectAllOnFocus={true}
            value={fastName}
            onChange={(name) => setFastName(name)}
            onConfirm={(name) => props.updateTemplateName(name)}
            disabled={!isEditing}
          />
          {isEditing ? (
            <Button
              className="ide-secondary-button"
              onClick={() => setIsEditing(false)}
            >
              <Icon icon={IconNames.SAVED} iconSize={10} />
              Done
            </Button>
          ) : (
            <Button
              className="ide-secondary-button"
              onClick={() => setIsEditing(true)}
            >
              <Icon icon={IconNames.EDIT} iconSize={10} />
              Edit
            </Button>
          )}
        </h3>
        <div className="description">
          {isEditing ? (
            <EditableText
              maxLength={50000}
              minLines={3}
              multiline={true}
              placeholder="A brief description of this authentication template..."
              selectAllOnFocus={true}
              value={fastDescription}
              onChange={(description) => setFastDescription(description)}
              onConfirm={(description) =>
                props.updateTemplateDescription(description)
              }
            />
          ) : (
            <pre>{activateLinks(props.description)}</pre>
          )}
        </div>
        <div className="divider" />
        <FormGroup
          label={
            <span className="supported-vms-label">
              <h4>Supported Virtual Machines</h4>
              {isEditing ? (
                <>
                  {' '}
                  <p>
                    Here you can edit the list of Virtual Machines that this
                    authentication template supports.
                  </p>
                  <p>
                    Bitcoin VMs vary in subtle but critical ways. While many
                    templates will be usable across all VMs, each template must
                    be reviewed for compatibility.
                  </p>
                </>
              ) : (
                <p>
                  This authentication template has been confirmed to work on
                  these Bitcoin VMs.
                </p>
              )}
            </span>
          }
          inline={true}
        >
          <div>
            {Object.entries(availableVms)
              .filter(([id]) =>
                isEditing
                  ? true
                  : props.supportedVirtualMachines.indexOf(
                      id as IDESupportedVM
                    ) !== -1
              )
              .map(([id, label]) => {
                const vm = id as IDESupportedVM;
                const enabled =
                  props.supportedVirtualMachines.indexOf(vm) !== -1;
                return (
                  <Checkbox
                    checked={enabled}
                    key={id}
                    labelElement={label}
                    value={id}
                    disabled={!isEditing}
                    onChange={(_) => {
                      props.updateTemplateSupportedVM(vm, !enabled);
                    }}
                  />
                );
              })}
          </div>
        </FormGroup>
        <div className="divider" />
        {isEditing ? (
          ' '
        ) : (
          <p className="instructions">
            To review the entities and scripts used by this template, choose an
            item from the menu to the left.
          </p>
        )}
        <Button
          className="ide-secondary-button import-button"
          onClick={() => props.importExport()}
        >
          <Icon icon={IconNames.CHANGES} iconSize={10} />
          Import/Export Template...
        </Button>
        <Button
          className="ide-secondary-button delete-item-button"
          onClick={() => setPromptDelete(true)}
        >
          <Icon icon={IconNames.TRASH} iconSize={10} />
          Reset to a Built-in Template...
        </Button>
        <Alert
          cancelButtonText="Cancel"
          confirmButtonText="Reset Project"
          intent={Intent.DANGER}
          isOpen={promptDelete}
          canEscapeKeyCancel={true}
          canOutsideClickCancel={true}
          onCancel={() => setPromptDelete(false)}
          onConfirm={() => {
            props.resetTemplate();
            setPromptDelete(false);
            props.showWelcomePane();
          }}
        >
          <p>
            Are you sure you want to delete this entire project and start with a
            new authentication template?
          </p>
          <p>
            While this template can be restored from its autosave, consider
            downloading your work before continuing.
          </p>
        </Alert>
      </div>
    </div>
  );
});
