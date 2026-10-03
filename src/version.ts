import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageInfo = require("../package.json") as { version: string };

export const APP_VERSION = packageInfo.version;
export const APP_REVISION = process.env.RENDER_GIT_COMMIT;
