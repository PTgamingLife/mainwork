#!/usr/bin/env node
// 從 ~/.claude/skills/*/SKILL.md 產生 / 更新 skills.json
// 規則:已存在的條目(手動精修過的)保留;只補上尚未收錄的新 skill。
// 機密不會進來:只讀 frontmatter 的 name + description(本來就無機密)。
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = process.env.SKILLS_DIR || join(os.homedir(), ".claude", "skills");
const OUT = join(__dirname, "skills.json");

function parseFrontmatter(md) {
  const m = md.match(/^---\s*([\s\S]*?)\s*---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) fm[kv[1].trim()] = kv[2].trim();
  }
  return fm;
}

function guessCategory(text) {
  const t = text.toLowerCase();
  if (/test|playwright|測試|驗證/.test(t)) return "測試";
  if (/api|supabase|edge|後端|server|proxy|金鑰/.test(t)) return "後端/API";
  if (/風險|規劃|plan|mortem|決策/.test(t)) return "規劃";
  if (/css|html|前端|ui|畫面/.test(t)) return "前端";
  if (/資料|database|sql|data/.test(t)) return "資料";
  return "其他";
}

const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { core: { id:"core", name:"技能核心", summary:"我用 /done 累積的技能總集。" }, skills: [] };
const byId = new Map(existing.skills.map(s => [s.id, s]));

if (existsSync(SKILLS_DIR)) {
  for (const name of readdirSync(SKILLS_DIR)) {
    const skillFile = join(SKILLS_DIR, name, "SKILL.md");
    if (!existsSync(skillFile) || !statSync(skillFile).isFile()) continue;
    if (byId.has(name)) continue; // 已收錄,保留精修版
    const fm = parseFrontmatter(readFileSync(skillFile, "utf8"));
    const desc = fm.description || "";
    existing.skills.push({
      id: name,
      name: fm.name || name,
      category: guessCategory(name + " " + desc),
      summary: desc.slice(0, 120),
      tags: name.split(/[-_]/).filter(Boolean)
    });
    byId.set(name, true);
    console.log("＋ 新增星點:", name);
  }
}

writeFileSync(OUT, JSON.stringify(existing, null, 2) + "\n", "utf8");
console.log(`完成,共 ${existing.skills.length} 顆技能星 → ${OUT}`);
