import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { loadRegions } from "../../src/geography/data/regions.js";
import { loadGeography } from "../../src/geography/data/subdivisions.js";
import type { GeographySnapshot } from "../../src/geography/types.js";
import { loadCommunePopulation } from "../../src/population/data/communes.js";
import { loadRegionPopulation } from "../../src/population/data/regions.js";
import { loadSubdivisionPopulation } from "../../src/population/data/subdivisions.js";

let geography: GeographySnapshot;

before(async () => {
  const regions = await loadRegions();
  geography = Object.freeze({ regions, ...await loadGeography(regions) });
});

describe("population/data", () => {
  it("joins population to the supplied geography without changing the snapshot", async () => {
    const original = structuredClone(geography);
    const [regions, provinces, communes] = await Promise.all([
      loadRegionPopulation(geography.regions),
      loadSubdivisionPopulation(geography),
      loadCommunePopulation(geography),
    ]);

    for (const [records, parents] of [
      [regions, geography.regions],
      [provinces, geography.provinces],
      [communes, geography.communes],
    ] as const) {
      assert.ok(Object.isFrozen(records));
      assert.deepEqual(records.map((record) => record.hcp_code), parents.map((parent) => parent.hcp_code));
      for (const record of records) {
        assert.ok(Object.isFrozen(record));
        assert.ok(Object.isFrozen(record.name));
        assert.equal(record.moroccans + record.foreigners, record.population);
      }
    }
    assert.deepEqual(geography, original);
  });

  it("rejects regional population when the supplied HCP identity differs", async () => {
    const regions = geography.regions.map((region, index) =>
      index === 0 ? { ...region, hcp_code: "99" } : region,
    );
    await assert.rejects(loadRegionPopulation(regions), /does not match a known region code and HCP code/);
  });

  it("rejects subdivision population when the supplied region differs", async () => {
    const provinces = geography.provinces.map((province, index) =>
      index === 0 ? { ...province, region_code: "unknown-region" } : province,
    );
    await assert.rejects(loadSubdivisionPopulation({ ...geography, provinces }), /does not match a known HCP unit/);
  });

  it("rejects commune population when the supplied province differs", async () => {
    const communes = geography.communes.map((commune, index) =>
      index === 0 ? { ...commune, province_code: "unknown-province" } : commune,
    );
    await assert.rejects(loadCommunePopulation({ ...geography, communes }), /does not match a known HCP commune/);
  });
});
