import { ErrorMapper } from "utils/ErrorMapper";
import { createInitialDomain, Domain, DomainMemory, initializeDomains } from "Domain";

declare global {
  /*
    Example types, expand on these or remove them and add your own.
    Note: Values, properties defined here do no fully *exist* by this type definiton alone.
          You must also give them an implemention if you would like to use them. (ex. actually setting a `role` property in a Creeps memory)

    Types added in this `global` block are in an ambient, global context. This is needed because `main.ts` is a module file (uses import or export).
    Interfaces matching on name from @types/screeps will be merged. This is how you can extend the 'built-in' interfaces from @types/screeps.
  */
  // Memory extension samples
  interface Memory {
    domains: { [name: string]: DomainMemory };
    log: any;
  }

  interface Creep {
    memory: CreepMemory;
  }

  interface CreepMemory {
    role: string;
    domain: string;
  }

  // Syntax for adding proprties to `global` (ex "global.log")
  namespace NodeJS {
    interface Global {
      log: any;
    }
  }
}
// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);

  if (Game.cpu.bucket >= 10_000 * 0.95) Game.cpu.generatePixel();

  if (Memory.domains === undefined) {
    createInitialDomain();
  }

  initializeDomains();

  for (const domainName in Memory.domains) {
    const domain = new Domain(domainName);
    domain.run();
  }
  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
});

(global as any).utilities = {
  test: () => {
    console.log("hello world");
  },
};
