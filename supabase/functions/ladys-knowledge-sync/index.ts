// LadyS — 每晚把 GitHub 工作紀錄精簡進 ladys_knowledge(pg_cron → 這裡,x-ladys-key 驗證)
//   supabase functions deploy ladys-knowledge-sync --no-verify-jwt
// 只處理「推送時間有變」的 repo:repo 摘要、mainwork 子資料夾作品、MODEL.md、每週工作紀錄。
// body 可帶 { max: 數字 } 限制這次最多處理幾個 repo(預設 50)。secrets:見 _shared/ladys-github.ts
import { ladysCheckCronKey, ladysInsert, ladysJson, ladysSelect } from "../_shared/ladys.ts";
import {
  LADYS_GH_OWNER, type LadysCommit, ladysClean, ladysCondense, ladysGh, ladysGhCommits, ladysGhRepos, ladysHasGhToken,
  ladysIsoWeek, ladysPool,
} from "../_shared/ladys-github.ts";

const MAIN = "mainwork";
const S = { type: "string" };
const ONE = { type: "object", additionalProperties: false, required: ["title", "summary"], properties: { title: S, summary: S } };
const DIRS = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["dir", "title", "summary"], properties: { dir: S, title: S, summary: S } } } },
};
const WEEK_KEEP = 26 * 7 * 864e5;

async function upsert(rows: any[]) {
  if (rows.length) await ladysInsert("ladys_knowledge?on_conflict=ladys_key", rows.map((r) => ({ ...r, ladys_updated_at: new Date().toISOString() })),
    "resolution=merge-duplicates,return=minimal");
}

// 一般 repo:README + 根目錄 + 最近 commit → 一列 project
async function syncRepo(r: any, commits: LadysCommit[]) {
  const [readme, root] = await Promise.all([
    ladysGh(`/repos/${LADYS_GH_OWNER}/${r.name}/readme`, true).catch(() => null),
    ladysGh(`/repos/${LADYS_GH_OWNER}/${r.name}/contents/`).catch(() => null),
  ]);
  const files = Array.isArray(root) ? root.map((f: any) => f.name).slice(0, 60).join("、") : "";
  const out = await ladysCondense(
    `repo:${r.name}(${r.private ? "私人" : "公開"},最後推送 ${String(r.pushed_at).slice(0, 10)})\n說明:${r.description ?? ""}\n` +
    `網站:${r.homepage || (r.has_pages ? `https://ptgaminglife.github.io/${r.name}/` : "")}\n根目錄:${files}\n` +
    `最近 commit:\n${commits.map((c) => `${c.date} ${c.msg}`).join("\n")}\n\nREADME:\n${String(readme ?? "").slice(0, 12000)}\n\n` +
    "title:作品名稱(15 字內);summary:300~500 字,含做什麼、目前進度、最近在改什麼、網址。", ONE, 1500);
  await upsert([{ ladys_kind: "project", ladys_key: `repo:${r.name}`, ladys_repo: r.name, ladys_title: ladysClean(out.title, 40),
    ladys_summary: ladysClean(out.summary, 1200), ladys_source_sha: commits[0]?.date ?? "", ladys_pushed_at: r.pushed_at }]);
}

// mainwork:子資料夾各算一個作品 + 每份 MODEL.md 一列
async function syncMain(r: any, commits: LadysCommit[]) {
  const tree = (await ladysGh(`/repos/${LADYS_GH_OWNER}/${MAIN}/git/trees/${r.default_branch}?recursive=1`))?.tree ?? [];
  const dirs = [...new Set(tree.filter((t: any) => t.type === "tree" && !t.path.includes("/") && !t.path.startsWith(".")).map((t: any) => t.path))];
  const files = tree.filter((t: any) => t.type === "blob").map((t: any) => t.path);
  const outline = dirs.map((d: any) => `${d}/:${files.filter((f: string) => f.startsWith(`${d}/`)).slice(0, 12).map((f: string) => f.slice(d.length + 1)).join("、")}`).join("\n");
  const out = await ladysCondense(
    `mainwork 是個人作品工作台,每個子資料夾大多是一個作品。\n資料夾與部分檔案:\n${outline.slice(0, 20000)}\n\n最近 commit:\n` +
    `${commits.map((c) => `${c.date} ${c.msg}`).join("\n")}\n\n` +
    "items:只列「作品」資料夾(略過 docs、scripts、src、tests、archive 這類工具資料夾),每個:dir 資料夾名、title 作品名稱(15 字內)、" +
    "summary 150~300 字(做什麼、目前進度、最近在改什麼;網址為 https://ptgaminglife.github.io/mainwork/<dir>/)。", DIRS, 8000);
  await upsert((out.items ?? []).filter((x: any) => dirs.includes(x.dir)).map((x: any) => ({
    ladys_kind: "project", ladys_key: `dir:${MAIN}/${x.dir}`, ladys_repo: MAIN, ladys_title: ladysClean(x.title, 40),
    ladys_summary: ladysClean(x.summary, 1200), ladys_source_sha: commits[0]?.date ?? "", ladys_pushed_at: r.pushed_at,
  })));
  // 總覽列(也當「這個 repo 處理到哪次推送」的記號)
  const list = (out.items ?? []).map((x: any) => `${x.dir}(${ladysClean(x.title, 20)})`).join("、");
  await upsert([{ ladys_kind: "project", ladys_key: `repo:${MAIN}`, ladys_repo: MAIN, ladys_title: "mainwork 作品工作台",
    ladys_summary: ladysClean(`個人作品工作台(靜態網頁作品 + Supabase 後端 + 自動化 scripts + 自製 skills)。作品:${list}`, 1200),
    ladys_source_sha: commits[0]?.date ?? "", ladys_pushed_at: r.pushed_at }]);

  const models = tree.filter((t: any) => t.type === "blob" && /(^|\/)MODEL\.md$/.test(t.path));
  const have = new Map((await ladysSelect("ladys_knowledge", "ladys_kind=eq.model&select=ladys_key,ladys_source_sha")).map((x: any) => [x.ladys_key, x.ladys_source_sha]));
  const todo = models.filter((m: any) => have.get(`model:${m.path}`) !== m.sha);
  await ladysPool(todo, 4, async (m: any) => {
    const text = await ladysGh(`/repos/${LADYS_GH_OWNER}/${MAIN}/contents/${m.path}`, true);
    const o = await ladysCondense(`模型檔 ${m.path}:\n${String(text ?? "").slice(0, 40000)}\n\n` +
      "title:這份模型在管什麼(15 字內);summary:500~800 字,保留目標、關鍵數字、目前策略與規則、最新校正結論。", ONE, 2000);
    await upsert([{ ladys_kind: "model", ladys_key: `model:${m.path}`, ladys_repo: MAIN, ladys_title: ladysClean(o.title, 40),
      ladys_summary: ladysClean(o.summary, 1200), ladys_source_sha: m.sha, ladys_pushed_at: r.pushed_at }]);
  });
  return { dirs: out.items?.length ?? 0, models: todo.length };
}

// 每週工作紀錄:有新 commit 的週重算(已存過、且不是最近兩週的就不動)
async function syncWeeks(commits: LadysCommit[]) {
  const recent = commits.filter((c) => Date.now() - new Date(c.date).getTime() < WEEK_KEEP);
  const byWeek = new Map<string, LadysCommit[]>();
  for (const c of recent) { const w = ladysIsoWeek(c.date); byWeek.set(w, [...(byWeek.get(w) ?? []), c]); }
  const have = new Set((await ladysSelect("ladys_knowledge", "ladys_kind=eq.worklog&select=ladys_key")).map((x: any) => x.ladys_key));
  const today = new Date().toISOString().slice(0, 10);
  const fresh = new Set([ladysIsoWeek(today), ladysIsoWeek(new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10))]);
  const todo = [...byWeek].filter(([w]) => !have.has(`week:${w}`) || fresh.has(w));
  const old = await ladysSelect("ladys_knowledge", `ladys_key=in.(${todo.map(([w]) => `"week:${w}"`).join(",") || '""'})&select=ladys_key,ladys_summary`);
  await ladysPool(todo, 4, async ([w, list]) => {
    const prev = old.find((x: any) => x.ladys_key === `week:${w}`)?.ladys_summary ?? "";
    const o = await ladysCondense(`${w} 這週的 commit(repo 日期 訊息):\n${list.map((c) => `${c.repo} ${c.date} ${c.msg}`).join("\n").slice(0, 30000)}\n` +
      (prev ? `\n之前存的這週摘要(可能少了其他 repo,請合併):\n${prev}\n` : "") +
      "\ntitle:這週重點(15 字內);summary:200~500 字,依作品分點寫這週完成了什麼、改了什麼。", ONE, 1500);
    await upsert([{ ladys_kind: "worklog", ladys_key: `week:${w}`, ladys_title: `${w} ${ladysClean(o.title, 30)}`, ladys_summary: ladysClean(o.summary, 1200) }]);
  });
  return todo.length;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ladysJson({ error: "METHOD" }, 405);
  if (!(await ladysCheckCronKey(req))) return ladysJson({ error: "UNAUTHORIZED" }, 401);
  let max = 50;
  try { const b = await req.json(); if (Number(b?.max) > 0) max = Math.min(100, Number(b.max)); } catch { /* 預設 */ }
  try {
    const repos = await ladysGhRepos();
    const seen = new Map((await ladysSelect("ladys_knowledge", "ladys_kind=eq.project&select=ladys_key,ladys_pushed_at"))
      .map((x: any) => [x.ladys_key, x.ladys_pushed_at ? new Date(x.ladys_pushed_at).getTime() : 0]));
    const changed = repos.filter((r: any) => r.pushed_at && seen.get(`repo:${r.name}`) !== new Date(r.pushed_at).getTime()).slice(0, max);

    const all: LadysCommit[] = [];
    const errors: string[] = [];
    let main: unknown = null;
    const res = await ladysPool(changed, 5, async (r: any) => {
      const commits = await ladysGhCommits(r.name, r.name === MAIN ? 100 : 30);
      all.push(...commits);
      if (r.name === MAIN) main = await syncMain(r, commits); else await syncRepo(r, commits);
    });
    res.forEach((x, i) => { if (x.status === "rejected") errors.push(`${changed[i].name}:${String(x.reason?.message ?? x.reason).slice(0, 80)}`); });
    let weeks = 0;
    try { weeks = await syncWeeks(all); } catch (e) { errors.push(`weeks:${String(e instanceof Error ? e.message : e).slice(0, 80)}`); }
    const detail = { token: ladysHasGhToken(), repos: repos.length, changed: changed.length, main, weeks, errors };
    if (errors.length) console.error("ladys knowledge", errors);
    return ladysJson({ ok: true, ...detail });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ladys knowledge error", msg);
    return ladysJson({ error: msg.slice(0, 200) }, 500);
  }
});
