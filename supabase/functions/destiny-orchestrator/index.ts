import {
  authenticate,
  BASE_SYSTEM,
  corsHeaders,
  hasHighRiskContent,
  json,
  openAIJson,
  requireUuid,
  safeText,
  todayInTimezone,
} from "../_shared/destiny.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2.57.4";

const PROMPT_VERSION = "destiny-harness-1.0.0";
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const ELEMENTS = ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"];
const DAY_MS = 86_400_000;
const ANCHOR_DAY = Date.UTC(1986, 2, 21);

const actionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string" },
    minutes: { type: "integer", minimum: 1, maximum: 120 },
    goal_link: { type: "string" },
    done_definition: { type: "string" },
    lite_version: { type: "string" },
    rationale: { type: "string" },
    guardian_line: { type: "string" },
  },
  required: ["action", "minutes", "goal_link", "done_definition", "lite_version", "rationale", "guardian_line"],
};

const readingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    reflection_question: { type: "string" },
    next_step: { type: "string" },
    safety_level: { type: "string", enum: ["normal", "caution"] },
  },
  required: ["answer", "reflection_question", "next_step", "safety_level"],
};

const proposalSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    patch: {
      type: "object",
      additionalProperties: false,
      properties: {
        patterns: { type: "array", items: { type: "string" } },
        strengths: { type: "array", items: { type: "string" } },
        risks: { type: "array", items: { type: "string" } },
        action_preferences: { type: "array", items: { type: "string" } },
      },
      required: ["patterns", "strengths", "risks", "action_preferences"],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    change_note: { type: "string" },
    evidence: { type: "array", items: { type: "string" } },
  },
  required: ["patch", "confidence", "change_note", "evidence"],
};

function dayStemFor(dateText: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new Error("INVALID_BIRTH_DATE");
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_BIRTH_DATE");
  const days = Math.round((date.getTime() - ANCHOR_DAY) / DAY_MS);
  const index = ((days % 10) + 10) % 10;
  return { stem: STEMS[index], element: ELEMENTS[index] };
}

async function loadContext(service: SupabaseClient, userId: string) {
  const [{ data: profile }, { data: goal }, { data: model }, { data: recent }] = await Promise.all([
    service.from("destiny_profiles").select("*").eq("user_id", userId).maybeSingle(),
    service.from("destiny_goals").select("*").eq("user_id", userId).eq("status", "active").maybeSingle(),
    service.from("destiny_self_models").select("*").eq("user_id", userId).eq("status", "active").maybeSingle(),
    service.from("destiny_daily_actions").select("action_date,status,failure_reason,minutes").eq("user_id", userId)
      .order("action_date", { ascending: false }).limit(7),
  ]);
  return { profile, goal, model, recent: recent ?? [] };
}

async function reserveUsage(service: SupabaseClient, userId: string, actionType: string, date: string, requestId: string) {
  const { data, error } = await service.from("destiny_ai_usage").insert({
    user_id: userId,
    action_type: actionType,
    usage_date: date,
    request_id: requestId,
    status: "started",
  }).select().single();
  if (!error) return { reserved: true, usage: data };
  if (error.code !== "23505") throw error;
  const { data: existing } = await service.from("destiny_ai_usage").select("*")
    .eq("user_id", userId).eq("action_type", actionType).eq("usage_date", date).maybeSingle();
  if (existing?.status === "refunded") {
    const { data: retried, error: retryError } = await service.from("destiny_ai_usage").update({
      request_id: requestId,
      status: "started",
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id).eq("status", "refunded").select().maybeSingle();
    if (retryError) throw retryError;
    if (retried) return { reserved: true, usage: retried };
  }
  return { reserved: false, usage: existing };
}

async function markUsage(service: SupabaseClient, id: string, status: string) {
  if (id) await service.from("destiny_ai_usage").update({ status }).eq("id", id);
}

async function saveBirth(req: Request, body: Record<string, unknown>) {
  const { userId, serviceClient } = await authenticate(req);
  const birthDate = safeText(body.birth_date, 10);
  const birthTime = safeText(body.birth_time, 8) || null;
  const birthCity = safeText(body.birth_city, 80);
  const birthCountry = safeText(body.birth_country, 80) || "台灣";
  const confidence = safeText(body.birth_time_confidence, 20);
  if (!birthCity || !["exact", "approximate", "unknown"].includes(confidence)) {
    return json(req, { error: "出生資料不完整" }, 400);
  }
  const { stem, element } = dayStemFor(birthDate);
  const timezone = safeText(body.timezone, 60) || "Asia/Taipei";
  const profile = {
    user_id: userId,
    display_name: safeText(body.display_name, 80) || null,
    timezone,
    birth_date: birthDate,
    birth_time: birthTime,
    birth_city: birthCity,
    birth_country: birthCountry,
    birth_time_confidence: confidence,
    day_stem: stem,
    day_element: element,
    journey_started_on: todayInTimezone(timezone),
  };
  const { error: profileError } = await serviceClient.from("destiny_profiles").upsert(profile);
  if (profileError) throw profileError;

  const { data: lastChart } = await serviceClient.from("destiny_birth_charts").select("version")
    .eq("user_id", userId).order("version", { ascending: false }).limit(1).maybeSingle();
  const chartVersion = (lastChart?.version ?? 0) + 1;
  const inputHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(profile)));
  const hash = Array.from(new Uint8Array(inputHash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  await serviceClient.from("destiny_birth_charts").insert({
    user_id: userId,
    version: chartVersion,
    calculator_version: "day-stem-anchor-0.1",
    input_hash: hash,
    chart: { day_stem: stem, day_element: element, precision: "initial", requires_full_solar_term_calculation: true },
  });

  const { data: activeModel } = await serviceClient.from("destiny_self_models").select("id")
    .eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!activeModel) {
    await serviceClient.from("destiny_self_models").insert({
      user_id: userId,
      version: 1,
      content: { fixed_layer: { day_stem: stem, element }, hypotheses: [], confirmed_patterns: [] },
      confidence: 0.1,
      change_note: "出生資料建立初始模型 V0",
      evidence_summary: ["出生資料"],
    });
  }
  return json(req, { profile, chart_version: chartVersion });
}

async function dailyAction(req: Request, body: Record<string, unknown>) {
  const { userId, serviceClient } = await authenticate(req);
  const requestId = requireUuid(body.request_id);
  const context = await loadContext(serviceClient, userId);
  if (!context.goal) return json(req, { error: "請先設定一個 90 天主目標" }, 409);
  const date = todayInTimezone(context.profile?.timezone);
  const { data: existing } = await serviceClient.from("destiny_daily_actions").select("*")
    .eq("user_id", userId).eq("action_date", date).maybeSingle();
  if (existing) return json(req, { action: existing, idempotent: true });

  const energy = Math.max(1, Math.min(5, Number(body.energy ?? 3)));
  const availableMinutes = Math.max(3, Math.min(240, Number(body.available_minutes ?? 20)));
  const reservation = await reserveUsage(serviceClient, userId, "daily_action", date, requestId);
  if (!reservation.reserved) return json(req, { error: "今日建議已產生，請重新整理" }, 409);

  try {
    const generated = await openAIJson(
      "destiny_daily_action",
      actionSchema,
      `${BASE_SYSTEM}\n任務時間不得超過使用者可用時間。若近期連續三次未完成，必須縮小任務。`,
      { ...context, today: date, energy, available_minutes: availableMinutes },
    );
    const { data, error } = await serviceClient.from("destiny_daily_actions").insert({
      user_id: userId,
      goal_id: context.goal.id,
      action_date: date,
      action_text: generated.action,
      minutes: Math.min(generated.minutes, availableMinutes),
      goal_link: generated.goal_link,
      done_definition: generated.done_definition,
      lite_version: generated.lite_version,
      rationale: generated.rationale,
      model_version: context.model?.version ?? 1,
      prompt_version: PROMPT_VERSION,
      request_id: requestId,
    }).select().single();
    if (error) throw error;
    await markUsage(serviceClient, reservation.usage.id, "succeeded");
    return json(req, { action: data, guardian_line: generated.guardian_line });
  } catch (error) {
    await markUsage(serviceClient, reservation.usage.id, "refunded");
    throw error;
  }
}

async function reading(req: Request, body: Record<string, unknown>) {
  const { userId, serviceClient } = await authenticate(req);
  const question = safeText(body.question);
  const category = safeText(body.category, 40) || "自由提問";
  const requestId = requireUuid(body.request_id);
  if (question.length < 2) return json(req, { error: "請輸入問題" }, 400);
  if (hasHighRiskContent(question)) {
    return json(req, {
      safety: true,
      answer: "這個問題牽涉到可能的即時安全或專業風險，我不會用命理解讀替你做決定。若有立即危險，請聯絡當地緊急服務；其他情況請尋求合格的醫療、法律或財務專業人員。",
    });
  }
  const context = await loadContext(serviceClient, userId);
  const date = todayInTimezone(context.profile?.timezone);
  const reservation = await reserveUsage(serviceClient, userId, "daily_reading", date, requestId);
  if (!reservation.reserved) {
    const { data: existing } = await serviceClient.from("destiny_ai_chats").select("*")
      .eq("user_id", userId).eq("chat_date", date).maybeSingle();
    return json(req, { used_today: true, reading: existing }, 409);
  }
  try {
    const generated = await openAIJson(
      "destiny_reading",
      readingSchema,
      `${BASE_SYSTEM}\n命理只能作為反思視角。先回應問題，再提出一個可由使用者驗證的反思問題與一個低風險下一步。`,
      { ...context, category, question, today: date },
    );
    const { data, error } = await serviceClient.from("destiny_ai_chats").insert({
      user_id: userId,
      chat_date: date,
      question,
      answer: generated.answer,
      category,
      model_version: context.model?.version ?? 1,
      prompt_version: PROMPT_VERSION,
      request_id: requestId,
    }).select().single();
    if (error) throw error;
    await markUsage(serviceClient, reservation.usage.id, "succeeded");
    return json(req, { reading: data, ...generated });
  } catch (error) {
    await markUsage(serviceClient, reservation.usage.id, "refunded");
    throw error;
  }
}

async function weeklyProposal(req: Request, body: Record<string, unknown>) {
  const { userId, serviceClient } = await authenticate(req);
  const reviewId = requireUuid(body.review_id, "review_id");
  const [{ data: review }, context] = await Promise.all([
    serviceClient.from("destiny_weekly_reviews").select("*").eq("id", reviewId).eq("user_id", userId).maybeSingle(),
    loadContext(serviceClient, userId),
  ]);
  if (!review) return json(req, { error: "找不到每週回顧" }, 404);
  const proposal = await openAIJson(
    "destiny_model_proposal",
    proposalSchema,
    `${BASE_SYSTEM}\n你只能提出模型更新草案，不得把一次回答永久化。每項更新至少引用一個真實回顧或行動證據。`,
    { review, ...context },
  );
  await serviceClient.from("destiny_weekly_reviews").update({ proposal, proposal_status: "pending" }).eq("id", reviewId);
  return json(req, { proposal });
}

async function acceptProposal(req: Request, body: Record<string, unknown>) {
  const { userId, serviceClient } = await authenticate(req);
  const reviewId = requireUuid(body.review_id, "review_id");
  const { data, error } = await serviceClient.rpc("destiny_accept_model_proposal", {
    p_user_id: userId,
    p_review_id: reviewId,
  });
  if (error) throw error;
  return json(req, { model: data });
}

async function recordAction(req: Request, body: Record<string, unknown>) {
  const { userId, serviceClient } = await authenticate(req);
  const actionId = requireUuid(body.action_id, "action_id");
  const status = safeText(body.status, 30);
  const allowed = ["completed", "partial", "not_completed", "not_suitable"];
  if (!allowed.includes(status)) return json(req, { error: "無效的完成狀態" }, 400);
  const { data, error } = await serviceClient.from("destiny_daily_actions").update({
    status,
    completion_note: safeText(body.completion_note, 500) || null,
    failure_reason: safeText(body.failure_reason, 100) || null,
  }).eq("id", actionId).eq("user_id", userId).select().maybeSingle();
  if (error) throw error;
  if (!data) return json(req, { error: "找不到今日行動" }, 404);
  return json(req, { action: data });
}

async function adminDashboard(req: Request) {
  const { userId, serviceClient } = await authenticate(req);
  const { data: admin } = await serviceClient.from("destiny_admins").select("user_id")
    .eq("user_id", userId).maybeSingle();
  if (!admin) return json(req, { error: "FORBIDDEN" }, 403);

  const periodDays = 30;
  const since = new Date(Date.now() - (periodDays - 1) * DAY_MS).toISOString().slice(0, 10);
  const activeSince = Date.now() - 7 * DAY_MS;
  const { data: authPage, error: authError } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) throw authError;
  const authUsers = authPage.users ?? [];
  const userIds = authUsers.map((user) => user.id);

  const empty = { data: [], error: null };
  const byUsers = <T>(query: T) => userIds.length ? query : Promise.resolve(empty);
  const [profilesResult, modelsResult, goalsResult, guardiansResult, usageResult, chatsResult, actionsResult] = await Promise.all([
    byUsers(serviceClient.from("destiny_profiles")
      .select("user_id,display_name,journey_completed_count,model_confidence,guardian_status,created_at,updated_at")
      .in("user_id", userIds)),
    byUsers(serviceClient.from("destiny_self_models")
      .select("user_id,version,confidence,created_at").eq("status", "active").in("user_id", userIds)),
    byUsers(serviceClient.from("destiny_goals")
      .select("user_id,status,updated_at").eq("status", "active").in("user_id", userIds)),
    byUsers(serviceClient.from("destiny_guardians")
      .select("user_id,status,updated_at").eq("is_active", true).in("user_id", userIds)),
    byUsers(serviceClient.from("destiny_ai_usage")
      .select("user_id,status,action_type,usage_date,updated_at").gte("usage_date", since).in("user_id", userIds)),
    byUsers(serviceClient.from("destiny_ai_chats")
      .select("user_id,created_at").gte("chat_date", since).in("user_id", userIds)),
    byUsers(serviceClient.from("destiny_daily_actions")
      .select("user_id,status,action_date,updated_at").gte("action_date", since).in("user_id", userIds)),
  ]);

  const firstError = [profilesResult, modelsResult, goalsResult, guardiansResult, usageResult, chatsResult, actionsResult]
    .find((result) => result.error)?.error;
  if (firstError) throw firstError;

  const profiles = new Map((profilesResult.data ?? []).map((item) => [item.user_id, item]));
  const models = new Map((modelsResult.data ?? []).map((item) => [item.user_id, item]));
  const goals = new Set((goalsResult.data ?? []).map((item) => item.user_id));
  const guardians = new Map((guardiansResult.data ?? []).map((item) => [item.user_id, item]));

  const usageByUser = new Map<string, { total: number; succeeded: number; refunded: number; last: string | null }>();
  for (const item of usageResult.data ?? []) {
    const aggregate = usageByUser.get(item.user_id) ?? { total: 0, succeeded: 0, refunded: 0, last: null };
    aggregate.total += 1;
    if (item.status === "succeeded") aggregate.succeeded += 1;
    if (item.status === "refunded") aggregate.refunded += 1;
    if (!aggregate.last || item.updated_at > aggregate.last) aggregate.last = item.updated_at;
    usageByUser.set(item.user_id, aggregate);
  }

  const activityByUser = new Map<string, string>();
  const noteActivity = (id: string, value?: string | null) => {
    if (!value) return;
    const current = activityByUser.get(id);
    if (!current || value > current) activityByUser.set(id, value);
  };
  for (const item of chatsResult.data ?? []) noteActivity(item.user_id, item.created_at);
  for (const item of actionsResult.data ?? []) noteActivity(item.user_id, item.updated_at);
  for (const item of usageResult.data ?? []) noteActivity(item.user_id, item.updated_at);
  for (const item of profilesResult.data ?? []) noteActivity(item.user_id, item.updated_at);

  const accounts = authUsers.map((user) => {
    const profile = profiles.get(user.id);
    const model = models.get(user.id);
    const guardian = guardians.get(user.id);
    const usage = usageByUser.get(user.id) ?? { total: 0, succeeded: 0, refunded: 0, last: null };
    const lastActivity = activityByUser.get(user.id) ?? user.last_sign_in_at ?? user.created_at;
    return {
      user_id: user.id,
      email: user.email ?? "",
      display_name: profile?.display_name ?? user.user_metadata?.full_name ?? "",
      registered_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      last_activity_at: lastActivity,
      onboarded: Boolean(profile),
      journey_progress: profile?.journey_completed_count ?? 0,
      model_version: model?.version ?? null,
      model_confidence: model?.confidence ?? profile?.model_confidence ?? null,
      guardian_status: guardian?.status ?? profile?.guardian_status ?? "not_started",
      has_active_goal: goals.has(user.id),
      ai_calls_30d: usage.total,
      ai_succeeded_30d: usage.succeeded,
      ai_refunded_30d: usage.refunded,
    };
  }).sort((a, b) => String(b.last_activity_at).localeCompare(String(a.last_activity_at)));

  const activeUsers7d = accounts.filter((account) =>
    account.last_activity_at && new Date(account.last_activity_at).getTime() >= activeSince
  ).length;

  await serviceClient.from("destiny_audit_logs").insert({
    actor_id: userId,
    action: "admin_dashboard_viewed",
    target_type: "account_usage_summary",
    metadata: { period_days: periodDays, account_count: accounts.length },
  });

  return json(req, {
    period_days: periodDays,
    metrics: {
      auth_users: authUsers.length,
      onboarded_users: profiles.size,
      active_users_7d: activeUsers7d,
      active_goals: goals.size,
      ai_calls_30d: (usageResult.data ?? []).length,
      refunded_ai_calls_30d: (usageResult.data ?? []).filter((item) => item.status === "refunded").length,
    },
    accounts,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  try {
    const body = await req.json() as Record<string, unknown>;
    switch (body.action) {
      case "save_birth": return await saveBirth(req, body);
      case "daily_action": return await dailyAction(req, body);
      case "reading": return await reading(req, body);
      case "weekly_proposal": return await weeklyProposal(req, body);
      case "accept_proposal": return await acceptProposal(req, body);
      case "record_action": return await recordAction(req, body);
      case "admin_dashboard": return await adminDashboard(req);
      default: return json(req, { error: "Unknown action" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "UNAUTHORIZED" ? 401 : message.startsWith("INVALID_") ? 400 : 500;
    console.error("destiny-orchestrator", message);
    return json(req, { error: status === 500 ? "服務暫時無法使用" : message }, status);
  }
});
