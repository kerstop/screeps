import * as QueensGuard from "QueensGuard";
import { DeliverJob, Job, UpgradeJob } from "Domain/Job";

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
    reservations: {},
  };
}

interface CreepBehaviorModule {
  roleName: string;
  getInitialMemory(domain: string): CreepMemory;
  run(creep: Creep): void;
}

interface Reservation {
  target: Id<AnyStoreStructure>;
  resource: ResourceConstant;
  creep: Id<Creep>;
  amount: number;
}

export interface DomainMemory {
  rooms: string[];
  spawnIds: Id<StructureSpawn>[];
  creeps: string[];

  reservations: { [id: Id<AnyStoreStructure>]: Reservation[] | undefined };

  level: number;
  status: "feedingController" | "upgrading";
}

export class Domain {
  name: string;
  memory: DomainMemory;
  mainSpawn: StructureSpawn;
  controller: StructureController;

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
    this.controller = mainSpawn.room.controller as StructureController;

    this.memory.creeps = this.memory.creeps.filter(name => name in Game.creeps);
    this.jobList = this.generateJobList();
  }

  public getFreeCapacity(structure: AnyStoreStructure, resource: ResourceConstant): number {
    const total_reservation = this.memory.reservations[structure.id]?.reduce((r1, r2) => {
      if (r2.resource === resource) r1 += r2.amount;
      return r1;
    }, 0);
    if (total_reservation === undefined) {
      return structure.store.getFreeCapacity(resource) ?? 0;
    }

    const capacity = structure.store.getCapacity(resource);
    if (capacity === null) return 0;
    return capacity - structure.store[resource] - total_reservation;
  }

  public getResouce(structure: AnyStoreStructure, resource: ResourceConstant): number {
    const total_reservation =
      this.memory.reservations[structure.id]?.reduce((r1, r2) => {
        if (r2.resource === resource) r1 += r2.amount;
        return r1;
      }, 0) ?? 0;

    return structure.store[resource] + total_reservation;
  }

  public createReservation(creep: Creep, structure: AnyStoreStructure, resource: ResourceConstant, amount: number) {
    let reservations = this.memory.reservations[structure.id];
    if (reservations === undefined) reservations = [];
    reservations.push({
      creep: creep.id,
      target: structure.id,
      resource: resource,
      amount: amount,
    });
    this.memory.reservations[structure.id] = reservations;
  }

  public removeReservation(creep: Creep, structure: Id<AnyStoreStructure>, resource: ResourceConstant) {
    this.memory.reservations[structure] = this.memory.reservations[structure]?.filter(
      reservation => !(reservation.creep === creep.id && reservation.resource === resource)
    );
    if (this.memory.reservations[structure]?.length === 0) this.memory.reservations[structure] = undefined;
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
        let r = this.mainSpawn.spawnCreep([WORK, CARRY, CARRY, MOVE, MOVE], name, {
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
