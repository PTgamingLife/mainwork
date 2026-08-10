import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// 工作大腦 embedding gateway
// action=ingest  { title, content, categories[], work_id?, type?, source_url? }
// action=search  { query, match_count?, categories? }
//
// 部署: supabase functions deploy brain --project-ref hhcubvixldieuwdeqnwc
// 需要的 secret: supabase secrets set OPENAI_API_KEY=... --project-ref hhcubvixldieuwdeqnwc

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMBED_MODEL = "text-embedding-3-small"; // 1536 dims

async function embed(text: string): Promise<number[]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.data[0].embedding;
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    const body = await req.json();
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (body.action === "ingest") {
      const { title, content, categories, work_id, type, source_url } = body;
      if (!content || !categories?.length) return json({ error: "content and categories required" }, 400);
      const vec = await embed(`${title ?? ""}\n${content}`);
      const { data, error } = await sb.rpc("brain_ingest_knowledge", {
        p_title: title ?? null, p_content: content, p_categories: categories,
        p_embedding: vec, p_work_id: work_id ?? null, p_type: type ?? "note", p_source_url: source_url ?? null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ id: data });
    }

    if (body.action === "search") {
      const { query, match_count, categories } = body;
      if (!query) return json({ error: "query required" }, 400);
      const vec = await embed(query);
      const { data, error } = await sb.rpc("brain_match_knowledge", {
        query_embedding: vec, match_count: match_count ?? 8, filter_categories: categories ?? null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ results: data });
    }

    return json({ error: "unknown action (use ingest | search)" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
