/**
 * Probe: count the purchasable relationship types and the per-realm distribution straight from
 * the fixture, so the PR body quotes a measured number and its source rather than the spec's prose.
 *
 *   node docs/qa-templates-redesign/count-probe.mjs
 *
 * Uses the same `@/` resolve hook `pnpm data:check` and the `db:*` scripts use
 * (`scripts/ts-modules.mjs`), so it reads the real module and not a copy of the data.
 */
import { register } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const hook = resolve(here, "../../scripts/ts-modules.mjs");

register(pathToFileURL(hook).href, import.meta.url);

const { purchasableRelationshipTypes, relationshipTypes, REALMS } = await import(
  "@/data/relationship-types"
);

const perRealm = Object.fromEntries(REALMS.map((realm) => [realm, 0]));
for (const type of purchasableRelationshipTypes) {
  perRealm[type.realm] = (perRealm[type.realm] ?? 0) + 1;
}

console.log(
  JSON.stringify(
    {
      source: "data/relationship-types.ts",
      all: relationshipTypes.length,
      purchasable: purchasableRelationshipTypes.length,
      notPurchasable: relationshipTypes.length - purchasableRelationshipTypes.length,
      realms: REALMS.length,
      perRealm,
    },
    null,
    2,
  ),
);
