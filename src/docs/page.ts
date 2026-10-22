import { APP_VERSION } from "../version.js";
import { buildCatalog, resolveSchema, schemaType, type ApiDocument, type Endpoint, type Schema } from "./catalog.js";
import { groups, languages, localizeWords, titles, type Language } from "./content.js";
import { client } from "./client.js";
import { styles } from "./styles.js";
import { docsUrl } from "./urls.js";
import { seoHead } from "../web/seo.js";
import { themeButton, themeClient, themeInit } from "../web/theme.js";
import { sidebarClient, sidebarInit } from "./sidebar.js";
import { concepts, responseFields, type DocumentedField } from "./fields.js";
import { translate } from "./content.js";

export const escapeHtml = (value: unknown): string => String(value).replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

const icon = (name: "search" | "arrow" | "check" | "github" | "menu") => {
  const paths = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    github: '<path d="M9 19c-4 1-4-2-6-2m12 4v-4a3 3 0 0 0-.8-2.3c2.7-.3 5.6-1.3 5.6-6a4.7 4.7 0 0 0-1.3-3.3 4.3 4.3 0 0 0-.1-3.3s-1-.3-3.4 1.3a12 12 0 0 0-6 0C6.6 1.8 5.6 2.1 5.6 2.1a4.3 4.3 0 0 0-.1 3.3A4.7 4.7 0 0 0 4.2 8.7c0 4.7 2.9 5.7 5.6 6A3 3 0 0 0 9 17v4"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  };
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};

export function renderDocsPage(spec: ApiDocument, language: Language, requestedEndpoint?: string): string {
  const w = localizeWords(language);
  const catalog = buildCatalog(spec, language);
  const selected = catalog.find((endpoint) => endpoint.path === requestedEndpoint) ?? catalog.find((endpoint) => endpoint.shortPath === "/regions") ?? catalog[0]!;
  const index = catalog.indexOf(selected);
  const link = (endpoint: Endpoint) => escapeHtml(docsUrl(language, endpoint.path));
  const navigation = Object.keys(groups).map((group) => {
    const endpoints = catalog.filter((endpoint) => endpoint.group === group);
    if (!endpoints.length) return "";
    const active = selected.group === group;
    return `<details class="nav-group" data-active="${active}">
      <summary>${escapeHtml(endpoints[0]!.groupLabel)}<span class="count">${endpoints.length.toString().padStart(2, "0")}</span></summary>
      ${endpoints.map((endpoint) => `<a class="endpoint-link" href="${link(endpoint)}" data-search="${escapeHtml([endpoint.path, endpoint.groupLabel, ...(titles[endpoint.shortPath] ?? [])].join(" "))}" ${endpoint === selected ? 'aria-current="page"' : ""}><span class="mini-method">GET</span><span>${escapeHtml(endpoint.title)}</span></a>`).join("")}
    </details>`;
  }).join("");

  const parameters = selected.parameters.map((parameter) => {
    const schema = parameter.schema;
    const id = `param-${parameter.name}`;
    const description = `${id}-help`;
    const attributes = [
      `id="${id}"`, `name="${escapeHtml(parameter.name)}"`, `aria-describedby="${description}"`,
      parameter.required ? "required" : "",
    ].join(" ");
    const constraints = [
      schema.minimum !== undefined ? `${w.min}: ${schema.minimum}` : "",
      schema.maximum !== undefined ? `${w.max}: ${schema.maximum}` : "",
      schema.minLength !== undefined ? `${schema.minLength}-${schema.maxLength ?? "∞"} ${w.chars}` : "",
      schema.default !== undefined ? `${w.default}: ${schema.default}` : "",
      schema.format ?? "",
    ].filter(Boolean);
    const options = schema.enum ?? (schema.type === "boolean" ? [true, false] : undefined);
    const emptyOptionLabel = schema.default === undefined ? w.any : `${w.default}: ${schema.default}`;
    const input = options ? `<select ${attributes}><option value="">${escapeHtml(emptyOptionLabel)}</option>${options.map((option) => `<option value="${escapeHtml(option)}" ${String(option) === parameter.value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select>` :
      `<input ${attributes} type="${schema.type === "integer" || schema.type === "number" ? "number" : schema.format === "date" ? "date" : "text"}" value="${escapeHtml(parameter.value)}" ${schema.minimum !== undefined ? `min="${schema.minimum}"` : ""} ${schema.maximum !== undefined ? `max="${schema.maximum}"` : ""} ${schema.type === "integer" ? 'step="1"' : schema.type === "number" ? 'step="any"' : ""} ${schema.minLength !== undefined ? `minlength="${schema.minLength}"` : ""} ${schema.maxLength !== undefined ? `maxlength="${schema.maxLength}"` : ""} ${schema.pattern ? `pattern="${escapeHtml(schema.pattern)}"` : ""} autocomplete="off" spellcheck="false">`;
    return `<div class="parameter"><div class="parameter-heading"><label for="${id}"><code>${escapeHtml(parameter.name)}</code></label><span class="type">${escapeHtml(schemaType(schema, spec))}</span><span class="requirement ${parameter.required ? "required" : ""}">${escapeHtml(parameter.required ? w.required : w.optional)} · ${escapeHtml(parameter.in === "path" ? w.path : w.query)}</span></div><p id="${description}">${escapeHtml(parameter.help)}</p>${input}<div class="constraints">${constraints.map((constraint) => `<span>${escapeHtml(constraint)}</span>`).join("")}</div>${schema.pattern ? `<details class="schema-details"><summary>${escapeHtml(w.pattern)}</summary><code class="constraint-pattern">${escapeHtml(schema.pattern)}</code></details>` : ""}</div>`;
  }).join("");

  const fields = responseFields(selected.response, spec, selected, language);
  const errorFields = responseFields(selected.errorResponse, spec, selected, language);
  const fieldList = (list: DocumentedField[]) => `<dl class="field-list">${list.map((field) => {
    const schema = resolveSchema(field.schema, spec);
    const values = schema.const !== undefined ? [schema.const] : schema.enum;
    const example = field.example && escapeHtml(field.example).replace(/(?:hcp_code|code) = &quot;[^&]*&quot;/g, (value) => `<bdi dir="ltr"><code>${value}</code></bdi>`);
    return `<div class="field" data-field="${escapeHtml(field.path)}"><dt><code dir="ltr">${escapeHtml(field.path)}</code><span class="type" dir="ltr">${escapeHtml(schemaType(field.schema, spec))}</span></dt><dd><p>${escapeHtml(field.meaning ?? "")}</p>${example ? `<p class="field-example"><strong>${escapeHtml(w.example)}:</strong> ${example}</p>` : ""}${values ? `<p class="field-values"><span>${escapeHtml(w.values)}:</span> ${values.map((value) => `<code dir="ltr">${escapeHtml(JSON.stringify(value))}</code>`).join(" ")}</p>` : ""}</dd></div>`;
  }).join("")}</dl>`;
  const dataFields = fields.filter((field) => field.path === "data" || field.path.startsWith("data.") || field.path.startsWith("data[]"));
  const metaFields = fields.filter((field) => !dataFields.includes(field));
  const context = concepts[selected.group];
  const config = JSON.stringify({ path: selected.path, parameters: selected.parameters.map(({ name, in: location }) => ({ name, in: location })), words: w }).replace(/</g, "\\u003c");
  const adjacent = (endpoint: Endpoint | undefined, title: string) => endpoint ? `<a href="${link(endpoint)}">${escapeHtml(title)}<strong>${escapeHtml(endpoint.title)}</strong></a>` : "<span></span>";
  const seo = seoHead({
    title: `${selected.title} · MoroccoAPI ${w.documentation}`,
    description: `${selected.title}: MoroccoAPI. ${selected.note}`.slice(0, 170),
    path: docsUrl(language, selected.path), language, article: true,
    alternates: [...languages.map((code) => ({ language: code, path: docsUrl(code, selected.path) })),
      { language: "x-default", path: docsUrl("fr", selected.path) }],
  });
  return `<!doctype html>
<html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#ffffff">${seo}<link rel="icon" type="image/png" href="/assets/moroccoapi-logo.png"><script>${themeInit}${sidebarInit}</script><style>${styles}</style></head>
<body>
<a class="skip" href="#reference">${escapeHtml(w.reference)}</a>
<header class="topbar"><div class="header-brand"><button class="menu-button" id="menu-toggle" type="button" aria-label="${escapeHtml(w.menu)}" aria-expanded="false" aria-controls="sidebar">${icon("menu")}<span class="menu-label">${escapeHtml(w.navigation)}</span></button><a class="brand" href="/"><img src="/assets/moroccoapi-logo.png" width="40" height="40" alt="">MoroccoAPI<span class="brand-divider"></span><span class="brand-section">${escapeHtml(w.documentation)}</span></a></div><div class="toplinks"><span class="version">v${APP_VERSION}</span><a class="source-link" href="https://github.com/MoroccoAPI/MoroccoAPI">${icon("github")}${escapeHtml(w.github)}</a>${themeButton(w.lightTheme, w.darkTheme)}<nav class="languages" aria-label="${escapeHtml(w.languages)}">${([["fr", "FR", "Français"], ["en", "EN", "English"], ["ar", "العربية", "العربية"]] as const).map(([code, label, name]) => `<a href="${escapeHtml(docsUrl(code, selected.path))}" lang="${code}" hreflang="${code}" aria-label="${name}" ${language === code ? 'aria-current="true"' : ""}>${label}</a>`).join("")}</nav></div></header>
<button type="button" class="drawer-backdrop" id="drawer-backdrop" aria-label="${escapeHtml(w.closeMenu)}" tabindex="-1" hidden></button>
<div class="layout">
<aside class="sidebar" id="sidebar" aria-label="${escapeHtml(w.navigation)}"><div class="sidebar-heading"><span>${escapeHtml(w.navigation)}</span><button type="button" class="drawer-close" id="menu-close" aria-label="${escapeHtml(w.closeMenu)}">×</button></div><div class="search-wrap">${icon("search")}<input type="search" id="resource-search" placeholder="${escapeHtml(w.search)}" aria-label="${escapeHtml(w.search)}" autocomplete="off"></div><nav aria-label="${escapeHtml(w.navigation)}"><div class="nav-label">${escapeHtml(w.navigation)} <span class="count">/ ${catalog.length}</span></div>${navigation}<p class="no-results" id="no-results" hidden>${escapeHtml(w.noResults)}</p></nav><div class="sidebar-foot"><a href="/openapi.json">OpenAPI ↗</a><a href="https://github.com/MoroccoAPI/MoroccoAPI/releases">v${APP_VERSION} ↗</a></div></aside>
<main class="workspace" id="reference">
<section class="intro"><div><div class="eyebrow">${escapeHtml(w.reference)}</div><p>${escapeHtml(w.tagline)}</p></div><div class="benefits"><span>${icon("check")}${escapeHtml(w.public)}</span><span>${icon("check")}${escapeHtml(w.json)}</span><span>${icon("check")}${escapeHtml(w.cors)}</span></div></section>
<div class="content-grid">
<article class="reference"><div class="breadcrumb">${escapeHtml(selected.groupLabel)}<span>/</span><code>API v2</code></div><h1>${escapeHtml(selected.title)}</h1><div class="endpoint-bar"><span class="method">GET</span><code class="endpoint-path">${escapeHtml(selected.path)}</code></div><p class="note"><strong>${escapeHtml(w.source)}.</strong> ${escapeHtml(selected.note)}</p>
${selected.shortPath === "/postal-codes" ? `<p class="filter-notice">${escapeHtml(w.postalFilter)}</p>` : ""}
${context ? `<details class="guide context-guide"><summary>${escapeHtml(w.concepts)}</summary><p>${escapeHtml(translate(context, language))}</p></details>` : ""}
<form id="request-form"><details class="parameters-panel" id="request-parameters"><summary class="section-heading"><h2>${escapeHtml(w.parameters)}</h2><span class="count">${selected.parameters.length.toString().padStart(2, "0")}</span></summary>${parameters || `<p class="blank">${escapeHtml(w.noParameters)}</p>`}</details></form>
<details class="guide"><summary>${escapeHtml(w.responseFormat)}</summary><p><code>data</code>: ${escapeHtml(w.dataHelp)}</p><p><code>meta</code>: ${escapeHtml(w.metaHelp)}</p>${metaFields.some((field) => field.path === "meta.pagination") ? `<p><code>meta.pagination</code>: ${escapeHtml(w.paginationHelp)}</p><p>${escapeHtml(w.example)}: ${escapeHtml(w.paginationExample)}</p>` : ""}<p>${escapeHtml(w.versionGuide)}</p></details>
${fields.length ? `<details class="guide"><summary>${escapeHtml(w.fields)} <span class="count">${dataFields.length}</span></summary><p>${escapeHtml(w.fieldGuide)}</p>${fieldList(dataFields)}<details class="schema-details"><summary>${escapeHtml(w.schema)}</summary><pre>${escapeHtml(JSON.stringify(selected.response, null, 2))}</pre></details></details><details class="guide"><summary>${escapeHtml(w.metadataFields)} <span class="count">${metaFields.length}</span></summary>${fieldList(metaFields)}</details>` : ""}
<details class="guide"><summary>${escapeHtml(w.errors)}</summary><ul>${selected.statuses.filter((status) => status !== "200").map((status) => `<li><code>${status}</code>: ${escapeHtml(status === "400" ? w.error400 : status === "404" ? w.error404 : w.error500)}</li>`).join("")}</ul><p>${escapeHtml(w.errorHelp)}</p>${fieldList(errorFields)}</details>
</article>
<section class="playground" aria-label="${escapeHtml(w.request)}"><div class="playground-heading"><h2>${escapeHtml(w.request)}</h2><span class="live-dot">GET · JSON</span></div><div class="request-card"><p class="base-url">${escapeHtml(w.baseUrl)}</p><p class="host" id="base-url"></p><div class="request-toolbar"><div class="code-tabs" role="tablist" aria-label="${escapeHtml(w.request)}"><button type="button" id="tab-curl" role="tab" aria-selected="true" aria-controls="request-code" data-mode="curl">cURL</button><button type="button" id="tab-js" role="tab" aria-selected="false" aria-controls="request-code" tabindex="-1" data-mode="js">JavaScript</button></div><button type="button" class="copy-button" id="copy" aria-live="polite">${escapeHtml(w.copy)}</button></div><pre class="request-code" id="request-code" role="tabpanel" aria-labelledby="tab-curl" tabindex="0"></pre><div class="request-action"><button type="submit" form="request-form" class="run-button" id="run"><span id="run-label">${escapeHtml(w.run)}</span>${icon("arrow")}</button></div></div><div class="response-card"><div class="response-heading"><strong>${escapeHtml(w.response)}</strong><span class="response-status" id="response-status" role="status" aria-live="polite"></span></div><p class="response-placeholder" id="response-placeholder">${escapeHtml(w.idle)}</p><pre class="response-body" id="response-body" tabindex="0" aria-label="${escapeHtml(w.response)}" hidden></pre></div><p class="response-help">${escapeHtml(w.languageNote)}</p></section>
</div><nav class="bottom-nav" aria-label="${escapeHtml(w.navigation)}">${adjacent(catalog[index - 1], w.previous)}${adjacent(catalog[index + 1], w.next)}</nav><footer class="page-footer"><span>MoroccoAPI · ${escapeHtml(w.footer)}</span><a href="/openapi.json">OpenAPI 3.0 ↗</a></footer></main></div>
<script type="application/json" id="docs-config">${config}</script><script>${themeClient}</script><script>${client}</script><script>${sidebarClient}</script>
</body></html>`;
}
