/// <reference lib="webworker" />
import {
  DebugDetails,
  IDESupportedProgramState,
  IDESupportedVM,
} from '../state/types';

import { IDESupportedAuthenticationProgram } from './editor-types';

import {
  createCompiler,
  createVirtualMachineBch2023,
  createVirtualMachineBch2025,
  createVirtualMachineBch2026,
  createVirtualMachineBchSpec,
  ScenarioGenerationDebuggingResult,
  stringify,
} from '@bitauth/libauth';

export type DebugWorkerJob = {
  compilerConfiguration: unknown;
  lockingScriptId?: string;
  unlockingScriptId?: string;
  scenarioId?: string;
  vmId: IDESupportedVM;
  compilationId: number;
};

export type DebugWorkerResult = {
  compilationId: number;
  result: DebugDetails['result'];
};

const debugCache = new Map<
  string,
  { debugTrace: IDESupportedProgramState[]; verifyResult: string | true }
>();
const scenarioCache = new Map<
  string,
  string | ScenarioGenerationDebuggingResult<IDESupportedProgramState>
>();
const debugKey = (
  vmId: IDESupportedVM,
  program: IDESupportedAuthenticationProgram,
) => `${vmId}:${stringify(program, 0)}`;
const scenarioKey = (
  configuration: unknown,
  lockingScriptId: string | undefined,
  unlockingScriptId: string | undefined,
  scenarioId: string | undefined,
) =>
  `${lockingScriptId ?? ''}:${unlockingScriptId ?? ''}:${scenarioId ?? ''}:${stringify(configuration, 0)}`;

self.onmessage = (event: MessageEvent<DebugWorkerJob>) => {
  const {
    compilerConfiguration,
    lockingScriptId,
    unlockingScriptId,
    scenarioId,
    vmId,
    compilationId,
  } = event.data;

  const sKey = scenarioKey(
    compilerConfiguration,
    lockingScriptId,
    unlockingScriptId,
    scenarioId,
  );
  let scenarioGeneration = scenarioCache.get(sKey);
  if (scenarioGeneration === undefined) {
    const compiler = createCompiler(
      compilerConfiguration as ReturnType<
        typeof createCompiler
      >['configuration'],
    );
    scenarioGeneration = compiler.generateScenario({
      debug: true,
      lockingScriptId,
      unlockingScriptId,
      scenarioId,
    }) as string | ScenarioGenerationDebuggingResult<IDESupportedProgramState>;
    scenarioCache.set(sKey, scenarioGeneration);
    if (scenarioCache.size > 20) {
      const first = scenarioCache.keys().next().value as string;
      scenarioCache.delete(first);
    }
  }

  const program =
    typeof scenarioGeneration !== 'string' &&
    typeof scenarioGeneration.scenario !== 'string'
      ? scenarioGeneration.scenario.program
      : undefined;

  let debugTrace: IDESupportedProgramState[] | undefined;
  let verifyResult: string | true | undefined;
  if (program !== undefined) {
    const dKey = debugKey(vmId, program);
    const cached = debugCache.get(dKey);
    if (cached !== undefined) {
      ({ debugTrace, verifyResult } = cached);
    } else {
      const vm =
        vmId === 'BCH_2023_05'
          ? createVirtualMachineBch2023()
          : vmId === 'BCH_2025_05'
            ? createVirtualMachineBch2025()
            : vmId === 'BCH_2026_05'
              ? createVirtualMachineBch2026()
              : createVirtualMachineBchSpec();
      debugTrace = vm.debug(program) as IDESupportedProgramState[];
      verifyResult = vm.verify(program);
      debugCache.set(dKey, { debugTrace, verifyResult });
      if (debugCache.size > 20) {
        const first = debugCache.keys().next().value as string;
        debugCache.delete(first);
      }
    }
  }
  const workResult: DebugWorkerResult = {
    compilationId,
    result: {
      debugTrace: debugTrace!,
      scenarioGeneration,
      verifyResult: verifyResult!,
    },
  };
  self.postMessage(workResult);
};
