import type { BankingManifest } from "./types.js";

export function buildBankingMeta(total: number, manifest: BankingManifest) {
  const { snapshot_sha256: _checksum, ...metadata } = manifest;
  return { ...metadata, total };
}
