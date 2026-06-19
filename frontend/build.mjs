/**
 * Windows-safe build script.
 * On Windows the shell (bash/MSYS2) normalises paths to lowercase (c:\repos)
 * while Node.js uses the NTFS-canonical casing (C:\Repos). Running next build
 * from the bash cwd causes the same module to be loaded twice, breaking hooks.
 * This script resolves the canonical cwd and spawns next build from there.
 */
import { spawnSync } from "child_process";
import { realpathSync } from "fs";

const cwd = realpathSync(process.cwd()); // e.g. C:\Repos\fantasy_cycling\frontend
const result = spawnSync("npx.cmd", ["next", "build"], {
  cwd,
  stdio: "inherit",
  shell: false,
  env: { ...process.env, INIT_CWD: cwd },
});
process.exit(result.status ?? 1);
