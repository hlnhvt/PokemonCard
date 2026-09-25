// Chance that a scan reveals the shiny (alternate colour) version. The games use
// about 1/4096; this app is for children, so shinies are rare but reachable.
export const SHINY_CHANCE = 1 / 8;

export function rollShiny(random = Math.random) {
  return random() < SHINY_CHANCE;
}
