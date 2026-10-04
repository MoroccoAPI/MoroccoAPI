import { APP_VERSION } from "../version.js";

export function renderHomePage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="MoroccoAPI makes Morocco's public open data easier to use through a community-built, documented JSON API.">
  <meta name="theme-color" content="#075c43">
  <title>MoroccoAPI</title>
  <link rel="icon" type="image/png" href="/assets/moroccoapi-logo.png">
  <style>
    :root { color-scheme: light; --ink: #18332c; --muted: #61736d; --green: #075c43; --paper: #fafbf7; --line: #dde5dd; }
    * { box-sizing: border-box; }
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
    .button { display: inline-flex; gap: 18px; align-items: center; justify-content: center; border-radius: 7px; border: 1px solid var(--line); padding: 14px 20px; font-size: 14px; font-weight: 650; background: #fff; }
    .primary { background: var(--green); color: #fff; border-color: var(--green); }
    .button:hover { border-color: var(--green); }
    .primary:hover { background: #064e39; }
    .version-note { margin-top: 20px; font-size: 12px; color: var(--muted); }
    .visual { padding: 28px; border: 1px solid var(--line); border-radius: 16px; background: #f0f4ec; }
    .visual-brand { display: flex; align-items: center; gap: 22px; margin-bottom: 25px; }
    .visual-brand img { width: 120px; height: 120px; object-fit: contain; }
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
    @media (max-width: 520px) { .wrap { width: calc(100% - 36px); } header { padding: 20px 0; gap: 12px; } .brand { font-size: 18px; gap: 6px; } .brand img { width: 35px; height: 35px; } h1 { font-size: 43px; letter-spacing: -2px; } .intro { font-size: 15px; } .visual { padding: 20px; } .visual-brand img { width: 88px; height: 88px; } .visual-brand { gap: 16px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <a class="brand" href="/" aria-label="MoroccoAPI home"><img src="/assets/moroccoapi-logo.png" alt="" width="44" height="44">MoroccoAPI</a>
    </header>
    <main>
      <section class="hero" aria-labelledby="intro-title">
        <div>
          <div class="eyebrow"><span class="dot" aria-hidden="true"></span>Open data. Built together.</div>
          <h1 id="intro-title">Morocco’s open data,<br><span>ready to build with.</span></h1>
          <p class="intro">A community-built API that makes Moroccan public datasets easier to discover and use. One consistent JSON format, clear documentation, and a source behind every dataset.</p>
          <div class="actions"><a class="button primary" href="/docs">Explore the API <span aria-hidden="true">→</span></a><a class="button" href="https://github.com/MoroccoAPI/MoroccoAPI">Contribute on GitHub <span aria-hidden="true">↗</span></a></div>
          <p class="version-note">v${APP_VERSION} · Open source</p>
        </div>
        <div class="visual">
          <div class="visual-brand"><img src="/assets/moroccoapi-logo.png" alt="" width="120" height="120"><div><strong>Start with geography.</strong><p>Regions, provinces, and communes.<br>Arabic and French names included.</p></div></div>
          <div class="terminal">
            <div class="terminal-head" aria-hidden="true"><i></i><i></i><i></i><span>Your first request</span></div>
            <pre><code><span class="verb">curl</span> https://moroccoapi.dev/api/v1/regions</code></pre>
            <a class="terminal-link" href="/api/v1/regions"><span>See the JSON response</span><span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>
    </main>
    <footer><span>MoroccoAPI · An independent community project.</span><div class="footer-links"><a href="https://github.com/MoroccoAPI/MoroccoAPI/releases">Releases · v${APP_VERSION}</a><a href="/api/v1/status">API status</a><a href="/openapi.json">OpenAPI</a></div></footer>
  </div>
</body>
</html>`;
}
