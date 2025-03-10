import { Domain } from "Domain";
import { SpecializedCreep } from "SpecializedCreep";

interface QueensGuardMemory extends CreepMemory {
  targetId: Id<StructureExtension> | Id<StructureSpawn> | Id<StructureController> | null;
  workState: "gathering" | "delivering";
  sourceId: Id<Source> | null;
}

export class QueensGuard extends SpecializedCreep {
  memory: QueensGuardMemory;
  constructor(id: Id<Creep>, domain: Domain) {
    super(id, domain);
    this.memory = super.memory as QueensGuardMemory;
    if (this.memory.role !== "queensGuard") {
      throw new Error("this is the wrong type for this unit");
    }

    if (!this.memory.isInitialized) {
      this.memory.workState = "gathering";
      this.memory.sourceId = null;
      this.memory.targetId = null;

      this.memory.isInitialized = true;
    }
  }

  setSource(): Source | null {
    let source = this.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
    if (source !== null) {
      this.memory.sourceId = source.id;
    }
    return source;
  }

  setDeliveryTarget(): StructureSpawn | StructureExtension | StructureController | null {
    let extension = this.pos.findClosestByRange(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === "extension" && s.store.getFreeCapacity("energy") > 0
    });
    if (extension !== null) {
      this.memory.targetId = (extension as StructureExtension).id;
      return extension as StructureExtension;
    }

    if (this.domain.mainSpawn.store.getFreeCapacity("energy") > 0) {
      this.memory.targetId = this.domain.mainSpawn.id;
      return this.domain.mainSpawn;
    }

    let controller = this.room.controller;
    if (controller !== undefined) {
      this.memory.targetId = controller.id;
      return controller;
    }

    return null;
  }

  run() {
    if (this.store.energy === 0) {
      this.memory.workState = "gathering";
    } else if (0 === this.store.getFreeCapacity("energy")) {
      this.memory.workState = "delivering";
    }
    if (this.memory.workState === "gathering") {
      const source = (this.memory.sourceId && Game.getObjectById(this.memory.sourceId)) ?? this.setSource();
      if (source === null) return;

      let r = this.harvest(source);
      if (r === ERR_NOT_IN_RANGE) {
        this.moveTo(source);
      } else if (r === ERR_NOT_ENOUGH_RESOURCES) {
        this.memory.sourceId = null;
      }
    } else if (this.memory.workState === "delivering") {
      const target = (this.memory.targetId && Game.getObjectById(this.memory.targetId)) ?? this.setDeliveryTarget();
      if (target === null) return;
      if (target.structureType === "controller") {
        switch (this.upgradeController(target)) {
          case ERR_NOT_IN_RANGE:
            this.moveTo(target);
            break;
        }
      } else if (target.structureType === "extension" || target.structureType === "spawn") {
        switch (this.transfer(target, "energy")) {
          case ERR_NOT_IN_RANGE:
            this.moveTo(target);
            break;
          case ERR_FULL:
            this.setDeliveryTarget();
            break;
        }
      }
    }
  }
}
