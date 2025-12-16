import { dirname, isAbsolute, resolve } from "jsr:@std/path";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { startServer } from "./server.ts";

type CliOptions = {
  port: number;
  hostname: string;
  wordsFile: string;
  kvPath: string;
  open: boolean;
  chdir: boolean;
};

function isRunningUnderDeno(): boolean {
  try {
    const base = Deno.execPath().split(/[\\/]/).pop()?.toLowerCase() ?? "";
    return base === "deno" || base === "deno.exe";
  } catch {
    return true;
  }
}

function maybeChdirToAppDir(enabled: boolean) {
  try {
    if (!enabled) return;
    if (isRunningUnderDeno()) return;

    const exec = Deno.execPath();
    if (!exec) return;
    const appDir = dirname(exec);
    if (!appDir) return;
    Deno.chdir(appDir);
  } catch {
    // best-effort only
  }
}

function shouldAutoOpenFromEnvAndMode(): boolean {
  if ((Deno.env.get("NO_OPEN") ?? "").toLowerCase() === "1") return false;

  // When running via `deno task start`, behave like a release binary: open by default.
  if (isRunningUnderDeno()) {
    const taskName = (Deno.env.get("DENO_TASK_NAME") ?? "").toLowerCase();
    if (taskName === "start") return true;

    // In dev (deno run / deno task dev), default to not opening; allow opt-in.
    return (Deno.env.get("AUTO_OPEN") ?? "") === "1";
  }

  // In compiled binary, open by default.
  return true;
}

async function openBrowser(url: string) {
  try {
    const os = Deno.build.os;
    if (os === "darwin") {
      await new Deno.Command("open", { args: [url] }).output();
    } else if (os === "windows") {
      // "start" is a shell builtin
      await new Deno.Command("cmd", { args: ["/c", "start", "", url] }).output();
    } else {
      await new Deno.Command("xdg-open", { args: [url] }).output();
    }
  } catch {
    // best-effort only
  }
}

function parsePort(raw: unknown): number {
  const p = typeof raw === "string" && raw.length > 0 ? Number(raw) : 8000;
  return Number.isFinite(p) && p > 0 ? Math.trunc(p) : 8000;
}

function parseCliOptions(args: string[]): CliOptions {
  // `deno task <name> -- <args...>` can insert a standalone "--" before forwarded args
  // (e.g. `... cli.ts -- --help`), which would otherwise cause `--help` to be treated
  // as a positional argument and skip help handling.
  const normalizedArgs = args.filter((a) => a !== "--");

  const parsed = parseArgs(normalizedArgs, {
    boolean: ["help", "open", "no-open", "chdir", "no-chdir"],
    string: ["port", "hostname", "words-file", "kv-path"],
    alias: {
      h: "help",
      p: "port",
    },
    stopEarly: false,
    unknown: (arg) => {
      // Allow positional args for now (ignored), but reject unknown flags.
      return !arg.startsWith("-");
    },
  });

  if (parsed.help) {
    printHelp();
    Deno.exit(0);
  }

  const envPort = Deno.env.get("PORT");
  const envHostname = Deno.env.get("HOSTNAME");
  const envWordsFile = Deno.env.get("WORDS_FILE");
  const envKvPath = Deno.env.get("KV_PATH");

  const port = parsePort(parsed.port ?? envPort);
  const hostname = (parsed.hostname ?? envHostname ?? "0.0.0.0").toString();
  const wordsFile = (parsed["words-file"] ?? envWordsFile ?? "./netem_full_list.json")
    .toString();
  const kvPath = (parsed["kv-path"] ?? envKvPath ?? "./data/kv").toString();

  const chdir =
    parsed["no-chdir"] ? false : (parsed.chdir ? true : (Deno.env.get("NO_CHDIR") ?? "")
      .toLowerCase() !== "1");

  const open = parsed["no-open"]
    ? false
    : (parsed.open ? true : shouldAutoOpenFromEnvAndMode());

  return { port, hostname, wordsFile, kvPath, open, chdir };
}

function printHelp() {
  console.log(`VocabSprint (Deno)

Usage:
  deno task dev
  deno task start

  deno run [permissions] cli.ts [options]

Options:
  -p, --port <number>         Port to listen on (env: PORT, default: 8000)
      --hostname <string>     Hostname to bind (env: HOSTNAME, default: 0.0.0.0)
      --words-file <path>     Words JSON path (env: WORDS_FILE)
      --kv-path <path>        Deno KV path (env: KV_PATH)
      --open                  Force open browser (may require --allow-run)
      --no-open               Disable auto open browser (env: NO_OPEN=1)
      --chdir                 Force chdir to app dir (compiled binary default)
      --no-chdir              Disable chdir behavior (env: NO_CHDIR=1)
  -h, --help                  Show this help

Precedence:
  CLI flags > environment variables > defaults
`);
}

const opts = parseCliOptions(Deno.args);

maybeChdirToAppDir(opts.chdir);

// Normalize relative paths once, after optional chdir.
const wordsFileResolved = isAbsolute(opts.wordsFile) ? opts.wordsFile : resolve(opts.wordsFile);
const kvPathResolved = isAbsolute(opts.kvPath) ? opts.kvPath : resolve(opts.kvPath);

const { url } = await startServer({
  hostname: opts.hostname,
  port: opts.port,
  wordsFile: wordsFileResolved,
  kvPath: kvPathResolved,
});

console.log(`Listening on ${url}`);

if (opts.open) {
  await openBrowser(url);
}
