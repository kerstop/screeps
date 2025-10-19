import { Domain } from "Domain";

export function getDomain(object: Creep): Domain {
  return Game.Domains[object.memory.domain];
}
