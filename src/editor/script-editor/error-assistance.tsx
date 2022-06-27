import {
  AuthenticationErrorBCH2022,
  AuthenticationErrorCommon,
  binToHex,
} from '@bitauth/libauth';
import { IDESupportedProgramState, ScriptEditorFrame } from '../editor-types';
import React from 'react';
import { Popover } from '@blueprintjs/core';
import { abbreviateStackItem } from '../common';

export type PossibleErrors =
  | AuthenticationErrorCommon
  | AuthenticationErrorBCH2022;

/**
 * This predates Libauth v2, where VM error messages can include contextual
 * information. It would probably be better to improve those messages instead of
 * expanding this.
 */
export const vmErrorAssistanceBCH: {
  [error in PossibleErrors]?: (
    state: IDESupportedProgramState
  ) => string | JSX.Element;
} = {
  [AuthenticationErrorCommon.unsatisfiedLocktime]: (state) => (
    <span>
      This error occurs when the transaction's locktime hasn't reached the
      locktime required by this operation. In this scenario, the transaction's
      locktime is set to <code>{state.program.transaction.locktime}</code>.
    </span>
  ),
  [AuthenticationErrorCommon.nonNullSignatureFailure]: (state) => {
    return (
      <div className="help-popover-scroll">
        <p>
          This error occurs when a signature checking operation fails. In
          Bitauth IDE, this can happen for several reasons:
        </p>
        <ul>
          <li>
            <p>
              <em>Signing the wrong message</em> – this is especially likely if
              you have copy/pasted a signature. It's important to recognize that{' '}
              signatures must sign a specific message: it's not enough to copy a
              signature and a public key, if the full transaction context isn't
              also the same, signature checks will still fail.
            </p>
            <details>
              <summary>Details</summary>
              <p>
                At this point in the evaluation, the virtual machine has checked
                signatures against {state.signedMessages.length}{' '}
                serializations/messages (in order):
              </p>
              <ol>
                {state.signedMessages.map((message, index) => {
                  const hex = binToHex(message);
                  return (
                    <li key={index} className="error-signed-message-list-item">
                      <Popover
                        content={hex}
                        portalClassName="stack-popover"
                        interactionKind="hover"
                        position="left-bottom"
                      >
                        <span className="error-signed-message-hex">
                          0x{abbreviateStackItem(hex)}
                        </span>
                      </Popover>
                    </li>
                  );
                })}
              </ol>
              <p>
                To debug this error, identify which of the above messages
                differs from the message signed by the failing signature (likely
                the last message before this error, #
                {state.signedMessages.length}), then identify the differences
                between the signed message and the expected one.
              </p>
              <p>
                Please note, Bitauth template variables provide a built-in way
                to automatically generate signatures which sign the correct
                "message" (a signing serialization of the transaction). Precise
                transaction contexts can also be modeled using template
                scenarios. See the guide for information about creating and
                using key variables and scenarios.
              </p>
            </details>
          </li>
          <li>
            <em>Non-null signature failures</em> – occasionally, locking scripts
            are designed to allow a particular signature check to fail without
            the script itself failing. For example, a script might check the
            result of an <code>OP_CHECKSIG</code> by reading from the stack,
            then perform some additional validation if the result is a{' '}
            <code>0</code>. To prevent some types of transaction malleability,
            these scripts <em>must</em> provide a "null signature" (a{' '}
            <code>0</code> value) to the failing signature check, or the virtual
            machine will return an error. See BIP146 for details.
          </li>
        </ul>
      </div>
    );
  },
};

export const renderSimpleMarkdown = (markdown: string) =>
  markdown.split('`').reduce((all, segment, index) => {
    const insideCodeBlock = index % 2 === 0;
    const splitEmphasis = segment.split('**');
    const hasEmphasis = insideCodeBlock && splitEmphasis.length > 2;
    return insideCodeBlock ? (
      <>
        {all}
        {hasEmphasis
          ? splitEmphasis.reduce(
              (emphasized, emSegment, emIndex) =>
                emIndex % 2 === 0 ? (
                  <>
                    {emphasized}
                    {emSegment}
                  </>
                ) : (
                  <>
                    {emphasized}
                    <em>{emSegment}</em>
                  </>
                ),
              <></>
            )
          : segment}
      </>
    ) : (
      <>
        {all}
        <code>{segment}</code>
      </>
    );
  }, <></>);

const extractGroupsOrLogError = (errorMessage: string, regex: RegExp) => {
  const result = errorMessage.match(regex);
  const groups =
    result !== null ? (result.slice(1) as (string | undefined)[]) : [];
  if (groups.length === 0) {
    console.error(
      `Unexpected error message: failed to extract groups using RegExp:/n ${regex}/nError message:/n ${errorMessage}`
    );
  }
  return groups;
};

export const compilationErrorAssistance: {
  regex: RegExp;
  /**
   * A method which accepts the error message matching `regex` and the "frame"
   * context, and returns one or more hints as a markdown-formatted string. The
   * Monaco hover provider uses the markdown string directly, while the uncached
   * evaluation viewer converts it into a JSX element.
   */
  generateHints: (
    errorMessage: string,
    frame: ScriptEditorFrame<IDESupportedProgramState>
  ) => string[];
}[] = [
  {
    regex: /Unknown identifier/,
    generateHints: (error) => {
      const [identifier] = extractGroupsOrLogError(
        error,
        /Unknown identifier "([^"]*)"/
      );
      const hasNonHexCharacter = /[^a-fA-F0-9]/u;
      const usesOnlyHexCharacters =
        typeof identifier === 'string' && !hasNonHexCharacter.test(identifier);

      const hasPeriodCharacter = /\./;
      const mightIncludeEntityId =
        typeof identifier === 'string' && hasPeriodCharacter.test(identifier);

      return [
        ...(usesOnlyHexCharacters
          ? [
              'Is this a hexadecimal-encoded value? Prefix it with `0x` to make it a hex literal.',
            ]
          : []),
        ...(mightIncludeEntityId
          ? [
              'Note, all variables must be referenced without their owning entity ID, e.g. rather than `entity.my_variable`, use `my_variable`.',
            ]
          : []),
        `In Bitauth IDE, this error usually occurs when an identifier is misspelled or the variable has not yet been defined. To resolve this error, ensure that the variable has been created within an entity and that this variable ID is correct.`,
      ];
    },
  },
  {
    regex: /the "bytecode" property was not provided in the compilation data/,
    generateHints: (error, frame) => {
      const [identifier] = extractGroupsOrLogError(
        error,
        /Cannot resolve "([^"]*)" – the "bytecode" property was not provided in the compilation data/
      );

      return frame.scriptType === 'isolated'
        ? [
            `In Bitauth IDE, this error occurs when the selected scenario doesn't include a \`bytecode\` value for the referenced variable. (Note, the default scenario does not support \`AddressData\` or \`WalletData\` variables.) To resolve this error, add an unlocking script or test to this script (by creating a new script which unlocks or tests the "${frame.scriptName}" script), then add a scenario to that script which includes a value for \`${identifier}\`.`,
          ]
        : [
            `In Bitauth IDE, this error occurs when the selected scenario doesn't include a \`bytecode\` value for the referenced variable. (Note, the default scenario does not support \`AddressData\` or \`WalletData\` variables.) To resolve this error, ensure all scenarios used by this script includes a value for \`${identifier}\`.`,
          ];
    },
  },
  {
    regex:
      /the "transactionContext" property was not provided in the compilation data/,
    generateHints: (error, frame) => {
      const [identifier] = extractGroupsOrLogError(
        error,
        /Cannot resolve "([^"]*)" – the "transactionContext" property was not provided in the compilation data/
      );

      return [
        `In Bitauth IDE, this error usually occurs when an operation which requires transaction information is used outside of an unlocking script. For example, **it's not possible to produce a signature within a locking script**, since the signature must sign a message which includes the locking script bytecode in which the signature is to be checked. Before a valid signature can be generated, the compiler needs to know where the signature will be used to generate the correct "signing serialization". To resolve this error, make sure \`${identifier}\` is only referenced within an unlocking script or the "setup" script of a script test.${
          frame.scriptType === 'isolated'
            ? ` You may need to add a new unlocking script or script test targeting this isolated script ("${frame.scriptName}").`
            : ''
        }`,
      ];
    },
  },
];
