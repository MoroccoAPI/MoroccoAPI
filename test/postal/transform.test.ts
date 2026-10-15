import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, describe, it } from "node:test";

import { loadRegions } from "../../src/geography/data/regions.js";
import { loadGeography } from "../../src/geography/data/subdivisions.js";
import type { GeographySnapshot } from "../../src/geography/types.js";
import { assertPostalMappings } from "../../src/postal/data/postal-codes.js";
import {
  assertPostalSource, buildPostalSnapshot, clean, slug,
  type PostalMappings, type PostalSnapshot, type PostalSource,
} from "../../src/postal/data/transform.js";

let geography: GeographySnapshot;
let source: PostalSource;
let mappings: PostalMappings;
let snapshot: PostalSnapshot;

const read = async (name: string) =>
  JSON.parse(await readFile(new URL(`../../data/postal/${name}`, import.meta.url), "utf8"));
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const build = (rows: PostalSource = source, map: PostalMappings = mappings) => buildPostalSnapshot(rows, map, geography);

before(async () => {
  const regions = await loadRegions();
  geography = Object.freeze({ regions, ...await loadGeography(regions) });
  const raw = {
    localities: await read("source/localities.json"),
    cities: await read("source/multi-code-cities.json"),
    neighborhoods: await read("source/neighborhoods.json"),
  };
  assertPostalSource(raw);
  source = raw;
  const rawMappings: unknown = await read("mappings.json");
  assertPostalMappings(rawMappings);
  mappings = rawMappings;
  snapshot = build();
});

describe("postal/source", () => {
  it("keeps the Poste Maroc rows verbatim, including their whitespace", () => {
    assert.equal(source.localities.length, 1770);
    assert.equal(source.cities.length, 34);
    assert.equal(source.neighborhoods.length, 10026);
    const provinces = new Set(source.localities.map((row) => row.PROVINCE));
    for (const raw of ["FES ", "BOUARFA FIGUIG ", "TAOURIRT ", "OUJDA  ANGAD", "EL KELÂA DES  SRAGHNA"]) {
      assert.ok(provinces.has(raw), JSON.stringify(raw));
    }
    assert.ok(source.neighborhoods.some((row) => row.QUARTIER === "QUARTIER DIYAR "));
    assert.ok(source.localities.every((row) => Number.isInteger(row["NOUVEAU CODE POSTAL"])));
  });

  it("derives a cleaned display value and a slug matching key without changing spelling", () => {
    assert.equal(clean("OUJDA  ANGAD"), "OUJDA ANGAD");
    assert.equal(slug("OUJDA  ANGAD"), "oujda-angad");
    assert.equal(clean("BOUARFA FIGUIG "), "BOUARFA FIGUIG");
    assert.equal(clean("QUARTIER MOHA%%ASI EX BOUCHRAIT"), "QUARTIER MOHA%%ASI EX BOUCHRAIT");
    assert.equal(slug("EL KELÂA DES  SRAGHNA"), "el-kelaa-des-sraghna");
    assert.equal(slug("M'DIQ-FNIDEQ"), "m-diq-fnideq");
    assert.equal(slug("L'ORIENTAL"), "l-oriental");
  });

  it("rejects source rows with missing columns, extra columns or invalid codes", () => {
    const missing = copy(source);
    delete (missing.localities[0] as Partial<(typeof missing.localities)[0]>).PROVINCE;
    assert.throws(() => assertPostalSource(missing), /Invalid postal source row in 'localities' at index 0/);
    const extra = copy(source);
    (extra.neighborhoods[0] as unknown as Record<string, unknown>).NOTE = "x";
    assert.throws(() => assertPostalSource(extra), /'neighborhoods' at index 0/);
    const code = copy(source);
    code.neighborhoods[1]!["NOUVEAU CODE POSTAL"] = 1000;
    assert.throws(() => assertPostalSource(code), /'neighborhoods' at index 1/);
    assert.throws(() => assertPostalMappings({ province_aliases: { entries: [] } }), /Invalid postal mapping file/);
  });
});

describe("postal/mappings", () => {
  it("applies every manual province alias to the rows that use that spelling", () => {
    for (const alias of mappings.province_aliases.entries) {
      const rows = source.localities.filter((row) => slug(row.PROVINCE) === slug(alias.source));
      assert.ok(rows.length > 0, alias.source);
      for (const row of rows) {
        const record = snapshot.codes.find((code) => code.postal_code === String(row["NOUVEAU CODE POSTAL"]) && code.type === "locality");
        const correction = mappings.province_corrections.entries.find((entry) => entry.name === clean(row.LOCALITE) &&
          entry.postal_code === String(row["NOUVEAU CODE POSTAL"]));
        assert.equal(record?.province_code, correction?.province_code ?? alias.province_code, `${alias.source} → ${row.LOCALITE}`);
      }
    }
    const kelaa = snapshot.codes.filter((code) => code.name === "SIDI MOUSSA" && code.postal_code === "43036");
    assert.deepEqual(kelaa.map((code) => code.province_code), ["el-kelaa-des-sraghna"]);
  });

  it("corrects only the four reviewed locality province assignments and preserves their source values", () => {
    assert.equal(mappings.province_corrections.entries.length, 4);
    const expected = [
      ["DEROUA OULAD ZIANE", "26202", "SETTAT", "berrechid", "casablanca-settat"],
      ["IGHIL NOUMGOUN", "45156", "OUARZAZATE", "tinghir", "draa-tafilalet"],
      ["IMI NFAST", "81033", "GUELMIM", "sidi-ifni", "guelmim-oued-noun"],
      ["SIDI HSAINE OU ALI", "85572", "TAROUDANT", "sidi-ifni", "guelmim-oued-noun"],
    ];
    for (const [name, postalCode, originalProvince, province, region] of expected) {
      const raw = source.localities.find((row) => clean(row.LOCALITE) === name && String(row["NOUVEAU CODE POSTAL"]) === postalCode);
      assert.equal(raw?.PROVINCE, originalProvince);
      const record = snapshot.codes.find((code) => code.type === "locality" && code.name === name && code.postal_code === postalCode);
      assert.deepEqual(record, {
        postal_code: postalCode, type: "locality", name, city: null,
        province_code: province, region_code: region, commune_code: null,
      });
    }
  });

  it("derives regions from provinces and applies the listed region correction", () => {
    const grand = source.localities.filter((row) => row.REGION_POSTALE === "GRAND CASABLANCA SETTAT");
    assert.equal(grand.length, 3);
    for (const row of grand) {
      const record = snapshot.codes.find((code) => code.postal_code === String(row["NOUVEAU CODE POSTAL"]));
      assert.equal(record?.region_code, "casablanca-settat");
    }
    const jbiyel = snapshot.codes.find((code) => code.name === "JBIYEL");
    assert.equal(jbiyel?.region_code, "draa-tafilalet");
    const rawJbiyel = source.localities.find((row) => row.LOCALITE === "JBIYEL");
    assert.equal(rawJbiyel?.REGION_POSTALE, "FES MEKNES");
  });

  it("removes exact duplicates and the 40 listed misfiled neighbourhoods, nothing more", () => {
    assert.equal(snapshot.duplicatesRemoved, 34);
    assert.equal(mappings.excluded_neighborhoods.entries.length, 40);
    const neighborhoods = snapshot.codes.filter((code) => code.type === "neighborhood");
    assert.equal(neighborhoods.length, 10026 - 34 - 40);
    for (const excluded of mappings.excluded_neighborhoods.entries) {
      assert.ok(source.neighborhoods.some((row) => clean(row.VILLE) === excluded.city && clean(row.QUARTIER) === excluded.name &&
        String(row["NOUVEAU CODE POSTAL"]) === excluded.postal_code), `${excluded.city} ${excluded.name} is in the source`);
      assert.ok(!neighborhoods.some((code) => code.city === excluded.city && code.name === excluded.name &&
        code.postal_code === excluded.postal_code), `${excluded.city} ${excluded.name} is excluded`);
    }
    // The Settat copies are excluded; the same neighbourhoods remain under Berrechid.
    for (const name of ["SIDI ABDELKHALEK", "ZAOUIAT SIDI BEN HAMDOUNE"]) {
      const rows = neighborhoods.filter((code) => code.name === name && code.postal_code === "26450");
      assert.deepEqual(rows.map((code) => [code.city, code.province_code]), [["BERRECHID", "berrechid"]]);
    }
  });

  it("retains the five Berrechid source neighbourhoods now consistent with Deroua's corrected province", () => {
    const city = source.cities.find((row) => row.LOCALITE === "BERRECHID");
    assert.equal(city?.PROVINCE, "BERRECHID");
    const locality = snapshot.codes.find((code) => code.type === "locality" && code.postal_code === "26202");
    assert.equal(locality?.province_code, "berrechid");
    for (const name of ["BSSASLA", "BTIOUA", "JACMA", "KASBAT BEN MCHICH", "LAMBARKIYINE"]) {
      assert.ok(source.neighborhoods.some((row) => row.VILLE === "BERRECHID" && row.QUARTIER === name &&
        row["NOUVEAU CODE POSTAL"] === 26202), name);
      assert.deepEqual(snapshot.codes.find((code) => code.type === "neighborhood" && code.name === name &&
        code.postal_code === "26202"), {
        postal_code: "26202", type: "neighborhood", name, city: "BERRECHID",
        province_code: "berrechid", region_code: "casablanca-settat", commune_code: null,
      });
    }
  });

  it("preserves every code of multi-code places and source spelling errors", () => {
    const boustane = snapshot.codes.filter((code) => code.city === "RABAT" && code.name === "QUARTIER AL BOUSTANE");
    assert.deepEqual(boustane.map((code) => code.postal_code), ["10150", "10210"]);
    const louta = snapshot.codes.filter((code) => code.name === "OULAD YAHYA LOUTA");
    assert.deepEqual(louta.map((code) => code.postal_code), ["13012", "13035"]);
    assert.ok(snapshot.codes.some((code) => code.name === "BLOC G EL MOHA%ADI" && code.city === "LAAYOUNE"));
    assert.ok(snapshot.codes.some((code) => code.name === "QUARTIER DIYAR"));
  });

  it("links communes only by exact name in the same province, with the reviewed city alias", () => {
    assert.equal(snapshot.codes.filter((code) => code.commune_code !== null).length, 938);
    assert.equal(snapshot.codes.find((code) => code.name === "AFOURER")?.commune_code, null);
    assert.equal(snapshot.cities.find((city) => city.name === "ELJADIDA")?.commune_code, "el-jadida--el-jadida");
    assert.ok(snapshot.cities.every((city) => city.commune_code !== null));
  });
});

describe("postal/mapping safety", () => {
  it("fails on an unused mapping entry instead of silently keeping it", () => {
    const stale = copy(mappings);
    stale.province_aliases.entries = [...stale.province_aliases.entries, { source: "ATLANTIS", province_code: "rabat" }];
    assert.throws(() => build(source, stale), /Unused postal mapping entries: province:atlantis/);
    const commune = copy(mappings);
    commune.city_commune_aliases.entries = [...commune.city_commune_aliases.entries, { source: "NOWHERE", commune_code: "rabat--rabat" }];
    assert.throws(() => build(source, commune), /Unused postal mapping entries: commune:nowhere/);
    const province = copy(mappings);
    province.province_corrections.entries = [...province.province_corrections.entries, {
      ...province.province_corrections.entries[0]!, name: "UNREVIEWED NAME",
    }];
    assert.throws(() => build(source, province), /Unused postal mapping entries: province-correction:locality\|UNREVIEWED NAME\|26202/);
  });

  it("fails on an unlisted conflict or region disagreement", () => {
    const unlisted = copy(mappings);
    unlisted.excluded_neighborhoods.entries = unlisted.excluded_neighborhoods.entries.slice(1);
    assert.throws(() => build(source, unlisted), /Unlisted postal neighbourhood conflict 'ERRACHIDIA\|DOUAR DRAOU OLAD BOUCHIHA\|12013'/);
    const region = copy(mappings);
    region.region_corrections.entries = [];
    assert.throws(() => build(source, region), /Unlisted postal region disagreement for 'locality\|JBIYEL\|52476'/);
  });

  it("rejects stale or duplicated province corrections and unknown target provinces", () => {
    const changedProvince = copy(source);
    changedProvince.localities.find((row) => row.LOCALITE === "DEROUA OULAD ZIANE")!.PROVINCE = "BERRECHID";
    assert.throws(() => build(changedProvince), /Postal province correction 'locality\|DEROUA OULAD ZIANE\|26202' does not match/);
    const changedRegion = copy(source);
    changedRegion.localities.find((row) => row.LOCALITE === "SIDI HSAINE OU ALI")!.REGION_POSTALE = "GUELMIM OUED NOUN";
    assert.throws(() => build(changedRegion), /Postal province correction 'locality\|SIDI HSAINE OU ALI\|85572' does not match/);
    const noChange = copy(mappings);
    noChange.province_corrections.entries[1]!.province_code = "ouarzazate";
    assert.throws(() => build(source, noChange), /does not match the source disagreement/);
    const duplicate = copy(mappings);
    duplicate.province_corrections.entries = [...duplicate.province_corrections.entries, duplicate.province_corrections.entries[0]!];
    assert.throws(() => build(source, duplicate), /Duplicate postal province correction/);
    const unknown = copy(mappings);
    unknown.province_corrections.entries[0]!.province_code = "atlantis";
    assert.throws(() => build(source, unknown), /Unknown corrected postal province 'atlantis'/);
  });

  it("rejects malformed province correction keys, guards and evidence", () => {
    for (const [field, value] of [
      ["type", "city"], ["name", ""], ["postal_code", "2620"], ["source_province", ""],
      ["source_region", ""], ["province_code", ""], ["evidence_url", "http://www.hcp.ma/evidence.pdf"],
    ]) {
      const malformed = copy(mappings);
      (malformed.province_corrections.entries[0] as unknown as Record<string, unknown>)[field!] = value;
      assert.throws(() => assertPostalMappings(malformed), /Invalid postal province correction/, field);
    }
  });

  it("scopes province corrections to both the exact cleaned place name and postal code", () => {
    const extended = copy(source);
    const original = extended.localities.find((row) => row.LOCALITE === "SIDI HSAINE OU ALI")!;
    extended.localities.push({ ...original, LOCALITE: "SIDI HSAINE OU ALI ANNEX" });
    extended.localities.push({ ...original, "NOUVEAU CODE POSTAL": 85573 });
    const records = build(extended).codes;
    for (const [name, code] of [["SIDI HSAINE OU ALI ANNEX", "85572"], ["SIDI HSAINE OU ALI", "85573"]]) {
      const unreviewed = records.find((record) => record.name === name && record.postal_code === code);
      assert.deepEqual([unreviewed?.province_code, unreviewed?.region_code], ["taroudannt", "souss-massa"]);
    }
    const mismatch = copy(source);
    mismatch.localities[0]!.REGION_POSTALE = "SOUSS MASSA";
    assert.throws(() => build(mismatch), /Unlisted postal region disagreement/);
  });

  it("rejects a stale Berrechid exclusion after correcting Deroua", () => {
    const stale = copy(mappings);
    stale.excluded_neighborhoods.entries = [...stale.excluded_neighborhoods.entries, {
      city: "BERRECHID", name: "BSSASLA", postal_code: "26202",
      reason: "code_of_locality_in_other_province", code_owner: { locality: "DEROUA OULAD ZIANE", province_code: "settat" },
    }];
    assert.throws(() => build(source, stale), /Postal exclusion 'BERRECHID\|BSSASLA\|26202' does not match a conflicting row/);
  });

  it("fails on an exclusion or correction that no longer matches the source", () => {
    const bogus = copy(mappings);
    bogus.excluded_neighborhoods.entries = [...bogus.excluded_neighborhoods.entries, {
      city: "RABAT", name: "QUARTIER MANSOUR", postal_code: "10000",
      reason: "code_of_locality_in_other_province", code_owner: { locality: "X", province_code: "rabat" },
    }];
    assert.throws(() => build(source, bogus), /Postal exclusion 'RABAT\|QUARTIER MANSOUR\|10000' does not match a conflicting row/);
    const owner = copy(mappings);
    owner.excluded_neighborhoods.entries[0]!.code_owner.province_code = "rabat";
    assert.throws(() => build(source, owner), /names the wrong code owner/);
    const correction = copy(mappings);
    correction.region_corrections.entries[0]!.region_code = "fes-meknes";
    assert.throws(() => build(source, correction), /Unlisted postal region disagreement/);
  });

  it("fails on source values that no mapping covers", () => {
    const province = copy(source);
    province.localities[0]!.PROVINCE = "ATLANTIS";
    assert.throws(() => build(province), /Unmapped postal province 'ATLANTIS'/);
    const region = copy(source);
    region.localities[0]!.REGION_POSTALE = "NORTHERN ATLANTIS";
    assert.throws(() => build(region), /Unmapped postal region label 'NORTHERN ATLANTIS'/);
    const city = copy(source);
    city.neighborhoods[0]!.VILLE = "PARIS";
    assert.throws(() => build(city), /Unknown postal multi-code city 'PARIS'/);
    const conflict = copy(source);
    conflict.neighborhoods.push({ VILLE: "ERRACHIDIA", QUARTIER: "NEW DOUAR", "NOUVEAU CODE POSTAL": 12013 });
    assert.throws(() => build(conflict), /Unlisted postal neighbourhood conflict 'ERRACHIDIA\|NEW DOUAR\|12013'/);
  });
});
