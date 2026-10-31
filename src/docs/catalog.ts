import { examples, groups, parameterHelp, titles, translate, type Language } from "./content.js";

export interface Schema {
  $ref?: string;
  type?: string;
  format?: string;
  nullable?: boolean;
  properties?: Record<string, Schema>;
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  required?: string[];
  enum?: (string | number | boolean | null)[];
  const?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  schema: Schema;
}

interface Operation {
  tags?: string[];
  summary?: string;
  parameters?: Parameter[];
  responses?: Record<string, { content?: Record<string, { schema?: Schema }> }>;
}

export interface ApiDocument {
  paths: Record<string, { get?: Operation }>;
  components?: { schemas?: Record<string, Schema> };
}

export interface Endpoint {
  path: string;
  shortPath: string;
  group: string;
  title: string;
  groupLabel: string;
  note: string;
  parameters: (Parameter & { help: string; value: string })[];
  response: Schema;
  errorResponse: Schema;
  statuses: string[];
}

export function resolveSchema(schema: Schema, spec: ApiDocument): Schema {
  if (!schema.$ref) return schema;
  const prefix = "#/components/schemas/";
  if (!schema.$ref.startsWith(prefix)) return schema;
  return spec.components?.schemas?.[schema.$ref.slice(prefix.length)] ?? schema;
}

export function buildCatalog(spec: ApiDocument, language: Language): Endpoint[] {
  const catalog: Endpoint[] = [];
  for (const [path, item] of Object.entries(spec.paths)) {
    if (!item.get) continue;
    const operation = item.get;
    const shortPath = path.replace(/^\/api\/v2/, "");
    const group = operation.tags?.[0] ?? "System";
    const groupContent = groups[group as keyof typeof groups];
    const title = titles[shortPath];
    catalog.push({
      path, shortPath, group,
      title: title ? translate(title, language) : operation.summary ?? path,
      groupLabel: groupContent ? translate(groupContent.label, language) : group,
      note: groupContent ? translate(groupContent.note, language) : "",
      parameters: (operation.parameters ?? []).map((parameter) => {
        const schema = resolveSchema(parameter.schema, spec);
        const helpText = parameterHelp[parameter.name];
        let help = helpText ? translate(helpText, language) : parameter.name;
        if (shortPath.startsWith("/insurance/")) {
          if (parameter.name === "city") help = translate(["Partie du libellé de localité, sans distinction de casse ni d’accents. Fes trouve aussi Fès-El Mariniyine ; ce n’est pas une limite administrative.", "Part of a source locality label, ignoring case and accents. Fes also matches Fès-El Mariniyine; not an administrative boundary.", "جزء من اسم المنطقة في المصدر، دون تمييز حالة الأحرف أو اللكنات. يطابق Fes أيضاً Fès-El Mariniyine؛ ليس نطاقاً إدارياً."], language);
          if (parameter.name === "code") help = translate(["Code ACAPS exact, zéros et suffixes compris ; insensible à la casse.", "Exact ACAPS code including zeros and branch suffixes; case-insensitive.", "رمز ACAPS كاملاً مع الأصفار واللواحق، دون تمييز حالة الأحرف."], language);
        }
        if (shortPath === "/postal-codes" && parameter.name === "city") {
          help = translate(["Une des villes de /postal-codes/cities, sans distinction de casse, d’accents, d’espaces ou de tirets.", "One of /postal-codes/cities, ignoring case, accents, spaces and hyphens.", "إحدى مدن /postal-codes/cities، دون تمييز حالة الأحرف أو اللكنات أو الفراغات أو الشرطات."], language);
        }
        if (shortPath.startsWith("/world-bank/") && ["from", "to"].includes(parameter.name)) {
          help += translate([" Année sur 4 chiffres.", " Four-digit year.", " سنة من أربعة أرقام."], language);
        }
        const example = examples[shortPath]?.[parameter.name];
        const value = example ?? (parameter.name === "limit" ? "10" : schema.default === undefined ? "" : String(schema.default));
        return { ...parameter, schema, help, value };
      }),
      response: resolveSchema(operation.responses?.["200"]?.content?.["application/json"]?.schema ?? {}, spec),
      errorResponse: resolveSchema(Object.entries(operation.responses ?? {}).find(([status]) => status !== "200")?.[1]?.content?.["application/json"]?.schema ?? {}, spec),
      statuses: Object.keys(operation.responses ?? {}).filter((status) => /^\d{3}$/.test(status)),
    });
  }
  const order = Object.keys(groups);
  return catalog.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

export function schemaType(schema: Schema, spec: ApiDocument): string {
  const resolved = resolveSchema(schema, spec);
  if (resolved.const === null || resolved.enum?.length === 1 && resolved.enum[0] === null) return "null";
  const choices = resolved.anyOf ?? resolved.oneOf;
  if (choices) return [...new Set(choices.map((choice) => schemaType(choice, spec)))].join(" | ");
  const type = resolved.type ?? (resolved.properties ? "object" : resolved.const === null ? "null" :
    resolved.const !== undefined ? typeof resolved.const : resolved.enum?.length ? typeof resolved.enum[0] : "unknown");
  const name = type === "array" ? `${schemaType(resolved.items ?? {}, spec)}[]` : type;
  return resolved.nullable && name !== "null" ? `${name} | null` : name;
}
