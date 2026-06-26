/**
 * LINE Webhook — Supabase Edge Function
 * Receives LINE group messages, detects "確認" keyword,
 * writes to line_confirmations table to trigger Phase 2.
 *
 * Deploy:
 *   supabase functions deploy line-webhook --no-verify-jwt
 *
 * Set LINE webhook URL in LINE Developer Console to:
 *   https://hhcubvixldieuwdeqnwc.supabase.co/functions/v1/line-webhook
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONFIRM_KEYWORDS = ["確認", "confirm", "ok", "OK", "確认"];
const ANALYSIS_KEYWORDS = ["分析", "analyze", "analysis"];

Deno.serve(async (req: Request) => {
  // LINE sends POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const events = (body?.events as unknown[]) ?? [];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  for (const event of events) {
    const ev = event as Record<string, unknown>;
    if (ev.type !== "message") continue;

    const msg = ev.message as Record<string, unknown>;
    if (msg?.type !== "text") continue;

    const text = (msg.text as string ?? "").trim();
    const today = new Date().toISOString().split("T")[0];

    // ── 確認：觸發 Phase 2 圖片發送 ────────────────────────────────────────
    if (CONFIRM_KEYWORDS.some((kw) => text.includes(kw))) {
      const { data: configRow } = await supabase
        .from("bot_config")
        .select("value")
        .eq("key", "day_counter")
        .maybeSingle();

      const dayNumber = parseInt(configRow?.value ?? "1", 10);

      const { error } = await supabase
        .from("line_confirmations")
        .upsert(
          { confirm_date: today, day_number: dayNumber, images_sent: false },
          { onConflict: "confirm_date", ignoreDuplicates: true },
        );

      if (error) {
        console.error("DB upsert error:", error.message);
      } else {
        console.log(`確認已記錄 — ${today} Day ${dayNumber}`);
      }
    }

    // ── 分析：觸發 IG 貼文分析 ──────────────────────────────────────────────
    if (ANALYSIS_KEYWORDS.some((kw) => text.includes(kw))) {
      const { error } = await supabase
        .from("ig_analysis_requests")
        .upsert(
          { request_date: today, status: "pending" },
          { onConflict: "request_date", ignoreDuplicates: false },
        );

      if (error) {
        console.error("IG analysis upsert error:", error.message);
      } else {
        console.log(`IG 分析請求已記錄 — ${today}`);
      }
    }
  }

  // LINE expects 200 OK quickly
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
