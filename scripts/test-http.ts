import { spawn } from "node:child_process";
const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--test", "tests/postgresql.test.ts"], { env: { ...process.env, RUN_HTTP_TESTS: "1" }, stdio: "inherit", windowsHide: true });
child.on("exit", code => { process.exitCode = code ?? 1; });
