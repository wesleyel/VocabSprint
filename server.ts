import { serveDir, serveFile } from "jsr:@std/http/file-server";
import { loadWords } from "./src/words.ts";
import { openStatusStore } from "./src/status_store.ts";

export type ServerOptions = {
  hostname?: string;
  port: number;
  wordsFile: string;
  kvPath: string;
};

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function badRequest(message: string) {
  return json({ ok: false, error: message }, { status: 400 });
}

export async function startServer(opts: ServerOptions): Promise<{ url: string }>
{
  const hostname = opts.hostname ?? "0.0.0.0";
  const port = opts.port;
  const words = await loadWords(opts.wordsFile);
  const store = await openStatusStore(opts.kvPath);

  const handler = async (req: Request) => {
    const url = new URL(req.url);

    // Pages
    if (url.pathname === "/") {
      return Response.redirect(new URL("/table", url), 302);
    }
    if (url.pathname === "/table") {
      return serveFile(req, "public/table.html");
    }
    if (url.pathname === "/card") {
      return serveFile(req, "public/card.html");
    }

    // API
    if (url.pathname === "/api/words" && req.method === "GET") {
      const statuses = await store.getAllStatuses();
      const vocabs = await store.getAllVocab();
      const items = words.map((w) => ({
        id: w.id,
        rank: w.rank,
        freq: w.freq,
        word: w.word,
        meaning: w.meaning,
        other: w.other,
        mastered: statuses.get(w.id) ?? false,
        vocab: vocabs.get(w.id) ?? false,
      }));
      return json({ ok: true, items });
    }

    if (url.pathname === "/api/status" && req.method === "POST") {
      let payload: unknown;
      try {
        payload = await req.json();
      } catch {
        return badRequest("Invalid JSON");
      }

      if (
        !payload || typeof payload !== "object" ||
        !("id" in payload) || !("mastered" in payload)
      ) {
        return badRequest("Body must be { id: number, mastered: boolean }");
      }

      const id = (payload as { id: unknown }).id;
      const mastered = (payload as { mastered: unknown }).mastered;

      if (!Number.isInteger(id)) return badRequest("id must be an integer");
      if (typeof mastered !== "boolean") return badRequest("mastered must be boolean");

      const exists = words.some((w) => w.id === id);
      if (!exists) return badRequest("Unknown id");

      await store.setMastered(id as number, mastered);
      return json({ ok: true });
    }

    if (url.pathname === "/api/vocab" && req.method === "POST") {
      let payload: unknown;
      try {
        payload = await req.json();
      } catch {
        return badRequest("Invalid JSON");
      }

      if (!payload || typeof payload !== "object" || !("id" in payload) || !("vocab" in payload)) {
        return badRequest("Body must be { id: number, vocab: boolean }");
      }

      const id = (payload as { id: unknown }).id;
      const vocab = (payload as { vocab: unknown }).vocab;

      if (!Number.isInteger(id)) return badRequest("id must be an integer");
      if (typeof vocab !== "boolean") return badRequest("vocab must be boolean");

      const exists = words.some((w) => w.id === id);
      if (!exists) return badRequest("Unknown id");

      await store.setVocab(id as number, vocab);
      return json({ ok: true });
    }

    // Static assets
    if (
      url.pathname.startsWith("/style") || url.pathname.startsWith("/app_") ||
      url.pathname.startsWith("/assets/")
    ) {
      return serveDir(req, {
        fsRoot: "public",
        urlRoot: "",
        showDirListing: false,
        quiet: true,
      });
    }

    return new Response("Not Found", { status: 404 });
  };

  Deno.serve({ hostname, port }, handler);
  return { url: `http://localhost:${port}/` };
}
