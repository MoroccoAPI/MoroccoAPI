import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { before, describe, it } from "node:test";
import { loadBankingData, validateBankingData } from "../../src/banking/data.js";
import type { BankingManifest, BankingSnapshot } from "../../src/banking/types.js";

let data: BankingSnapshot;
let manifest: BankingManifest;
before(async () => { ({ data, manifest } = await loadBankingData()); });
const copy = <T>(value: T): T => structuredClone(value);

describe("BAM source snapshot", () => {
  it("covers the two supplied workbooks without inferring a join", () => {
    assert.equal(data.institutions.length, 107);
    assert.equal(data.bank_codes.length, 39);
    assert.equal(data.categories.filter(item => item.dataset === "institutions").length, 15);
    assert.equal(data.categories.filter(item => item.dataset === "bank-codes").length, 3);
    for (const category of data.categories) {
      const records = category.dataset === "institutions" ? data.institutions : data.bank_codes;
      assert.equal(category.count, records.filter(item => item.category_code === category.code).length);
    }
    assert.equal(data.bank_codes.find(item => item.code === "040")?.name, "CREDIT POPULAIRE DU MAROC");
    assert.ok(!data.institutions.some(item => item.name === "CREDIT POPULAIRE DU MAROC"));
    assert.ok(data.bank_codes.every(item => !Object.hasOwn(item, "institution_id")));
  });
  it("retains source labels, addresses, leading zeros and worksheet rows", () => {
    assert.deepEqual(data.bank_codes[0], { code: "002", name: "ARAB BANK PLC", category_code: "bank", category_name: "Banque", source_ref: { sheet: "Feuil1", row: 2 } });
    const item = data.institutions.find(record => record.id === "attijariwafa-bank")!;
    assert.equal(item.name, "ATTIJARIWAFA BANK");
    assert.equal(item.head_office_address, "2, Boulevard Moulay Youssef - Casablanca");
    assert.deepEqual(item.source_ref, { sheet: "Annexes 2 ", row: 7 });
    assert.ok(data.bank_codes.every(item => /^[0-9]{3}$/.test(item.code)));
    assert.equal(data.bank_codes.at(-1)?.code, "630");
  });
  it("keeps source dates distinct and carries the actual charter conditions", () => {
    assert.equal(manifest.received_at, "2026-11-04");
    assert.equal(manifest.copied_at, "2026-11-07");
    assert.equal(manifest.sources[0]?.reference_date, null);
    assert.equal(manifest.sources[1]?.reference_date, "2026-11-03");
    assert.equal(manifest.sources[1]?.date_basis, "source-filename");
    assert.equal(manifest.reuse.commercial_use, "written-permission-required");
    assert.equal(manifest.license, "LicenseRef-BAM-Charte-Diffusion");
    assert.match(manifest.attribution, /Bank Al-Maghrib.*2026-11-07/);
    assert.match(manifest.notice, /responsable.*transformations/);
  });
  it("retains source fingerprints and freezes all nested records", async () => {
    assert.equal(manifest.sources[0]?.sha256, "0de72df980a892dbc193a28401e7897da670d6d4adefad1697bd12fd98eddb5d");
    assert.equal(manifest.sources[1]?.sha256, "c2fff4621125932a5a4abdb6da26e649c330c8db79e3648c2da3782567d50ab2");
    assert.ok(Object.isFrozen(data) && Object.isFrozen(manifest));
    assert.ok(Object.isFrozen(data.institutions) && Object.isFrozen(data.bank_codes));
    assert.ok(data.institutions.every(item => Object.isFrozen(item) && Object.isFrozen(item.source_ref)));
    assert.ok(Object.isFrozen(manifest.reuse) && Object.isFrozen(manifest.sources[0]));
    const snapshot = JSON.parse(await readFile(new URL("../../data/banking/snapshot.json", import.meta.url), "utf8"));
    assert.deepEqual(snapshot, data);
  });
  it("bundles only the public JSON snapshot and manifest", async () => {
    const entries = await readdir(new URL("../../data/banking/", import.meta.url), { recursive: true, withFileTypes: true });
    assert.deepEqual(entries.filter(entry => entry.isFile()).map(entry => entry.name).sort(), ["manifest.json", "snapshot.json"]);
    assert.ok(manifest.sources.every(source => !Object.hasOwn(source, "file")));
  });
  it("rejects missing addresses, duplicate identifiers and lost leading zeros", () => {
    const address = copy(data); address.institutions[0]!.head_office_address = " ";
    assert.throws(() => validateBankingData(address, manifest), /identifier or address/);
    const duplicate = copy(data); duplicate.bank_codes[1]!.code = duplicate.bank_codes[0]!.code;
    assert.throws(() => validateBankingData(duplicate, manifest), /Duplicate BAM identifier/);
    const code = copy(data); code.bank_codes[0]!.code = "2";
    assert.throws(() => validateBankingData(code, manifest), /identifier or address/);
  });
  it("rejects category drift, changed totals and broken row references", () => {
    const category = copy(data); category.institutions[0]!.category_code = "unknown";
    assert.throws(() => validateBankingData(category, manifest), /Unmapped BAM category/);
    const count = copy(data); count.categories[0]!.count++;
    assert.throws(() => validateBankingData(count, manifest), /category count mismatch/);
    const row = copy(data); row.institutions[1]!.source_ref.row = 1;
    assert.throws(() => validateBankingData(row, manifest), /Invalid BAM record/);
    const length = { ...data, bank_codes: data.bank_codes.slice(1) };
    assert.throws(() => validateBankingData(length, manifest), /record count mismatch/);
  });
  it("rejects invented dates, replacement licenses and extra source metadata", () => {
    const date = copy(manifest); date.sources[0]!.reference_date = "2025-12-31";
    assert.throws(() => validateBankingData(data, date), /source reference/);
    assert.throws(() => validateBankingData(data, { ...manifest, license: "ODbL-1.0" }), /source manifest/);
    assert.throws(() => validateBankingData(data, { ...manifest, copied_at: "2026-02-30" }), /source manifest/);
    for (const key of ["file", "creator", "lastModifiedBy"]) {
      const metadata = { ...manifest, sources: manifest.sources.map((source, index) => index === 0 ? { ...source, [key]: "unexpected metadata" } : source) };
      assert.throws(() => validateBankingData(data, metadata), /source reference/);
    }
  });
});
