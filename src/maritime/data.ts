import { readFile } from "node:fs/promises";
import type { Lighthouse, Port } from "./types.js";

const portsUrl = new URL("../../data/maritime/ports.json", import.meta.url);
const lighthousesUrl = new URL("../../data/maritime/phares.json", import.meta.url);

export async function loadPorts(): Promise<readonly Port[]> {
  return Object.freeze(JSON.parse(await readFile(portsUrl, "utf8")) as Port[]);
}

export async function loadLighthouses(): Promise<readonly Lighthouse[]> {
  return Object.freeze(JSON.parse(await readFile(lighthousesUrl, "utf8")) as Lighthouse[]);
}
