import * as QueensGuard from "QueensGuard";
import { DeliverJob, Job, UpgradeJob } from "Domain/Job";
import { Reservation, StructureWithStore } from "Domain/Reservation";

declare global {
  interface SpawnMemory {
    domain: string;
  }

  interface Game {
    Domains: { [name: string]: Domain };
  }
}

export function initializeDomains() {
  if (Game.Domains === undefined) {
    Game.Domains = {};

    for (const domainName in Memory.domains) {
      Game.Domains[domainName] = new Domain(domainName);
    }
  }
}

export function createInitialDomain() {
  const spawn = Object.values(Game.spawns)[0];

  spawn.memory.domain = spawn.room.name;

  Memory.domains = {};

  Memory.domains[spawn.room.name] = {
    rooms: [spawn.room.name],
    spawnIds: [spawn.id],
    creeps: [],
    level: 1,
    status: "feedingController",
    reservations: [],
  };
}

interface CreepBehaviorModule {
  roleName: string;
  getInitialMemory(domain: string): CreepMemory;
  run(creep: Creep): void;
}

export interface DomainMemory {
  rooms: string[];
  spawnIds: Id<StructureSpawn>[];
  creeps: string[];

  reservations: Reservation[];

  level: number;
  status: "feedingController" | "upgrading";
}

export class Domain {
  name: string;
  memory: DomainMemory;
  mainSpawn: StructureSpawn;

  jobList: Job[];

  constructor(name: string) {
    if (!Memory.domains[name]) {
      throw new Error(`domain '${name}' was not recognized`);
    }
    this.name = name;

    this.memory = Memory.domains[name];

    let mainSpawn = Game.getObjectById(this.memory.spawnIds[0]);
    while (mainSpawn === null) {
      if (this.memory.spawnIds.length === 0) {
        throw new Error(`domain '${name}' has run out of spawners`);
      }
      this.memory.spawnIds = this.memory.spawnIds.slice(1);
    }
    this.mainSpawn = mainSpawn;

    this.memory.creeps = this.memory.creeps.filter(name => name in Game.creeps);
    this.jobList = this.generateJobList();
  }

  generateJobList(): Job[] {
    const jobs: Job[] = [];
    let controllerId = this.mainSpawn.room.controller?.id;
    if (controllerId !== undefined) {
      const upgradeJob: UpgradeJob = { type: "upgrade", targetId: controllerId };
      jobs.push(upgradeJob);
    }

    let deliveryTargets = this.mainSpawn.room.find(FIND_MY_STRUCTURES);
    deliveryTargets.forEach(structure => {
      if (structure.structureType === "extension") {
        const remaining_capacity = structure.store.getFreeCapacity("energy");
        if (remaining_capacity > 0) {
          const job: DeliverJob = {
            type: "deliver",
            resource: "energy",
            amount: remaining_capacity,
            targetId: structure.id,
          };
          jobs.push(job);
        }
      } else if (structure.structureType === "spawn") {
        const capacity = structure.store.getFreeCapacity("energy");
        if (capacity > 0) {
          const job: DeliverJob = {
            type: "deliver",
            resource: "energy",
            amount: capacity,
            targetId: structure.id,
          };
          jobs.push(job);
        }
      }
    });

    return jobs;
  }

  public run() {
    if (this.memory.level === 1) {
      if (this.memory.creeps.length < 5) {
        const name = `${QueensGuard.roleName}_${Game.time}`;
        let r = this.mainSpawn.spawnCreep([WORK, CARRY, MOVE], name, {
          memory: QueensGuard.getInitialMemory(this.name),
        });
        if (r === OK) {
          this.memory.creeps.push(name);
        }
      }
      let modules: CreepBehaviorModule[] = [QueensGuard];

      this.memory.creeps.forEach(name => {
        const creep = Game.creeps[name];
        modules.forEach(module => {
          if (module.roleName === creep.memory.role) {
            module.run(creep);
          }
        });
      });
    } else if (this.memory.level === 2 && this.memory.status === "upgrading") {
    }
  }
}
