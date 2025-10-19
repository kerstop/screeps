import { getDomain } from "utils";

export const roleName = "QueensGuard";

interface QueensGuardMemory extends CreepMemory {
  targetId: Id<StructureExtension> | Id<StructureSpawn> | Id<StructureController> | Id<ConstructionSite> | null;
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
  let source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
  if (source !== null) {
    creep.memory.sourceId = source.id;
  }
  return source;
}

function setDeliveryTarget(
  creep: QueensGuard
): StructureSpawn | StructureExtension | StructureController | ConstructionSite | null {
  const domain = getDomain(creep);

  for (const structure of creep.room.find(FIND_MY_STRUCTURES)) {
    if (!(structure instanceof StructureExtension)) continue;
    const freeCapacity = domain.getFreeCapacity(structure, "energy");
    if (freeCapacity > 0) {
      domain.createReservation(creep, structure, "energy", Math.max(creep.store.energy, freeCapacity));
      creep.memory.targetId = structure.id;
      return structure;
    }
  }

  const mainSpawn = domain.mainSpawn;
  const mainSpawnFreeCapacity = domain.getFreeCapacity(mainSpawn, "energy");
  if (mainSpawnFreeCapacity > 0) {
    domain.createReservation(creep, mainSpawn, "energy", Math.max(creep.store.energy, mainSpawnFreeCapacity));
    creep.memory.targetId = mainSpawn.id;
    return mainSpawn;
  }

  const controller = domain.controller;
  if (controller.ticksToDowngrade < 2500) {
    creep.memory.targetId = controller.id;
    return controller;
  }

  const construction_sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
  if (construction_sites.length > 0) {
    creep.memory.targetId = construction_sites[0].id;
    return construction_sites[0];
  }

  creep.memory.targetId = controller.id;
  return controller;
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
      switch (creep.moveTo(source)) {
        case ERR_NO_PATH:
          setSource(creep);
          break;
      }
    } else if (r === ERR_NOT_ENOUGH_RESOURCES) {
      creep.memory.sourceId = null;
    }
  } else if (creep.memory.workState === "delivering") {
    const target = (creep.memory.targetId && Game.getObjectById(creep.memory.targetId)) ?? setDeliveryTarget(creep);
    if (target === null) return;
    if (creep.fatigue > 0) return;
    if (target.structureType === "controller") {
      switch (creep.upgradeController(target)) {
        case ERR_NOT_IN_RANGE:
          creep.moveTo(target);
          break;
      }
    } else if (target instanceof ConstructionSite) {
      switch (creep.build(target as ConstructionSite)) {
        case ERR_NOT_IN_RANGE:
          creep.moveTo(target);
          break;
      }
    } else if (target.structureType === "extension" || target.structureType === "spawn") {
      switch (creep.transfer(target, "energy")) {
        case OK:
          getDomain(creep).removeReservation(creep, target.id, "energy");
          break;
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
