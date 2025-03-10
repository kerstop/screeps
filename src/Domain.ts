import { QueensGuard } from "QueensGuard";
import extensionLayout from "./Domain/extensionLayout";

declare global {
  interface SpawnMemory {
    domain: string;
  }
}

export interface DomainMemory {
  rooms: string[];
  spawnIds: Id<StructureSpawn>[];
  creeps: string[];

  level: number;
  status: "feedingController" | "upgrading";
}

export class Domain {
  name: string;
  memory: DomainMemory;
  mainSpawn: StructureSpawn;

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
  }

  public static createInitialDomain() {
    const spawn = Object.values(Game.spawns)[0];

    spawn.memory.domain = spawn.room.name;

    Memory.domains[spawn.room.name] = {
      rooms: [spawn.room.name],
      spawnIds: [spawn.id],
      creeps: [],
      level: 1,
      status: "feedingController",
    };
  }

  public run() {
    if (this.memory.level === 1) {
      if (this.memory.creeps.length < 5) {
        const name = `queensGuard_${Game.time}`;
        let r = this.mainSpawn.spawnCreep([WORK, CARRY, MOVE], name, {
          memory: { role: "queensGuard", domain: this.name, isInitialized: false },
        });
        if (r === OK) {
          this.memory.creeps.push(name);
        }
      }

      this.memory.creeps.forEach(name => {
        const creep = Game.creeps[name];
        switch (creep.memory.role) {
          case "queensGuard":
            new QueensGuard(creep.id, this).run();
            break;
        }
      });
    } else if (this.memory.level === 2 && this.memory.status === "upgrading") {
    }
  }
}
