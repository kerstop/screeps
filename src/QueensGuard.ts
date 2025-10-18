import { Domain } from "Domain";

export const roleName = "QueensGuard";

interface QueensGuardMemory extends CreepMemory {
  targetId: Id<StructureExtension> | Id<StructureSpawn> | Id<StructureController> | null;
  workState: "gathering" | "delivering";
  sourceId: Id<Source> | null;
}

interface QueensGuard extends Creep {
  memory: QueensGuardMemory;
}

export function getInitialMemory(domain: string): QueensGuardMemory {
  return {
    role: roleName,
    domain: domain,
    targetId: null,
    workState: "gathering",
    sourceId: null,
  };
}

function setSource(creep: QueensGuard): Source | null {
  let source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
  if (source !== null) {
    creep.memory.sourceId = source.id;
  }
  return source;
}

function setDeliveryTarget(creep: QueensGuard): StructureSpawn | StructureExtension | StructureController | null {
  let extension = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === "extension" && s.store.getFreeCapacity("energy") > 0,
  });
  if (extension !== null) {
    creep.memory.targetId = (extension as StructureExtension).id;
    return extension as StructureExtension;
  }

  const mainSpawn = Game.Domains[creep.memory.domain].mainSpawn;
  if (mainSpawn.store.getFreeCapacity("energy") > 0) {
    creep.memory.targetId = mainSpawn.id;
    return mainSpawn;
  }

  let controller = creep.room.controller;
  if (controller !== undefined) {
    creep.memory.targetId = controller.id;
    return controller;
  }

  return null;
}

export function run(creep: QueensGuard) {
  if (creep.store.energy === 0) {
    creep.memory.workState = "gathering";
  } else if (0 === creep.store.getFreeCapacity("energy")) {
    creep.memory.workState = "delivering";
  }
  if (creep.memory.workState === "gathering") {
    const source = (creep.memory.sourceId && Game.getObjectById(creep.memory.sourceId)) ?? setSource(creep);
    if (source === null) return;

    let r = creep.harvest(source);
    if (r === ERR_NOT_IN_RANGE) {
      creep.moveTo(source);
    } else if (r === ERR_NOT_ENOUGH_RESOURCES) {
      creep.memory.sourceId = null;
    }
  } else if (creep.memory.workState === "delivering") {
    const target = (creep.memory.targetId && Game.getObjectById(creep.memory.targetId)) ?? setDeliveryTarget(creep);
    if (target === null) return;
    if (target.structureType === "controller") {
      switch (creep.upgradeController(target)) {
        case ERR_NOT_IN_RANGE:
          creep.moveTo(target);
          break;
      }
    } else if (target.structureType === "extension" || target.structureType === "spawn") {
      switch (creep.transfer(target, "energy")) {
        case ERR_NOT_IN_RANGE:
          creep.moveTo(target);
          break;
        case ERR_FULL:
          setDeliveryTarget(creep);
          break;
      }
    }
  }
}
