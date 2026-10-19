import { APP_VERSION } from "../version.js";
import { seoHead } from "../web/seo.js";
import { themeButton, themeClient, themeInit, themeStyles } from "../web/theme.js";
import { homeContent, homeUrl, type HomeLanguage } from "./content.js";

const actionIcon = (kind: "docs" | "github"): string => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kind === "docs"
  ? '<path d="M12 7v14M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"/>'
  : '<path d="M9 19c-4 1-4-2-6-2m12 4v-4a3 3 0 0 0-.8-2.3c2.7-.3 5.6-1.3 5.6-6a4.7 4.7 0 0 0-1.3-3.3 4.3 4.3 0 0 0-.1-3.3s-1-.3-3.4 1.3a12 12 0 0 0-6 0C6.6 1.8 5.6 2.1 5.6 2.1a4.3 4.3 0 0 0-.1 3.3A4.7 4.7 0 0 0 4.2 8.7c0 4.7 2.9 5.7 5.6 6A3 3 0 0 0 9 17v4"/>'}</svg>`;

export function renderHomePage(language: HomeLanguage = "en"): string {
  const w = homeContent[language];
  return `<!doctype html>
<html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#075c43">
  ${seoHead({ title: w.seoTitle, description: w.description, path: homeUrl(language), language,
    alternates: [...(["fr", "en", "ar"] as const).map((code) => ({ language: code, path: homeUrl(code) })), { language: "x-default", path: "/" }] })}
  <link rel="icon" type="image/png" href="/assets/moroccoapi-logo.png">
  <script>${themeInit}</script>
  <style>
    :root { color-scheme: light; --ink: #18332c; --muted: #61736d; --green: #075c43; --paper: #fafbf7; --line: #dde5dd; }
    * { box-sizing: border-box; }
    html,body { scrollbar-width: none; }
    html::-webkit-scrollbar,body::-webkit-scrollbar { display: none; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
    a:focus-visible { outline: 3px solid #c74c46; outline-offset: 5px; }
    .wrap { display: flex; flex-direction: column; width: min(1120px, calc(100% - 64px)); min-height: 100vh; min-height: 100svh; margin: 0 auto; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 28px 0; }
    .brand { display: flex; align-items: center; gap: 12px; font-size: 21px; font-weight: 750; letter-spacing: -.6px; }
    .brand img { width: 44px; height: 44px; object-fit: contain; }
    footer a:hover { color: var(--green); text-decoration: underline; text-underline-offset: 4px; }
    main { display: flex; flex: 1; align-items: center; }
    .hero { display: grid; width: 100%; grid-template-columns: 1.2fr 1fr; gap: 76px; align-items: center; padding: 64px 0; }
    .eyebrow { display: inline-flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 650; letter-spacing: 1.4px; text-transform: uppercase; color: var(--green); }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #bf373d; }
    h1 { margin: 24px 0; font-size: clamp(40px, 4.8vw, 60px); font-weight: 650; line-height: 1.1; letter-spacing: -2.7px; }
    h1 span { color: var(--green); }
    .intro { max-width: 490px; font-size: 17px; line-height: 1.8; color: var(--muted); }
    .actions { display: flex; gap: 13px; flex-wrap: wrap; margin-top: 30px; }
    .button { display: inline-flex; gap: 10px; align-items: center; justify-content: center; min-height: 48px; border-radius: 10px; border: 1px solid var(--line); padding: 10px 18px; font-size: 16px; line-height: 1.45; font-weight: 600; background: #fff; }
    .button svg { display: block; width: 19px; height: 19px; flex-shrink: 0; transform: translateY(2px); }
    .primary { background: var(--green); color: #fff; border-color: var(--green); }
    .button:hover { border-color: var(--green); }
    .primary:hover { background: #064e39; }
    .version-note { margin-top: 20px; font-size: 12px; color: var(--muted); }
    .visual { padding: 28px; border: 1px solid var(--line); border-radius: 16px; background: #f0f4ec; }
    .visual-brand { margin-bottom: 22px; }
    .visual-brand strong { display: block; font-size: 21px; letter-spacing: -.5px; margin-bottom: 7px; }
    .visual-brand p { font-size: 13px; color: var(--muted); margin: 0; line-height: 1.6; }
    .terminal { overflow: hidden; border-radius: 9px; background: #142c25; color: #e0eee6; }
    .terminal-head { display: flex; align-items: center; gap: 6px; padding: 14px 17px; border-bottom: 1px solid #30463d; font-size: 11px; color: #a1b6aa; }
    .terminal-head i { width: 6px; height: 6px; border-radius: 50%; background: #6a8275; }
    .terminal-head span { margin-left: auto; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; padding: 21px 17px; font-size: 12px; line-height: 1.9; }
    code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
    .verb { color: #96ddb8; }
    .terminal-link { display: flex; justify-content: space-between; padding: 12px 17px; border-top: 1px solid #30463d; font-size: 11px; color: #aed2bc; }
    .terminal-link:hover { background: #203c31; }
    footer { display: flex; flex-shrink: 0; gap: 20px; flex-wrap: wrap; justify-content: space-between; align-items: center; border-top: 1px solid var(--line); padding: 24px 0 30px; color: var(--muted); font-size: 12px; }
    .footer-links { display: flex; gap: 20px; flex-wrap: wrap; }
    @media (max-width: 980px) { .hero { grid-template-columns: 1fr; gap: 36px; padding: 45px 0; } .intro { max-width: 600px; } .visual { max-width: 600px; } }
    @media (max-width: 520px) { .wrap { width: calc(100% - 36px); } header { padding: 20px 0; gap: 12px; } .brand { font-size: 18px; gap: 6px; } .brand img { width: 35px; height: 35px; } h1 { font-size: 43px; letter-spacing: -2px; } .intro { font-size: 15px; } .visual { padding: 20px; } }
    :root{--surface:#fff;--mint:#e4efe6}
    :root[data-theme=dark]{color-scheme:dark;--ink:#e6f0e8;--muted:#b0c3b7;--green:#9cdeb6;--paper:#111c18;--line:#34483c;--surface:#15251d;--mint:#233c2d}
    body{font-size:17px}header{gap:18px}.button{background:var(--surface);font-size:16px}.primary{background:var(--green);color:var(--paper)}.primary:hover{background:var(--green);filter:brightness(.94)}.version-note{font-size:14px}.eyebrow{font-size:14px}.visual{background:var(--mint)}.visual-brand p{font-size:16px}.terminal-head,.terminal-link{font-size:14px}pre{font-size:15px}.terminal-link{gap:15px}footer{font-size:14px}.home-tools{display:flex;align-items:center;gap:10px}
    .home-language-switch{display:inline-flex;align-items:center;gap:3px;padding:4px;border:1px solid var(--line);border-radius:999px;background:var(--surface);direction:ltr;flex-shrink:0}.home-language-switch a{display:flex;align-items:center;justify-content:center;min-width:38px;min-height:36px;padding:5px 11px;border-radius:999px;color:var(--muted);font-size:14px;font-weight:600;line-height:1.5}.home-language-switch a:hover{background:var(--mint);color:var(--ink)}.home-language-switch a[aria-current]{background:var(--green);color:var(--paper)}.home-language-switch a:focus-visible{outline:2px solid var(--green);outline-offset:3px}.terminal{direction:ltr;text-align:left}
    [dir=rtl] body{font-family:Tahoma,"Segoe UI",Arial,sans-serif}[dir=rtl] h1{letter-spacing:0;line-height:1.5}[dir=rtl] .eyebrow{letter-spacing:0}[dir=rtl] .brand{direction:rtl}
    @media(max-width:520px){.intro{font-size:17px}.visual-brand p{font-size:16px}.button{font-size:16px}.brand{font-size:17px}.home-language-switch a{padding-inline:8px;min-width:34px}}
    .brand img{background:#fff;border-radius:8px;padding:4px}
    @media(max-width:380px){.brand{font-size:0;gap:0}.brand img{width:34px;height:34px}.home-tools{gap:8px}}
    @media(min-width:981px){
      header{padding-block:clamp(16px,2.7svh,28px)}
      .hero{padding-block:clamp(18px,4svh,44px);gap:clamp(36px,5vw,76px)}
      h1{font-size:clamp(38px,min(4.8vw,6.5svh),60px);margin-block:18px}
      [dir=rtl] h1{line-height:1.3}
      .actions{margin-top:24px}.version-note{margin-top:14px}
      footer{padding-block:18px 22px}
    }
    ${themeStyles}
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <a class="brand" href="${homeUrl(language)}" aria-label="${w.homeLabel}"><img src="/assets/moroccoapi-logo.png" alt="" width="44" height="44">MoroccoAPI</a>
      <div class="home-tools"><nav class="home-language-switch" aria-label="${w.languageLabel}">${(["fr", "en", "ar"] as const).map((code) => `<a href="${homeUrl(code)}" lang="${code}" hreflang="${code}" aria-label="${homeContent[code].name}" ${code === language ? 'aria-current="page"' : ""}>${code === "fr" ? "FR" : code === "en" ? "EN" : "العربية"}</a>`).join("")}</nav>${themeButton(w.light, w.dark)}</div>
    </header>
    <main>
      <section class="hero" aria-labelledby="intro-title">
        <div>
          <div class="eyebrow"><span class="dot" aria-hidden="true"></span>${w.eyebrow}</div>
          <h1 id="intro-title">${w.title}<br><span>${w.titleAccent}</span></h1>
          <p class="intro">${w.intro}</p>
          <div class="actions"><a class="button primary" href="/docs/${language}/regions">${actionIcon("docs")}<span>${w.explore}</span></a><a class="button" href="https://github.com/MoroccoAPI/MoroccoAPI">${actionIcon("github")}<span>${w.contribute}</span></a></div>
          <p class="version-note">v${APP_VERSION} · ${w.openSource}</p>
        </div>
        <div class="visual">
          <div class="visual-brand"><strong>${w.start}</strong><p>${w.geography}<br>${w.names}</p></div>
          <div class="terminal">
            <div class="terminal-head" aria-hidden="true"><i></i><i></i><i></i><span>${w.firstRequest}</span></div>
            <pre><code><span class="verb">curl</span> https://moroccoapi.dev/api/v2/regions</code></pre>
            <a class="terminal-link" href="/api/v2/regions"><span>${w.response}</span><span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>
    </main>
    <footer><span>MoroccoAPI · ${w.footer}</span><div class="footer-links"><a href="https://github.com/MoroccoAPI/MoroccoAPI/releases">${w.releases} · v${APP_VERSION}</a><a href="/api/v2/status">${w.status}</a><a href="/openapi.json">OpenAPI</a></div></footer>
  </div>
  <script>${themeClient}</script>
</body>
</html>`;
}
