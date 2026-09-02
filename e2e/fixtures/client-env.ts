import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "../../client/.env");

const readEnvVar = (name: string): string => {
  const raw = readFileSync(ENV_PATH, "utf-8");
  const line = raw.split("\n").find((l) => l.trim().startsWith(`${name}=`));
  if (!line) {
    throw new Error(`${name} not set in client/.env — the built extension under test needs it`);
  }
  return line.split("=").slice(1).join("=").trim();
};

// client/dist (loaded by fixtures/extension.ts) has these baked in at build
// time by client/scripts/build.mjs — tests need to know the same values to
// mock the right origin / match what the extension will actually do.
export const CLIENT_SERVER_BASE = readEnvVar("SERVER_BASE");
