import { serveDir, serveFile } from "jsr:@std/http/file-server";
import { loadWords } from "./src/words.ts";
import { openStatusStore } from "./src/status_store.ts";

const WORDS_FILE = Deno.env.get("WORDS_FILE") ?? "./netem_full_list.json";
const KV_PATH = Deno.env.get("KV_PATH") ?? "./data/kv";

const words = await loadWords(WORDS_FILE);
const store = await openStatusStore(KV_PATH);

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function badRequest(message: string) {
  return json({ ok: false, error: message }, { status: 400 });
}

Deno.serve(async (req) => {
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
    const items = words.map((w) => ({
      id: w.id,
      rank: w.rank,
      freq: w.freq,
      word: w.word,
      meaning: w.meaning,
      other: w.other,
      mastered: statuses.get(w.id) ?? false,
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

    await store.setMastered(id, mastered);
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
});
