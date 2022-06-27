import * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';
import {
  OpcodesBCH,
  OpcodeDescriptionsBCH,
  Range,
  CompilerOperationsKeyBCH,
  SigningSerializationAlgorithmIdentifier,
  BuiltInVariables,
  CompilerOperationsSigningSerializationComponent,
  CompilerOperationsSigningSerializationFull,
} from '@bitauth/libauth';

const opcodeNames = Object.keys(OpcodesBCH).filter(
  (key) => key.slice(0, 3) === 'OP_'
);

const unknownOpcodes = opcodeNames.filter(
  (key) => key.slice(0, 10) === 'OP_UNKNOWN'
);

const disabledOpcodes = [
  'OP_RESERVED',
  'OP_VER',
  'OP_VERIF',
  'OP_VERNOTIF',
  'OP_INVERT',
  'OP_RESERVED1',
  'OP_RESERVED2',
  'OP_2MUL',
  'OP_2DIV',
  'OP_MUL',
  'OP_LSHIFT',
  'OP_RSHIFT',
];

const pushBytesOpcodes = opcodeNames
  .filter((key) => key.slice(0, 12) === 'OP_PUSHBYTES')
  .concat('OP_PUSHDATA_1', 'OP_PUSHDATA_2', 'OP_PUSHDATA_4');

const pushNumberOpcodes = [
  'OP_1NEGATE',
  'OP_0',
  'OP_1',
  'OP_2',
  'OP_3',
  'OP_4',
  'OP_5',
  'OP_6',
  'OP_7',
  'OP_8',
  'OP_9',
  'OP_10',
  'OP_11',
  'OP_12',
  'OP_13',
  'OP_14',
  'OP_15',
  'OP_16',
];

const nopOpcodes = [
  'OP_NOP',
  'OP_NOP1',
  'OP_NOP4',
  'OP_NOP6',
  'OP_NOP5',
  'OP_NOP7',
  'OP_NOP8',
  'OP_NOP9',
  'OP_NOP10',
];

const flowControlOpcodes = [
  'OP_IF',
  'OP_NOTIF',
  'OP_ENDIF',
  'OP_ELSE',
  'OP_BEGIN',
  'OP_UNTIL',
];
const signatureCheckingOpcodes = [
  'OP_CHECKSIG',
  'OP_CHECKMULTISIG',
  'OP_CHECKDATASIG',
];
const blockingOpcodes = [
  'OP_RETURN',
  'OP_VERIFY',
  'OP_EQUALVERIFY',
  'OP_NUMEQUALVERIFY',
  'OP_CHECKSIGVERIFY',
  'OP_CHECKMULTISIGVERIFY',
  'OP_CHECKLOCKTIMEVERIFY',
  'OP_CHECKSEQUENCEVERIFY',
  'OP_CHECKDATASIGVERIFY',
];
const inspectionOpcodes = [
  'OP_INPUTINDEX',
  'OP_ACTIVEBYTECODE',
  'OP_TXVERSION',
  'OP_TXINPUTCOUNT',
  'OP_TXOUTPUTCOUNT',
  'OP_TXLOCKTIME',
  'OP_UTXOVALUE',
  'OP_UTXOBYTECODE',
  'OP_OUTPOINTTXHASH',
  'OP_OUTPOINTINDEX',
  'OP_INPUTBYTECODE',
  'OP_INPUTSEQUENCENUMBER',
  'OP_OUTPUTVALUE',
  'OP_OUTPUTBYTECODE',
  'OP_UTXOTOKENCATEGORY',
  'OP_UTXOTOKENCOMMITMENT',
  'OP_UTXOTOKENAMOUNT',
  'OP_OUTPUTTOKENCATEGORY',
  'OP_OUTPUTTOKENCOMMITMENT',
  'OP_OUTPUTTOKENAMOUNT',
];

const sortedOpcodes = [
  ...unknownOpcodes,
  ...disabledOpcodes,
  ...pushBytesOpcodes,
  ...pushNumberOpcodes,
  ...inspectionOpcodes,
  ...nopOpcodes,
  ...flowControlOpcodes,
  ...signatureCheckingOpcodes,
  ...blockingOpcodes,
];
const otherOpcodes = opcodeNames.filter((c) => sortedOpcodes.indexOf(c) === -1);

export const languageBCH = {
  unknownOpcodes,
  disabledOpcodes,
  pushBytesOpcodes,
  pushNumberOpcodes,
  nopOpcodes,
  flowControlOpcodes,
  signatureCheckingOpcodes,
  blockingOpcodes,
  inspectionOpcodes,
  otherOpcodes,
};

/**
 * Format: [description, optionalExampleString]
 * `description` is prose description, `optionalExampleString` is the example
 * string illustrating stack operations.
 */
const descriptions = Object.entries(OpcodeDescriptionsBCH)
  .filter(([key]) => key.slice(0, 3) === 'OP_')
  .reduce<{ [opcode: string]: [string, string?] }>((map, [key, value]) => {
    const parts = value.split('(E.g.');
    const description = parts[0];
    const example = parts[1];
    return {
      ...map,
      [key]:
        example !== undefined
          ? [description, example.slice(0, example.length - 1)]
          : [description],
    };
  }, {});

/**
 * Monaco hover and completion providers are global, so we have to ensure we're
 * looking at the correct script.
 */
export const isCorrectScript = (
  model: Monaco.editor.ITextModel,
  script: string
) => model.getValue() === script;

export const opcodeHoverProviderBCH = (
  script: string
): Monaco.languages.HoverProvider => ({
  provideHover: (model, position) => {
    if (!isCorrectScript(model, script)) {
      return;
    }
    const query = model.getWordAtPosition(position);
    if (query !== null) {
      if (descriptions[query.word] !== undefined) {
        const exampleString = descriptions[query.word][1];
        return {
          contents: [
            { value: `**${query.word}**` },
            ...(exampleString !== undefined ? [{ value: exampleString }] : []),
            { value: descriptions[query.word][0] },
          ],
        };
      }
    }
  },
});

const completableOpcodes = [
  ...flowControlOpcodes,
  ...signatureCheckingOpcodes,
  ...inspectionOpcodes,
  ...blockingOpcodes,
  ...otherOpcodes,
];

const opcodeSuggestions = (range: Range) =>
  completableOpcodes.map<Monaco.languages.CompletionItem>((opcode) => ({
    label: opcode,
    detail: descriptions[opcode] === undefined ? '' : descriptions[opcode][1],
    documentation:
      descriptions[opcode] === undefined ? '' : descriptions[opcode][0],
    kind: Monaco.languages.CompletionItemKind.Function,
    insertText: opcode,
    range,
  }));

export const opcodeCompletionItemProviderBCH: Monaco.languages.CompletionItemProvider =
  {
    triggerCharacters: [''],
    provideCompletionItems: (model, position) => {
      const query = model.getWordAtPosition(position);
      const columns = model.getWordUntilPosition(position);
      const range: Range = {
        startColumn: columns.startColumn,
        endColumn: columns.endColumn,
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
      };
      const suggestions =
        query !== null &&
        (query.word === 'O' ||
          query.word === 'OP' ||
          query.word.slice(0, 3) === 'OP_')
          ? opcodeSuggestions(range)
          : [];
      return { suggestions };
    },
  };

export const getKeyOperationDescriptions = (parameter?: string) => {
  const map: { [op in CompilerOperationsKeyBCH]: [string, string] } = {
    data_signature: [
      'Data Signature (ECDSA)',
      `An ECDSA signature covering the sha256 hash of the compiled bytecode ${
        parameter ? `from script ID "${parameter}"` : 'of another script'
      }.`,
    ],
    public_key: [
      'Public Key',
      'The public (non-secret) key derived from this private key.',
    ],
    schnorr_data_signature: [
      'Data Signature (Schnorr)',
      `A Schnorr signature covering the sha256 hash of the compiled bytecode from ${
        parameter ? `from script ID "${parameter}"` : 'of another script'
      }.`,
    ],
    schnorr_signature: [
      'Signature (Schnorr)',
      `A Schnorr signature covering the double sha256 hash of the serialized transaction${
        parameter
          ? ` (using the "${parameter}" signing serialization algorithm)`
          : ''
      }.`,
    ],
    signature: [
      'Signature (ECDSA)',
      `An ECDSA signature covering the double sha256 hash of the serialized transaction${
        parameter
          ? ` (using the "${parameter}" signing serialization algorithm)`
          : ''
      }.`,
    ],
  };
  return map;
};

export const keyOperationsWhichRequireAParameter = [
  'data_signature',
  'schnorr_data_signature',
  'schnorr_signature',
  'signature',
];

export const signatureOperationParameterDescriptions: {
  [parameter in SigningSerializationAlgorithmIdentifier]: [string, string];
} = {
  all_outputs: [
    'A.K.A. "SIGHASH_ALL" (Recommended)',
    'The recommended and most frequently used signing serialization algorithm. This signs each element of the transaction using the private key, preventing an attacker from being able to reuse the signature on a modified transaction.',
  ],
  all_outputs_single_input: [
    'A.K.A. "SIGHASH_ALL" with "ANYONE_CAN_PAY"',
    'A modification to the "all_outputs" signing serialization algorithm which does not cover inputs other than the one being spent.',
  ],
  corresponding_output: [
    'A.K.A. "SIGHASH_SINGLE"',
    'A signing serialization algorithm which only covers the output with the same index value as the input being spent. Warning: this can cause vulnerabilities by allowing the transaction to be modified after being signed.',
  ],
  corresponding_output_single_input: [
    'A.K.A. "SIGHASH_SINGLE" with "ANYONE_CAN_PAY"',
    'A modification to the "corresponding_output" signing serialization algorithm which does not cover inputs other than the one being spent.',
  ],
  no_outputs: [
    'A.K.A. "SIGHASH_NONE"',
    'A signing serialization algorithm which only covers other inputs. Warning: this allows anyone to modify the outputs after being signed.',
  ],
  no_outputs_single_input: [
    'A.K.A. "SIGHASH_NONE" with "ANYONE_CAN_PAY"',
    'A modification to the "no_outputs" signing serialization algorithm which does not cover inputs other than the one being spent.',
  ],
};

const keyOperationPartsToDetails = (operation: string, parameter: string) => {
  return (
    getKeyOperationDescriptions(parameter)[
      operation as CompilerOperationsKeyBCH
    ] || [
      'Unknown Operation',
      `The compiler knows about the "${operation}${
        parameter ? `.${parameter}` : ''
      }" operation, but Bitauth IDE does not. Please open an issue on GitHub.`,
    ]
  );
};

export const getKeyOperationDetails = (variableParts: string[]) => {
  const hasOperation = variableParts.length > 1;
  const [operationName, operationDescription] = hasOperation
    ? keyOperationPartsToDetails(variableParts[1], variableParts[2])
    : [undefined, undefined];
  return {
    hasOperation,
    operationName,
    operationDescription,
  };
};

export const builtInVariableDetails: {
  [variableId in BuiltInVariables]: [string, string];
} = {
  current_block_height: [
    'Current Block Height',
    'Provides the current block height as a Script Number at the time of compilation. This is useful when computing a height for `OP_CHECKLOCKTIMEVERIFY` or `OP_CHECKSEQUENCEVERIFY` which is relative to the current height at the moment a script is created (usually, a locking script).',
  ],
  current_block_time: [
    'Current Block Time',
    'Provides the current block time (at the time of compilation) as a Script Number. This is useful when computing a time for `OP_CHECKLOCKTIMEVERIFY` or `OP_CHECKSEQUENCEVERIFY` which is relative to the current time at the moment a script is created (usually, a locking script).',
  ],
  signing_serialization: [
    'Signing Serialization',
    "Provides access to both the full contents and individual components of the transaction's signing serialization.",
  ],
};

export const signingSerializationOperationDetails: {
  [component in
    | CompilerOperationsSigningSerializationComponent
    | CompilerOperationsSigningSerializationFull]: [string, string];
} = {
  corresponding_output: [
    'Corresponding Output',
    'The signing serialization of the transaction output with the same index as the current input. If no output with the same index exists, this inserts no bytes.',
  ],
  corresponding_output_hash: [
    'Corresponding Output Hash',
    'The hash of the transaction output with the same index as the current input. If no output with the same index exists, 32 bytes of `0x00`.',
  ],
  covered_bytecode: [
    'Covered Bytecode',
    'The `coveredBytecode` provided to the compiler for this compilation.',
  ],
  covered_bytecode_length: [
    'Covered Bytecode Length',
    'The prefix indicating the length of `coveredBytecode` provided to the compiler for this compilation. The length is encoded as a `BitcoinVarInt`.',
  ],
  full_all_outputs: [
    'Full Serialization (all_outputs)',
    'The complete signing serialization as generated by the all_outputs algorithm – the concatenation of: version, transaction_outpoints_hash, transaction_sequence_numbers_hash, covered_bytecode_length, covered_bytecode, output_value, transaction_outputs_hash, 0x41 (the byte representing this signing serialization type), and 0x000000 (fork ID).',
  ],
  full_all_outputs_single_input: [
    'Full Serialization (all_outputs_single_input)',
    'The complete signing serialization as generated by the all_outputs algorithm – the concatenation of: version, 64 bytes of 0x00, covered_bytecode_length, covered_bytecode, output_value, transaction_outputs_hash, 0xc1 (the byte representing this signing serialization type), and 0x000000 (fork ID).',
  ],
  full_corresponding_output: [
    'Full Serialization (corresponding_output)',
    'The complete signing serialization as generated by the all_outputs algorithm – the concatenation of: version, transaction_outpoints_hash, 32 bytes of 0x00, covered_bytecode_length, covered_bytecode, output_value, corresponding_output_hash (or if no corresponding output exists, 32 bytes of 0x00), 0x43 (the byte representing this signing    serialization type), and 0x000000 (fork ID).',
  ],
  full_corresponding_output_single_input: [
    'Full Serialization (corresponding_output_single_input)',
    'The complete signing serialization as generated by the all_outputs algorithm – the concatenation of: version, 64 bytes of 0x00, covered_bytecode_length, covered_bytecode, output_value</code>, corresponding_output_hash (or if no corresponding output exists, 32 bytes of 0x00), 0xc3 (the byte representing this signing serialization type), and 0x000000 (fork ID).',
  ],
  full_no_outputs: [
    'Full Serialization (no_outputs)',
    'The complete signing serialization as generated by the all_outputs algorithm – the concatenation of: version, transaction_outpoints_hash, 32 bytes of 0x00, covered_bytecode_length, covered_bytecode, output_value, 32 bytes of 0x00, 0x42 (the byte representing this signing serialization type), and 0x000000 (fork ID).',
  ],
  full_no_outputs_single_input: [
    'Full Serialization (no_outputs_single_input)',
    'The complete signing serialization as generated by the all_outputs algorithm – the concatenation of: version, 64 bytes of 0x00, covered_bytecode_length, covered_bytecode, output_value, 32 bytes of 0x00, 0xc2 (the byte representing this signing serialization type), and 0x000000 (fork ID).',
  ],
  locktime: ['Locktime', "The transaction's locktime."],
  outpoint_index: [
    'Outpoint Index',
    'The index of the outpoint being spent by the current input.',
  ],
  outpoint_transaction_hash: [
    'Outpoint Transaction Hash',
    'The transaction hash (A.K.A. ID) of the outpoint being spent by the current input.',
  ],
  output_value: [
    'Output Value',
    'The output value of the outpoint being spent by the current input.',
  ],
  sequence_number: [
    'Sequence Number',
    'The sequence number of the outpoint being spent by the current input.',
  ],
  transaction_outpoints: [
    'Transaction Outpoints',
    'The signing serialization of all transaction outpoints.',
  ],
  transaction_outpoints_hash: [
    'Transaction Outpoints Hash',
    'The hash of all transaction outpoints.',
  ],
  transaction_outputs: [
    'Transaction Outputs',
    'The signing serialization of all transaction outputs.',
  ],
  transaction_outputs_hash: [
    'Transaction Outputs Hash',
    'The hash of all transaction outputs.',
  ],
  transaction_sequence_numbers: [
    'Transaction Sequence Numbers',
    'The signing serialization of all transaction sequence numbers.',
  ],
  transaction_sequence_numbers_hash: [
    'Transaction Sequence Numbers Hash',
    'The hash of all transaction sequence numbers.',
  ],
  version: ['Version', "The transaction's version number."],
};

export const getSigningSerializationOperationDetails = (operation: string) => {
  const operationInfo =
    operation in signingSerializationOperationDetails
      ? signingSerializationOperationDetails[
          operation as
            | CompilerOperationsSigningSerializationComponent
            | CompilerOperationsSigningSerializationFull
        ]
      : [
          'Unknown',
          'This operation is not understood by Bitauth IDE. Please report this bug.',
        ];
  return { name: operationInfo[0], description: operationInfo[1] };
};
