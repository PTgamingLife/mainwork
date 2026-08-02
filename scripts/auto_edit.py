#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
auto_edit.py — 口播影片自動剪輯 + B-roll 流水線 (可重複使用)

三個階段,分開跑,中間可插入 AI 生成 B-roll:

  1) cut      自動砍靜音/停頓 + 轉逐字稿 + 產出 B-roll 計畫草稿
              (會先查 Supabase 素材庫,有夠像的舊素材就直接填入,不用再生成)
              python auto_edit.py cut  我的口播.mp4 -o out/

  2) (Claude/人工) 把 plan 裡每段的 intent 寫成 3 個 prompt 變體 → 用 Higgsfield 生成
              把生成的影片檔填回 plan 裡每個項目的 "clip" 欄位,再登記進素材庫:
              python auto_edit.py library add 素材.mp4 --prompt "..." --intent "..."

  3) overlay  把 B-roll 疊回精剪影片的對應時間點 + (可選)燒字幕
              python auto_edit.py overlay out/cut.mp4 out/broll_plan.json -o 成品.mp4

設定值在下方 CONFIG 區塊,直接改數字即可。
相依: ffmpeg(自動偵測)、auto-editor、faster-whisper;素材庫需 config/.env 的
      SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY(沒設也能跑,只是不比對重用)。
"""
from __future__ import annotations
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / "config" / ".env")
except ModuleNotFoundError:
    pass  # dotenv 非必要;env 也可由外部直接提供

from src import broll_library as lib

# Windows 主控台預設 cp950,強制 stdout/stderr 走 utf-8 避免 emoji/中文崩潰
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ──────────────────────────── CONFIG ────────────────────────────
CONFIG = {
    # --- 精剪 (auto-editor 29) ---
    "silent_threshold": 0.04,   # 音量低於此值視為靜音 (0~1),越大砍越多
    "margin": "0.2s",           # 靜音前後保留時間,避免切太死 (可用 "6" 影格 或 "0.2s")

    # --- 轉錄 (faster-whisper) ---
    "whisper_model": "small",   # tiny/base/small/medium/large-v3,越大越準越慢
    "language": "zh",           # 口播語言;None=自動偵測

    # --- B-roll 計畫 ---
    # 節奏基準來自 reels-script/MODEL.md 第 9 條:單鏡口播的停留天花板是 6–7 秒,
    # 要求每 2–3 秒一個視覺變化。B-roll 只是節奏來源之一(另兩個是 jump cut 與
    # 螢幕錄影,見第 13、15 條),所以這裡抓「每 8 秒一段、每段 2.5 秒」,
    # 讓 B-roll 補的是 jump cut 之外的空檔,而不是每 18 秒才動一次。
    "broll_every_sec": 8,       # 大約每隔幾秒安排一段 B-roll
    "broll_len": 2.5,           # 每段 B-roll 顯示秒數
    "broll_min_gap": 5,         # 兩段 B-roll 至少間隔秒數
    "broll_skip_head_sec": 3.0,  # 開頭幾秒不放 B-roll — hook(0–3 秒)要留給臉/字卡
    "broll_style": "default",   # 風格 key(寫進 plan,供生成時套用固定視覺語彙)
    "broll_orientation": "vertical",   # Reels 直式;橫式片改 "horizontal"

    # --- 素材庫重用 ---
    "reuse_min_score": 0.28,    # 相似度門檻:過了就直接用舊素材,不再生成
    "reuse_cost_est": 0.05,     # 單段生成成本估值(美元),只用來估「省了多少」

    # --- 字幕 ---
    "burn_subtitles": True,     # overlay 階段是否燒上字幕
    "sub_fontsize": 16,

    # --- 質感優化 (enhance 階段) ---
    "enh_denoise": "hqdn3d=2:1.5:3:3",     # 降噪;設 "" 關閉
    "enh_skin": "smartblur=4:0.4:-0.3",    # 輕度磨皮(邊緣保留);ls大=磨更兇,lt負=只磨平坦區護五官
    "enh_eq": "eq=contrast=1.07:saturation=1.12:brightness=0.02:gamma=0.98",  # 調色
    "enh_warm": "colortemperature=temperature=5200",  # 暖色電影感;設 "" 關閉
    "enh_sharpen": "unsharp=5:5:0.8:5:5:0.0",  # 救回銳利度(磨皮後必留)
    "enh_vignette": "",         # 暗角,例 "vignette=PI/5";預設關
}
# ─────────────────────────────────────────────────────────────────


def find_ffmpeg(name: str) -> str:
    """先找 PATH,再找 winget 安裝路徑。"""
    exe = shutil.which(name)
    if exe:
        return exe
    base = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
    if base.exists():
        for hit in base.rglob(f"{name}.exe"):
            return str(hit)
    sys.exit(f"[ERROR] 找不到 {name},請先安裝 ffmpeg (winget install Gyan.FFmpeg)")


FFMPEG = find_ffmpeg("ffmpeg")
FFPROBE = find_ffmpeg("ffprobe")


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    print("  $", " ".join(str(c) for c in cmd[:6]), "..." if len(cmd) > 6 else "")
    return subprocess.run(cmd, check=True, **kw)


def video_size(path: str) -> tuple[int, int]:
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", path],
        capture_output=True, text=True, check=True).stdout.strip()
    w, h = out.split("x")
    return int(w), int(h)


def fmt_ts(sec: float) -> str:
    h = int(sec // 3600); m = int((sec % 3600) // 60)
    s = int(sec % 60); ms = int((sec - int(sec)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ─────────────────────────── STAGE 1: cut ───────────────────────────
def stage_cut(video: str, outdir: Path) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    cut_mp4 = outdir / "cut.mp4"

    # iPhone MOV 常含多條 metadata/data 軌會讓 auto-editor 解碼失敗;先只留主視訊+主音軌
    clean = outdir / "_clean.mp4"
    print("\n[0/3] 清理多餘軌道 (只留主視訊+主音軌) ...")
    run([FFMPEG, "-y", "-i", video, "-map", "0:v:0", "-map", "0:a:0",
         "-c", "copy", str(clean)])
    video = str(clean)

    print("\n[1/3] auto-editor 自動砍靜音/停頓 ...")
    run([sys.executable, "-m", "auto_editor", video,
         "--edit", f"audio:threshold={CONFIG['silent_threshold']}",
         "--margin", str(CONFIG["margin"]),
         "--no-open", "-o", str(cut_mp4)])

    print("\n[2/3] faster-whisper 轉逐字稿 (精剪後的時間軸) ...")
    from faster_whisper import WhisperModel
    model = WhisperModel(CONFIG["whisper_model"], device="cpu", compute_type="int8")
    segments, _ = model.transcribe(
        str(cut_mp4), language=CONFIG["language"], vad_filter=True)
    segs = [{"start": float(s.start), "end": float(s.end), "text": s.text.strip()}
            for s in segments]

    (outdir / "transcript.json").write_text(
        json.dumps(segs, ensure_ascii=False, indent=2), encoding="utf-8")

    srt = "\n".join(
        f"{i}\n{fmt_ts(s['start'])} --> {fmt_ts(s['end'])}\n{s['text']}\n"
        for i, s in enumerate(segs, 1))
    (outdir / "transcript.srt").write_text(srt, encoding="utf-8")

    print("\n[3/3] 產出 B-roll 計畫草稿 + 比對素材庫 ...")
    plan = build_broll_plan(segs)
    (outdir / "broll_plan.json").write_text(
        json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")

    reused = [p for p in plan if p["clip"]]
    todo = [p for p in plan if not p["clip"]]
    saved = len(reused) * CONFIG["reuse_cost_est"]

    print(f"\n✅ 完成。精剪影片: {cut_mp4}")
    print(f"   逐字稿:   {outdir/'transcript.srt'}")
    print(f"   B-roll計畫: {outdir/'broll_plan.json'}  ({len(plan)} 段)")
    print(f"   素材庫沿用 {len(reused)} 段(約省 ${saved:.2f}),待生成 {len(todo)} 段")
    print("\n下一步:把待生成那幾段的 intent 寫成 prompt(建議 3 個變體)→ 生成 → 填回 \"clip\",")
    print("        再用 `library add` 登記進素材庫,下次同題材就不用再生。")
    print("最後跑:  python auto_edit.py overlay", cut_mp4, outdir / "broll_plan.json", "-o 成品.mp4")


def build_broll_plan(segs: list[dict]) -> list[dict]:
    """依時間間隔挑句子排 B-roll 位置,並先查素材庫有沒有可直接沿用的。

    prompt 刻意留空:直接把中文逐字稿塞進英文模板(舊做法)會產生
    「illustrating: 我覺得這件事很重要」這種無法成像的句子。改成只給 intent,
    由 Claude 依 reels-script/MODEL.md 的視覺語彙寫成 3 個 prompt 變體。
    """
    plan: list[dict] = []
    last = float("-inf")
    for s in segs:
        if s["start"] < CONFIG["broll_skip_head_sec"]:
            continue
        if s["start"] - last < max(CONFIG["broll_every_sec"], CONFIG["broll_min_gap"]):
            continue
        if not s["text"]:
            continue
        last = s["start"]
        item = {
            "start": round(s["start"], 2),
            "end": round(s["start"] + CONFIG["broll_len"], 2),
            "based_on": s["text"],
            "intent": s["text"],       # ← 待精修成「這段畫面要表達什麼」
            "tags": [],                # ← 可手填,填了比對會更準
            "style": CONFIG["broll_style"],
            "prompt": "",              # ← 最終送生成的那一版
            "prompt_variants": [],     # ← 建議放 3 個變體(A/B 測)
            "clip": "",                # ← 生成或沿用後的影片路徑
            "asset_id": "",            # ← 沿用素材庫時自動填,overlay 會回寫使用紀錄
            "reuse": None,             # ← 命中素材庫時的比對資訊
        }
        hit = lib.best_match(
            s["text"], tags=None,
            orientation=CONFIG["broll_orientation"],
            min_score=CONFIG["reuse_min_score"])
        if hit:
            item["clip"] = hit["file_path"]
            item["asset_id"] = hit["id"]
            item["prompt"] = hit.get("prompt", "")
            item["reuse"] = {
                "score": round(float(hit.get("score", 0)), 3),
                "matched_intent": hit.get("intent") or hit.get("prompt", ""),
                "use_count": hit.get("use_count", 0),
            }
            print(f"   ♻ {item['start']:.1f}s 沿用既有素材 "
                  f"(分數 {item['reuse']['score']}): {Path(hit['file_path']).name}")
        plan.append(item)
    return plan


# ─────────────────────────── STAGE 3: overlay ───────────────────────────
def stage_overlay(cut_mp4: str, plan_path: str, output: str) -> None:
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    items = [p for p in plan if p.get("clip") and Path(p["clip"]).exists()]
    missing = [p for p in plan if not (p.get("clip") and Path(p["clip"]).exists())]
    if missing:
        print(f"[!] {len(missing)} 段尚未填入有效 clip,將略過。")
    W, H = video_size(cut_mp4)

    inputs = ["-i", cut_mp4]
    for it in items:
        inputs += ["-i", it["clip"]]

    filters, base = [], "[0:v]"
    for idx, it in enumerate(items, start=1):
        s, e = float(it["start"]), float(it["end"])
        filters.append(
            f"[{idx}:v]scale={W}:{H}:force_original_aspect_ratio=increase,"
            f"crop={W}:{H},setpts=PTS-STARTPTS+{s}/TB[b{idx}]")
        out = f"[v{idx}]"
        filters.append(
            f"{base}[b{idx}]overlay=enable='between(t,{s},{e})'{out}")
        base = out

    vchain = base
    srt = str(Path(plan_path).with_name("transcript.srt"))
    if CONFIG["burn_subtitles"] and Path(srt).exists():
        srt_esc = srt.replace("\\", "/").replace(":", "\\:")
        filters.append(
            f"{base}subtitles='{srt_esc}':force_style="
            f"'Fontsize={CONFIG['sub_fontsize']}'[vout]")
        vchain = "[vout]"

    if not filters:  # 沒有 B-roll 也沒字幕
        run([FFMPEG, "-y", "-i", cut_mp4, "-c", "copy", output])
        print(f"✅ (無 B-roll) 直接輸出: {output}")
        return

    cmd = [FFMPEG, "-y", *inputs,
           "-filter_complex", ";".join(filters),
           "-map", vchain, "-map", "0:a?",
           "-c:v", "libx264", "-crf", "20", "-preset", "medium",
           "-c:a", "aac", output]
    print(f"\n疊上 {len(items)} 段 B-roll" +
          (" + 燒字幕" if vchain == "[vout]" else "") + " ...")
    run(cmd)
    print(f"\n✅ 成品輸出: {output}")

    # 回寫使用紀錄:哪支影片在第幾秒用了哪段素材(觸發器會累加 use_count)
    slug = Path(output).stem
    logged = sum(
        1 for it in items
        if it.get("asset_id")
        and lib.record_usage(it["asset_id"], slug, float(it["start"]), float(it["end"])))
    if logged:
        print(f"   已記錄 {logged} 段素材使用紀錄(video_slug={slug})")


# ─────────────────────────── STAGE: enhance ───────────────────────────
def stage_enhance(video: str, output: str) -> None:
    """本機調色 + 輕度磨皮 + 銳化,順序:降噪→磨皮→調色→暖色→銳化→暗角。"""
    chain = [CONFIG[k] for k in
             ("enh_denoise", "enh_skin", "enh_eq", "enh_warm",
              "enh_sharpen", "enh_vignette") if CONFIG[k]]
    if not chain:
        sys.exit("[ERROR] enhance 全部關閉,沒東西可做(檢查 CONFIG enh_*)")
    vf = ",".join(chain)
    print("質感優化 filter:", vf)
    run([FFMPEG, "-y", "-i", video, "-vf", vf,
         "-c:v", "libx264", "-crf", "19", "-preset", "medium",
         "-c:a", "copy", output])
    print(f"\n✅ 優化輸出: {output}")


# ─────────────────────────── STAGE: library ───────────────────────────
def probe_clip(path: str) -> dict:
    """取素材的長度與尺寸,登記時一併寫進庫。"""
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height:format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", path],
        capture_output=True, text=True, check=True).stdout.split()
    info: dict = {}
    if len(out) >= 2:
        info["width"], info["height"] = int(out[0]), int(out[1])
    if len(out) >= 3:
        info["duration_sec"] = round(float(out[2]), 2)
    return info


def stage_library_add(args) -> None:
    if not lib.available():
        sys.exit("[ERROR] 未設定 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY,無法登記素材。")
    tags = [t.strip() for t in (args.tags or "").split(",") if t.strip()]
    row = lib.register(
        args.clip, prompt=args.prompt, intent=args.intent, tags=tags,
        style=args.style, source=args.source, provider=args.provider,
        model=args.model, cost_usd=args.cost, notes=args.notes,
        **probe_clip(args.clip))
    if not row:
        sys.exit("[ERROR] 登記失敗。")
    print(f"✅ 已登記: {row['id']}  {Path(args.clip).name}")


def stage_library_search(args) -> None:
    hits = lib.search(args.query, orientation=args.orientation, limit=args.limit)
    if not hits:
        print("找不到可重用的素材。")
        return
    for h in hits:
        print(f"[{float(h['score']):.3f}] {Path(h['file_path']).name}  "
              f"用過 {h['use_count']} 次  {h.get('intent') or h['prompt']}")


# ─────────────────────────────── CLI ───────────────────────────────
def main() -> None:
    ap = argparse.ArgumentParser(description="口播影片自動剪輯 + B-roll 流水線")
    sub = ap.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("cut", help="砍靜音 + 轉錄 + 產 B-roll 計畫")
    c.add_argument("video")
    c.add_argument("-o", "--outdir", default="out")

    o = sub.add_parser("overlay", help="疊 B-roll + 燒字幕")
    o.add_argument("cut_mp4")
    o.add_argument("plan")
    o.add_argument("-o", "--output", default="final.mp4")

    e = sub.add_parser("enhance", help="調色 + 磨皮 + 銳化 質感優化")
    e.add_argument("video")
    e.add_argument("-o", "--output", default="enhanced.mp4")

    lb = sub.add_parser("library", help="B-roll 素材庫 (Supabase)")
    lbs = lb.add_subparsers(dest="libcmd", required=True)

    la = lbs.add_parser("add", help="把一段素材登記進庫")
    la.add_argument("clip")
    la.add_argument("--prompt", required=True, help="生成用的英文 prompt")
    la.add_argument("--intent", default="", help="中文:這段畫面表達什麼")
    la.add_argument("--tags", default="", help="逗號分隔")
    la.add_argument("--style", default=CONFIG["broll_style"])
    la.add_argument("--source", default="higgsfield",
                    choices=["higgsfield", "stock", "self", "other"])
    la.add_argument("--provider", default="")
    la.add_argument("--model", default="")
    la.add_argument("--cost", type=float, default=0.0, help="這段花了多少美元")
    la.add_argument("--notes", default="")

    ls = lbs.add_parser("search", help="查有沒有可重用的素材")
    ls.add_argument("query")
    ls.add_argument("--orientation", default=CONFIG["broll_orientation"],
                    choices=["vertical", "horizontal"])
    ls.add_argument("--limit", type=int, default=5)

    args = ap.parse_args()
    if args.cmd == "cut":
        stage_cut(args.video, Path(args.outdir))
    elif args.cmd == "overlay":
        stage_overlay(args.cut_mp4, args.plan, args.output)
    elif args.cmd == "enhance":
        stage_enhance(args.video, args.output)
    elif args.cmd == "library":
        (stage_library_add if args.libcmd == "add" else stage_library_search)(args)


if __name__ == "__main__":
    main()
