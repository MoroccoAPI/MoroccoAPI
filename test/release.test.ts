import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { it } from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/release.yml", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");
const version = JSON.parse(readFileSync("package.json", "utf8")).version as string;
const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function runInlineNode(stepName: string, context: Record<string, unknown>) {
  const start = workflow.indexOf(`- name: ${stepName}\n`);
  assert.ok(start >= 0, `Workflow step is missing: ${stepName}`);
  const block = workflow.slice(start).match(
    /node --input-type=module <<'NODE'\n([\s\S]*?)\n {10}NODE/,
  );
  assert.ok(block, `Inline Node code is missing: ${stepName}`);
  const source = block[1].replace(/^ {10}/gm, "").replace(/^import .*;\n/gm, "");
  // Run the exact inline code with injected dependencies. No real HTTP request
  // or GitHub/Render mutation is possible in these tests.
  return new AsyncFunction(...Object.keys(context), source)(...Object.values(context));
}

function checkApproval(environment: object) {
  return runInlineNode("Require a configured manual reviewer", {
    readFileSync: () => JSON.stringify(environment),
    process: { env: { APPROVAL_RULES_FILE: "test-only.json" } },
    console: { log: () => {} },
  });
}

function deployContext(overrides: Record<string, unknown> = {}) {
  return {
    readFileSync,
    execFileSync,
    delay: async () => {},
    process: {
      env: {
        RELEASE_TAG: `v${version}`,
        RELEASE_REVISION: revision,
        PUBLIC_BASE_URL: "https://moroccoapi.dev",
        RENDER_DEPLOY_HOOK_URL: "https://api.render.com/deploy/srv-test?key=test-only",
      },
    },
    fetch: async () => { throw new Error("Unexpected HTTP request in test"); },
    console: { log: () => {} },
    ...overrides,
  };
}

it("blocks deployment if production has no approval rule", async () => {
  await assert.rejects(checkApproval({ protection_rules: [] }), /Required reviewers/);
});

it("blocks deployment if production has an empty reviewer list", async () => {
  await assert.rejects(
    checkApproval({ protection_rules: [{ type: "required_reviewers", reviewers: [] }] }),
    /Required reviewers/,
  );
});

it("accepts a production environment with a required reviewer", async () => {
  await checkApproval({
    protection_rules: [{ type: "required_reviewers", reviewers: [{ type: "User", reviewer: { login: "test-reviewer" } }] }],
  });
});

it("refuses deployment without the production Render hook", async () => {
  await assert.rejects(
    runInlineNode("Deploy the approved commit and verify the site", deployContext({
      process: { env: {} },
    })),
    /RENDER_DEPLOY_HOOK_URL/,
  );
});

it("refuses deployment of a commit different from the approved one", async () => {
  const context = deployContext();
  context.process.env.RELEASE_REVISION = "unapproved-commit";
  await assert.rejects(
    runInlineNode("Deploy the approved commit and verify the site", context),
    /approved tag, package version, and commit must match/,
  );
});

it("deploys the approved commit and waits through a previous healthy release", async () => {
  let healthChecks = 0;
  const paths: string[] = [];
  await runInlineNode("Deploy the approved commit and verify the site", deployContext({
    fetch: async (input: URL, options: RequestInit) => {
      const url = new URL(input);
      if (url.hostname === "api.render.com") {
        assert.equal(options.method, "POST");
        assert.equal(url.searchParams.get("ref"), revision);
        return new Response("{}");
      }
      paths.push(url.pathname);
      if (url.pathname === "/api/v1/status") {
        healthChecks++;
        return new Response(JSON.stringify({ data: { status: "ok", version } }), {
          headers: { "x-moroccoapi-revision": healthChecks === 1 ? "previous-commit" : revision },
        });
      }
      if (url.pathname === "/openapi.json") {
        return new Response(JSON.stringify({ info: { version } }));
      }
      return new Response("ok", {
        headers: { "content-type": url.pathname === "/" ? "text/html" : "image/png" },
      });
    },
  }));
  assert.equal(healthChecks, 2);
  assert.deepEqual(paths.slice(2), ["/", "/docs", "/openapi.json", "/assets/moroccoapi-logo.png"]);
});
