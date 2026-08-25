// Env vars every release build (client, userscript) must have set — baked
// into the bundle via esbuild's `define`. Missing either one silently breaks
// server communication (e.g. logInit) in the published build.
export const REQUIRED_RELEASE_ENV_VARS = ["SERVER_BASE", "CLIENT_SECRET"];
