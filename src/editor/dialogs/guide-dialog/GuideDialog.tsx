import '../editor-dialog.scss';
import './GuideDialog.scss';
import React from 'react';
import { ActionCreators } from '../../../state/reducer';
import { ActiveDialog } from '../../../state/types';
import { Classes, Dialog } from '@blueprintjs/core';

export const GuideDialog = ({
  activeDialog,
  closeDialog,
}: {
  activeDialog: ActiveDialog;
  closeDialog: typeof ActionCreators.closeDialog;
}) => {
  return (
    <Dialog
      className="editor-dialog GuideDialog"
      onClose={() => closeDialog()}
      // title="Bitauth IDE Guide"
      isOpen={activeDialog === ActiveDialog.guide}
      canOutsideClickClose={true}
    >
      <div className={Classes.DIALOG_BODY}>
        <h2>Welcome!</h2>
        <p>
          <em>Bitauth IDE</em> is an integrated development environment for
          bitcoin authentication. This guide will explain features of the IDE
          and templating language.
        </p>
        <h2>Bitauth Templates</h2>
        <p>
          When you work in Bitauth IDE, you're working on a{' '}
          <em>Bitauth Template</em>. It's a JSON file which fully describes the
          authentication protocol for a bitcoin wallet. Compatible wallet
          software can import your template and generate a fully-functional
          wallet, even for complex, multi-party protocols. Bitauth IDE lets you
          write, test, and export Bitauth templates.
        </p>
        <p>Bitauth templates include three primary concepts:</p>
        <ul>
          <li>
            <em>Entities</em> – the individuals and/or devices participating in
            the wallet.
          </li>
          <li>
            <em>Scripts</em> – the code used by wallet software to create
            addresses and transactions.
          </li>
          <li>
            <em>Scenarios</em> – a set of example situations used for testing
            and fee estimation.
          </li>
        </ul>
        <h3>Entities</h3>
        <p>
          A Bitauth template defines a set of <em>entities</em> which will use
          the template. Each entity can be assigned one or more{' '}
          <em>variables</em> for which they are responsible. There are currently
          4 variable types: <em>HdKey</em>, <em>Key</em>, <em>WalletData</em>,{' '}
          and <em>AddressData</em> (details below).
        </p>
        <p>
          When a wallet is created, each entity shares the public elements of
          their variables. Values are validated to prevent man-in-the-middle
          attacks, and then wallet addresses are generated.
        </p>
        <h3>Scripts</h3>
        <p>
          all Bitauth templates define a set of scripts which are used by its
          entities. There are 4 types of scripts:
        </p>
        <ul>
          <li>
            <em>Locking Scripts</em> – scripts from which wallet addresses are
            generated.
          </li>
          <li>
            <em>Unlocking Scripts</em> – scripts which enable wallet software to
            spend from the wallet.
          </li>
          <li>
            <em>Isolated Scripts</em> – scripts used as macros or bytecode
            templates.
          </li>
          <li>
            <em>Isolated Script Tests</em> – a pair of scripts (<em>Setup</em>{' '}
            and <em>Check</em>) used to verify the functionality of an isolated
            script.
          </li>
        </ul>
        <h3>Scenarios</h3>
        <p>
          Bitauth templates may define one or more scenarios to be used by its
          scripts. Scenarios are like built-in examples for a template – a
          scenario can define:
        </p>
        <ul>
          <li>
            <em>Variable values</em> – example variable values to use during
            development of scripts and for fee estimation in multi-entity
            wallets.
          </li>
          <li>
            <em>Transaction context</em> – an example context in which the
            scenario occurs, including specific values for transaction{' '}
            <code>version</code>, <code>locktime</code>, inputs, and outputs.
          </li>
        </ul>
        <p>
          With scenarios, you can test scripts at different moments in time,
          with different variable values, and in different transaction contexts.
          See <code>Developing Scenarios</code> below for details.
        </p>
        <h2>Bitauth Templating Language (BTL)</h2>
        <p>
          Bitauth template scripts are written in{' '}
          <em>Bitauth Templating Language (BTL)</em>. The language is very
          low-level – any bitcoin virtual machine bytecode can be represented in
          BTL.
        </p>
        <h3>Opcodes</h3>
        <p>
          Opcode identifiers in BTL are prefixed with <code>OP_</code>. During
          compilation, opcode identifiers are replaced with their bytecode
          equivalents. E.g <code>OP_0 OP_1 OP_ADD</code> will compile to the
          bytecode <code>005193</code> (hex-encoded).
        </p>
        <p>
          All opcodes are also autocompleted within the IDE. To read a
          description of a given opcode, hover over it in the editor. You can
          also find resources describing bitcoin opcodes online.
        </p>
        <h3>Literal Data Types</h3>
        <p>BTL supports 4 literal data types:</p>
        <ul>
          <li>
            <em>Hex literals</em> – hex-encoded data, prefixed with{' '}
            <code>0x</code>, e.g. <code>0xc0de</code>. For improved readability,
            underscores (<code>_</code>) can be used as separators within the
            hex literal, e.g. <code>0x0000_1111_0000_1111</code>.
          </li>
          <li>
            <em>UTF8 literals</em> – UTF8-encoded data, surrounded by single
            quotes (<code>'</code>) or double quotes (<code>"</code>), e.g.{' '}
            <code>'this is a string'</code> or{' '}
            <code>
              "UTF8{' '}
              <span role="img" aria-label="thumbs up">
                👍
              </span>
              "
            </code>
            .
          </li>
          <li>
            <em>BigInt literals</em> – integers, e.g. <code>1234</code>. For
            improved readability, underscores (<code>_</code>) can be used as
            separators within the BigInt literal, e.g.{' '}
            <code>1_000_000_000</code>.
          </li>
          <li>
            <em>Binary literals</em> – binary-encoded integers, e.g.{' '}
            <code>0b00101010</code>. For improved readability, underscores (
            <code>_</code>) can be used as separators within the binary literal,
            e.g. <code>0b0010_1010_0000_0000</code>. Binary literals are
            converted to integers
          </li>
        </ul>
        <h3>Push Statements</h3>
        <p>
          Push statements are surrounded by <code>&lt;</code> and{' '}
          <code>&gt;</code>, and generate the opcode to push their compiled
          contents to the stack.
        </p>
        <p>
          For example <code>&lt;"abc"&gt;</code> will generate the bytecode to
          push <code>"abc"</code> (<code>616263</code>) to the stack:{' '}
          <code>03616263</code> (disassembled:{' '}
          <code>OP_PUSHBYTES_3 0x616263</code>). Pushes are automatically
          minimized: e.g. <code>&lt;1&gt;</code> compiles to <code>51</code>{' '}
          (disassembled: <code>OP_1</code>), and <code>&lt;OP_0&gt;</code>{' '}
          (equivalent to <code>&lt;0x00&gt;</code>) compiles to{' '}
          <code>0100</code> (disassembled: <code>OP_PUSHBYTES_1 0x00</code>).
        </p>
        <p>
          Any valid BTL can be contained in a push statement (including further
          push statements), so code like{' '}
          <code>&lt;&lt;&lt;&lt;1&gt;&gt;&gt;&gt;</code> is valid. (Result:{' '}
          <code>03020151</code>)
        </p>
        <h3>Including Variables &amp; Scripts</h3>
        <p>
          Every Script and variable has a unique ID within the template. Both
          can be included by referencing the unique ID. E.g. a{' '}
          <code>WalletData</code> variable with an ID of <code>nonce</code> can
          be pushed to the stack with <code>&lt;nonce&gt;</code>.
        </p>
        <p>
          When referenced, variables and scripts are included directly as
          bytecode. This makes it possible to provide segments of bytecode in
          variables and to use isolated scripts as macros. E.g.{' '}
          <code>&lt;my_number&gt; pad_value</code> might push the variable{' '}
          <code>my_number</code> and then insert the <code>pad_value</code>{' '}
          script, which might be defined as <code>&lt;8&gt; OP_NUM2BIN</code>,
          padding <code>my_number</code> to 8 bytes.
        </p>
        <h3>Custom Variable Types</h3>
        <p>
          Each variable has a type which specifies its role in a template. There
          are currently 4 custom variable types:
        </p>
        <ul>
          <li>
            <code>AddressData</code>– Address Data is the most low-level
            variable type. It must be collected and stored each time a script is
            generated (usually, a locking script). Address Data can include any
            type of data, and can be used in any way. For more persistent data,
            use <code>WalletData</code>.
          </li>
          <li>
            <code>HdKey</code>– The HD Key (Hierarchical-Deterministic Key) type
            automatically manages key generation and mapping in a standard way.
            For greater control, use a Key.
          </li>
          <li>
            <code>Key</code>– The Key type provides fine-grained control over
            key generation and mapping. Most templates should instead use{' '}
            <code>HdKey</code>.
          </li>
          <li>
            <code>WalletData</code>– The Wallet Data type provides a static
            piece of data – collected once and stored at the time of wallet
            creation. Wallet Data is persisted for the life of the wallet,
            rather than changing from locking script to locking script. For
            address-specific data, use <code>AddressData</code>.
          </li>
        </ul>
        <h3>Key Variable Operations</h3>
        <p>
          Some variable types provide operations which are accessed with a
          period (<code>.</code>), e.g. the public key of the <code>owner</code>{' '}
          Key can be pushed to the stack with{' '}
          <code>&lt;owner.public_key&gt;</code>.
        </p>
        <p>
          Several operations are available to <code>Key</code> and{' '}
          <code>HdKey</code> variables:
        </p>
        <ul>
          <li>
            <code>public_key</code>– include the public key.
          </li>
          <li>
            <code>signature.[signing_serialization_type]</code>– create an ECDSA
            signature using the key and the selected signing serialization
            algorithm.
          </li>
          <li>
            <code>schnorr_signature.[signing_serialization_type]</code>– create
            a schnorr signature using the key and the selected signing
            serialization algorithm.
          </li>
          <li>
            <code>data_signature.[SCRIPT_ID]</code>– create a data signature
            using the key by signing the compiled output of SCRIPT_ID.
          </li>
          <li>
            <code>schnorr_data_signature.[SCRIPT_ID]</code>– create a schnorr
            data signature using the key by signing the compiled output of
            SCRIPT_ID.
          </li>
        </ul>
        <h4>Signatures</h4>
        <p>
          Signatures (<code>signature</code> and <code>schnorr_signature</code>)
          are generated by serializing elements of the signed transaction in a
          standard way, hashing the serialization, and signing the message hash.
        </p>
        <p>There are 6 signing serialization algorithms:</p>
        <ul>
          <li>
            <code>all_outputs</code>– the recommended (and most commonly used)
            signing serialization algorithm. This signs each element of the
            transaction using the private key, preventing an attacker from being
            able to reuse the signature on a modified transaction. (A.K.A.
            "SIGHASH_ALL")
          </li>
          <li>
            <code>all_outputs_single_input</code>– a modification to the
            "all_outputs" signing serialization algorithm which does not cover
            inputs other than the one being spent. (A.K.A. "SIGHASH_ALL" with
            "ANYONE_CAN_PAY")
          </li>
          <li>
            <code>corresponding_output</code>– a signing serialization algorithm
            which only covers the output with the same index value as the input
            being spent. Warning: this can cause vulnerabilities by allowing the
            transaction to be modified in certain ways after being signed.
            (A.K.A. "SIGHASH_SINGLE")
          </li>
          <li>
            <code>corresponding_output_single_input</code>– a modification to
            the "corresponding_output" signing serialization algorithm which
            does not cover inputs other than the one being spent. (A.K.A.
            "SIGHASH_SINGLE" with "ANYONE_CAN_PAY")
          </li>
          <li>
            <code>no_outputs</code>– a signing serialization algorithm which
            only covers other inputs. Warning: this allows anyone to modify the
            outputs after being signed. (A.K.A. "SIGHASH_NONE")
          </li>
          <li>
            <code>no_outputs_single_input</code>– a modification to the
            "no_outputs" signing serialization algorithm which does not cover
            inputs other than the one being spent. (A.K.A. "SIGHASH_NONE" with
            "ANYONE_CAN_PAY")
          </li>
        </ul>
        <p>
          Most authentication schemes should use the <code>all_outputs</code>{' '}
          setting, e.g. <code>&lt;owner.signature.all_outputs&gt;</code>. This
          prevents an attacker from being able to reuse the signature on a
          different transaction (which the key holder did not intend to
          authorize).
        </p>
        <p>
          For unique circumstances, the other algorithms can also be specified –
          you can find resources online which describe some of these scenarios
          and their security implications.
        </p>
        <p>
          To display debugging information, Bitauth IDE transparently integrates
          scripts into a simple transaction and evaluates it in the{' '}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/bitauth/libauth"
          >
            libauth
          </a>{' '}
          virtual machine implementation.
        </p>
        <h4>Data Signatures</h4>
        <p>
          For data signatures (<code>data_signature</code> and{' '}
          <code>schnorr_data_signature</code>), the message to hash and sign is
          provided as a script, e.g.{' '}
          <code>&lt;owner.data_signature.message&gt;</code> will hash the
          compiled bytecode representation of the <code>message</code> isolated
          script, signing the hash using the <code>owner</code> Key.
        </p>
        <h3>Evaluations</h3>
        <p>
          Evaluations are segments of code surrounded by <code>$(</code> and
          <code>)</code> which use the bitcoin virtual machine itself to assist
          in generating bytecode. The contents of an evaluation are compiled and
          evaluated, and the top element on the resulting stack is then inserted
          as bytecode. E.g. <code>$(&lt;1&gt; &lt;2&gt; OP_ADD) "abc"</code>{' '}
          produces the bytecode <code>03616263</code> (disassembled:{' '}
          <code>OP_PUSHBYTES_3 0x616263</code>).
        </p>
        <p>
          This is surprisingly useful – often the procedure to create a desired
          bytecode sequence is similar to the procedure later used to validate
          it. For example, a P2SH locking script is generated using this BTL:
        </p>
        <p>
          <code>
            OP_HASH160 &lt;$(&lt;redeem_script&gt; OP_HASH160)&gt; OP_EQUAL
          </code>
        </p>
        <p>
          First, in the evaluation, the compiled bytecode of{' '}
          <code>redeem_script</code> is pushed to the stack and hashed. Then the
          final locking script can be generated by inserting the bytecode for
          OP_HASH160, followed by a push of the generated redeem script hash,
          followed by the bytecode for OP_EQUAL.
        </p>
        <h3>Built-in Variable Types</h3>
        <p>
          Built-in variables provide access to important data for advanced
          scripts:
        </p>
        <ul>
          <li>
            <code>current_block_height</code>– Provides the current block height
            as a Script Number at the time of compilation. This is useful when
            computing a height for <code>OP_CHECKLOCKTIMEVERIFY</code> or
            <code>OP_CHECKSEQUENCEVERIFY</code> which is relative to the current
            height at the moment a script is created (usually, a locking
            script).
          </li>
          <li>
            <code>current_block_time</code>– Provides the current block time (at
            the time of compilation) as a Script Number. This is useful when
            computing a time for <code>OP_CHECKLOCKTIMEVERIFY</code> or
            <code>OP_CHECKSEQUENCEVERIFY</code> which is relative to the current
            time at the moment a script is created (usually, a locking script).
          </li>
          <li>
            <code>signing_serialization</code>– Provides access to both the full
            contents and individual components of the transaction's signing
            serialization.
          </li>
        </ul>
        <h4>Signing Serialization Operations</h4>
        <p>
          Signing Serialization information is useful for defining
          "covenant"-style scripts which validate properties of the final
          transaction. This is done by duplicating a signature provided in an
          unlocking script, and validating it with both <code>OP_CHECKSIG</code>{' '}
          and <code>OP_CHECKDATASIG</code>, passing the expected signing
          serialization as the message.
        </p>
        <p>
          With the guarantee that a signing serialization is complete and
          correct, it's possible to perform much more complex validation, like
          restricting output amounts and destinations.
        </p>
        <p>
          The following signing serialization operations provide access to
          components of the serialization:
        </p>
        <ul>
          <li>
            <code>signing_serialization.version</code>– The transaction's
            version number.
          </li>
          <li>
            <code>signing_serialization.transaction_outpoints</code>– The
            signing serialization of all transaction outpoints.
          </li>
          <li>
            <code>signing_serialization.transaction_outpoints_hash</code>– The
            hash of all transaction outpoints.
          </li>
          <li>
            <code>signing_serialization.transaction_sequence_numbers</code>– The
            signing serialization of all transaction sequence numbers.
          </li>
          <li>
            <code>signing_serialization.transaction_sequence_numbers_hash</code>
            – The hash of all transaction sequence numbers.
          </li>
          <li>
            <code>signing_serialization.outpoint_transaction_hash</code>– The
            transaction hash (A.K.A. ID) of the outpoint being spent by the
            current input.
          </li>
          <li>
            <code>signing_serialization.outpoint_index</code>– The index of the
            outpoint being spent by the current input.
          </li>
          <li>
            <code>signing_serialization.covered_bytecode_length</code>– The
            prefix indicating the length of
            <code>coveredBytecode</code> provided to the compiler for this
            compilation. The length is encoded as a <code>BitcoinVarInt</code>.
          </li>
          <li>
            <code>signing_serialization.covered_bytecode</code>– The{' '}
            <code>coveredBytecode</code> provided to the compiler for this
            compilation.
          </li>
          <li>
            <code>signing_serialization.output_value</code>– The output value of
            the outpoint being spent by the current input.
          </li>
          <li>
            <code>signing_serialization.sequence_number</code>– The sequence
            number of the outpoint being spent by the current input.
          </li>
          <li>
            <code>signing_serialization.corresponding_output</code>– The signing
            serialization of the transaction output with the same index as the
            current input. If no output with the same index exists, this inserts
            no bytes.
          </li>
          <li>
            <code>signing_serialization.corresponding_output_hash</code>– The
            hash of the transaction output with the same index as the current
            input. If no output with the same index exists, 32 bytes of{' '}
            <code>0x00</code>.
          </li>
          <li>
            <code>signing_serialization.transaction_outputs</code>– The signing
            serialization of all transaction outputs.
          </li>
          <li>
            <code>signing_serialization.transaction_outputs_hash</code>– The
            hash of all transaction outputs.
          </li>
          <li>
            <code>signing_serialization.locktime</code>– The transaction's
            locktime.
          </li>
        </ul>
        <p>
          The following operations provide access to the complete signing
          serialization as generated by each algorithm:
        </p>
        <ul>
          <li>
            <code>signing_serialization.full_all_outputs</code>– The
            concatenation of: <code>version</code>,{' '}
            <code>transaction_outpoints_hash</code>,{' '}
            <code>transaction_sequence_numbers_hash</code>,{' '}
            <code>covered_bytecode_length</code>,<code>covered_bytecode</code>,
            <code>output_value</code>, <code>transaction_outputs_hash</code>,{' '}
            <code>0x41</code> (the byte representing this signing serialization
            type), and <code>0x000000</code> (fork ID).
          </li>
          <li>
            <code>signing_serialization.full_all_outputs_single_input</code>–
            The concatenation of: <code>version</code>, 64 bytes of{' '}
            <code>0x00</code>, <code>covered_bytecode_length</code>,{' '}
            <code>covered_bytecode</code>, <code>output_value</code>,{' '}
            <code>transaction_outputs_hash</code>, <code>0xc1</code> (the byte
            representing this signing serialization type), and{' '}
            <code>0x000000</code> (fork ID).
          </li>
          <li>
            <code>signing_serialization.full_corresponding_output</code>– The
            concatenation of: <code>version</code>,{' '}
            <code>transaction_outpoints_hash</code>, 32 bytes of{' '}
            <code>0x00</code>, <code>covered_bytecode_length</code>,{' '}
            <code>covered_bytecode</code>, <code>output_value</code>,{' '}
            <code>corresponding_output_hash</code> (or if no corresponding
            output exists, 32 bytes of <code>0x00</code>
            ), <code>0x43</code> (the byte representing this signing
            serialization type), and <code>0x000000</code> (fork ID).
          </li>
          <li>
            <code>
              signing_serialization.full_corresponding_output_single_input
            </code>
            – The concatenation of: <code>version</code>, 64 bytes of{' '}
            <code>0x00</code>, <code>covered_bytecode_length</code>,{' '}
            <code>covered_bytecode</code>, <code>output_value</code>,{' '}
            <code>corresponding_output_hash</code> (or if no corresponding
            output exists, 32 bytes of <code>0x00</code>
            ), <code>0xc3</code> (the byte representing this signing
            serialization type), and <code>0x000000</code> (fork ID).
          </li>
          <li>
            <code>signing_serialization.full_no_outputs</code>– The
            concatenation of: <code>version</code>,{' '}
            <code>transaction_outpoints_hash</code>, 32 bytes of{' '}
            <code>0x00</code>, <code>covered_bytecode_length</code>,{' '}
            <code>covered_bytecode</code>, <code>output_value</code>, 32 bytes
            of <code>0x00</code>, <code>0x42</code> (the byte representing this
            signing serialization type), and <code>0x000000</code> (fork ID).
          </li>
          <li>
            <code>signing_serialization.full_no_outputs_single_input</code>– The
            concatenation of: <code>version</code>, 64 bytes of{' '}
            <code>0x00</code>, <code>covered_bytecode_length</code>,{' '}
            <code>covered_bytecode</code>, <code>output_value</code>, 32 bytes
            of <code>0x00</code>, <code>0xc2</code> (the byte representing this
            signing serialization type), and <code>0x000000</code> (fork ID).
          </li>
        </ul>
        <h2>Developing Scenarios</h2>
        <p>
          Scenarios provide control over the "test transaction" used internally
          by Bitauth IDE to produce the live evaluation trace. Because the IDE
          does not currently provide a GUI editor for scenarios, they must be
          added or modified in the JSON template source using the template
          import/export feature.
        </p>
        <p>
          To add a new scenario, add a <code>scenarios</code> property to the
          JSON template using the import/export dialog. Much like the{' '}
          <code>scripts</code> property, the <code>scenarios</code> property
          maps scenario IDs to scenario objects, e.g.{' '}
          <code>{`"scenarios": {"my_scenario": {"name": "My Scenario", "transaction": {"locktime": 100} }},`}</code>
          . Hover over each property to read its built-in documentation. You can
          also use the <code>Command+Space</code> or <code>Ctrl+Space</code>{' '}
          hotkey to activate autocomplete suggestions for available properties.
        </p>
        <p>
          Once you've added some scenarios, you can reference them from
          unlocking scripts and script tests. Add a <code>passes</code> and/or{' '}
          <code>fails</code> array of scenario IDs to each script or test to
          indicate which scenarios should cause them to pass or fail evaluation,
          respectively. See the <code>2-of-2 Recoverable Vault</code> built-in
          template for a full example.
        </p>
        <h2>Getting Started</h2>
        <p>
          The easiest way to get started working with Bitauth IDE is to review
          the example templates. You'll find examples of both common wallet
          types and of complex, multi-entity authentication schemes.
        </p>
        <h3>Thanks for reading!</h3>
        <p>
          This guide is still under development. If you have questions or ideas
          for improvement, please{' '}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/bitauth/bitauth-ide/issues"
          >
            open an issue on GitHub
          </a>
          ,{' '}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://twitter.com/bitjson"
          >
            message me
          </a>
          , or{' '}
          <a
            href="https://t.me/bitauth_ide"
            target="_blank"
            rel="noopener noreferrer"
          >
            join the community chat
          </a>
          .
        </p>
      </div>
    </Dialog>
  );
};
