import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadTelecom, validateTelecomData } from "../../src/telecom/data/prefixes.js";
import { buildDatasetMeta } from "../../src/telecom/metadata.js";

describe("telecom/data", () => {
  it("loads immutable snapshots with valid range-to-area relationships", async () => {
    const data = await loadTelecom();
    assert.equal(data.ranges.length, 156);
    assert.equal(data.areas.length, 77);
    assert.ok(Object.isFrozen(data));
    assert.ok(Object.isFrozen(data.ranges));
    for (const range of data.ranges) {
      assert.ok(Object.isFrozen(range));
      assert.ok(Object.isFrozen(range.more_specific_prefixes));
      if (range.original_operator) assert.ok(Object.isFrozen(range.original_operator));
    }
    for (const area of data.areas) {
      assert.ok(Object.isFrozen(area.description));
      assert.ok(Object.isFrozen(area.areas.fr));
      assert.ok(Object.isFrozen(area.areas.en));
    }
  });

  it("uses the same metadata envelope as the existing domains", async () => {
    const data = await loadTelecom();
    const meta = buildDatasetMeta("numbering-ranges", data.ranges.length);
    assert.deepEqual(Object.keys(meta).sort(), ["dataset", "license", "retrieved_at", "sources", "total", "transformation_version"]);
    assert.equal(meta.total, 156);
    assert.equal(meta.license, "Apache-2.0");
    for (const source of meta.sources) {
      assert.deepEqual(Object.keys(source).sort(), ["dataset", "license", "producer", "resource_url", "source_updated_at", "source_url"]);
      assert.equal(source.source_updated_at, null);
    }
  });

  it("rejects duplicate prefixes, missing areas, incorrect masks and broken overrides", async () => {
    const source = await loadTelecom();
    const copy = () => JSON.parse(JSON.stringify(source));
    const duplicate = copy();
    duplicate.ranges[0] = duplicate.ranges[1];
    assert.throws(() => validateTelecomData(duplicate.ranges, duplicate.areas), /unique/);
    const missing = copy();
    missing.areas[0].code = "0519";
    missing.areas[0].international_prefix = "+212519";
    assert.throws(() => validateTelecomData(missing.ranges, missing.areas), /Unknown telecom area/);
    const mask = copy();
    mask.ranges[0].mask = "051XXXXXX";
    assert.throws(() => validateTelecomData(mask.ranges, mask.areas), /prefix mapping/);
    const override = copy();
    override.ranges.find((row: { prefix: string }) => row.prefix === "061").more_specific_prefixes = [];
    assert.throws(() => validateTelecomData(override.ranges, override.areas), /prefix overrides/);
    const language = copy();
    language.areas[0].description.fr = "";
    assert.throws(() => validateTelecomData(language.ranges, language.areas), /geographic descriptions/);
  });
});
