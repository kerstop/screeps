import { Domain } from "Domain";

type Role = "queensGuard" | "worker";

declare global {
  interface CreepMemory {
    role: Role;
    domain: string;
    isInitialized: boolean;
  }
}

export class SpecializedCreep extends Creep {
  readonly domain: Domain;

  constructor(id: Id<Creep>, domain: Domain) {
    super(id);
    let creep = Game.getObjectById(id);
    if (creep === null) {
      throw new Error(`Creep ${id} was not found`);
    }
    this.domain = domain;
  }
}
