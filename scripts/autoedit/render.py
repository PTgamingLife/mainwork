# -*- coding: utf-8 -*-
"""render 階段:依 edit_plan.json 疊 B-roll/貼圖 + (可選)調色/裁切/字幕。

edit_plan.json:
{
  "video": "來源影片",
  "no_cut": true,            // 預設 true=整段保留(已移除自動剪輯)
  "enhance": false,          // true=調色磨皮
  "burn_subtitles": false,   // true=用 cards 燒字幕
  "segments": [ {"id":1,"start":0,"end":80,"cards":[...],"overlay":null} ],
  "overlays": [              // 明確時間窗 overlay
     {"type":"broll","clip":"b.mp4","start":2,"end":7},
     {"type":"sticker","asset":"logo.png","start":10,"end":13},
     {"type":"counter","from":133,"to":34000,"label":"瀏覽率","start":1,"end":4},
     {"type":"ring|loop|flow|clone|text", ...}
  ]
}
"""
from __future__ import annotations
import json
import tempfile
from pathlib import Path

from .common import CONFIG, FFMPEG, run, fmt_ts
from .stickers import build_sticker

GRAPHIC_TYPES = ("counter", "text", "ring", "loop", "flow", "clone")


def _enhance_vf(w=1080, h=1920) -> str:
    parts = []
    if CONFIG["enh_scale"]:
        parts.append(f"scale={CONFIG['enh_scale']}")
    for k in ("enh_denoise", "enh_skin", "enh_eq", "enh_warm", "enh_sharpen"):
        if CONFIG[k]:
            parts.append(CONFIG[k])
    parts.append(f"crop={w}:{h}:(iw-{w})/2:(ih-{h})/2")
    return ",".join(parts)


def render(plan_path: str, output: str) -> None:
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    video = plan["video"]
    kept = plan["segments"]
    if not kept:
        raise SystemExit("[render] edit_plan 沒有任何片段")
    work = Path(tempfile.mkdtemp(prefix="ae_render_"))
    do_enh = plan.get("enhance", False)
    do_subs = plan.get("burn_subtitles", False)
    no_cut = plan.get("no_cut", True)    # 預設整段保留(已移除自動剪輯)
    vf = _enhance_vf() if do_enh else \
        "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"

    if no_cut:
        print("[render] no_cut:直接用原片當底 ...")
        body = Path(video)
    else:
        print(f"[render] 裁切{'+ 調色' if do_enh else ''} {len(kept)} 段 ...")
        clips = []
        for i, s in enumerate(kept):
            clip = work / f"seg_{i:02d}.mp4"
            run([FFMPEG, "-y", "-i", video, "-ss", str(s["start"]), "-to",
                 str(s["end"]), "-vf", vf, "-r", "30", "-c:v", "libx264",
                 "-crf", "20", "-preset", "veryfast", "-c:a", "aac", "-ar",
                 "48000", "-ac", "2", str(clip)])
            clips.append(clip)
        concat_txt = work / "concat.txt"
        concat_txt.write_text(
            "".join(f"file '{c.as_posix()}'\n" for c in clips), encoding="utf-8")
        body = work / "body.mp4"
        run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_txt),
             "-c", "copy", str(body)])

    # 計算(裁切後的)新時間軸,建字幕、蒐集段級 overlay
    srt_lines, idx, new_t = [], 1, 0.0
    brolls, stickers, graphics = [], [], []
    for s in kept:
        seg_dur = s["end"] - s["start"]
        ov = s.get("overlay")
        if ov and ov.get("type") == "broll" and ov.get("clip"):
            brolls.append((ov["clip"], new_t, new_t + seg_dur))
        elif ov and ov.get("type") == "sticker" and ov.get("asset"):
            stickers.append((ov["asset"], new_t, new_t + seg_dur))
        elif ov and ov.get("type") in GRAPHIC_TYPES:
            graphics.append((ov, new_t, new_t + seg_dur))
        if do_subs:
            cards = s.get("cards") or [{"start": s["start"], "end": s["end"],
                                        "text": s.get("text", "")}]
            for c in cards:
                cs = new_t + (c["start"] - s["start"])
                ce = new_t + (c["end"] - s["start"])
                srt_lines.append(
                    f"{idx}\n{fmt_ts(cs)} --> {fmt_ts(ce)}\n{c['text']}\n")
                idx += 1
        new_t += seg_dur

    # 明確時間窗 overlay(給不裁切的連續影片:直接指定秒數)
    for ov in plan.get("overlays", []):
        s, e = float(ov["start"]), float(ov["end"])
        t = ov.get("type")
        if t == "broll" and ov.get("clip"):
            brolls.append((ov["clip"], s, e))
        elif t == "sticker" and ov.get("asset"):
            stickers.append((ov["asset"], s, e))
        elif t in GRAPHIC_TYPES:
            graphics.append((ov, s, e))
    srt = work / "subs.srt"
    srt.write_text("\n".join(srt_lines), encoding="utf-8")

    # 合成:body + B-roll(全屏) + 圖貼(上方) + 動畫貼圖 + 字幕
    inputs = ["-i", str(body)]
    filt, base, n = [], "[0:v]", 1
    if no_cut:   # no_cut 沒經過裁切階段 → 在此把底圖縮放到1080(+可選調色)
        filt.append(f"[0:v]{vf}[v0]")
        base = "[v0]"
    for clip, s, e in brolls:
        inputs += ["-i", clip]
        filt.append(f"[{n}:v]scale=1080:1920:force_original_aspect_ratio=increase,"
                    f"crop=1080:1920,setpts=PTS-STARTPTS+{s}/TB[b{n}]")
        filt.append(f"{base}[b{n}]overlay=enable='between(t,{s},{e})'[v{n}]")
        base = f"[v{n}]"; n += 1
    for asset, s, e in stickers:
        inputs += ["-loop", "1", "-i", asset]
        sw = int(1080 * CONFIG["sticker_width_ratio"])
        my = CONFIG["sticker_margin_top"]
        filt.append(f"[{n}:v]scale={sw}:-1[s{n}]")
        filt.append(f"{base}[s{n}]overlay=x=(W-w)/2:y={my}:"
                    f"enable='between(t,{s},{e})'[v{n}]")
        base = f"[v{n}]"; n += 1
    for gi, (spec, s, e) in enumerate(graphics):
        info = build_sticker({**spec, "start": s, "end": e},
                             str(work / f"g{gi}"))
        inputs += ["-framerate", str(info["fps"]), "-i", info["pattern"]]
        y = spec.get("y", 150)
        filt.append(f"[{n}:v]setpts=PTS-STARTPTS+{s}/TB[g{n}]")
        filt.append(f"{base}[g{n}]overlay=x=(W-w)/2:y={y}:"
                    f"enable='between(t,{s},{e})'[v{n}]")
        base = f"[v{n}]"; n += 1
    if do_subs:
        filt.append(f"{base}subtitles='{srt.as_posix()}':"
                    f"force_style='{CONFIG['sub_style']}'[vout]")
        vmap = "[vout]"
    else:
        vmap = base

    print(f"[render] 合成:{len(brolls)} B-roll + {len(stickers)} 圖貼 + "
          f"{len(graphics)} 動畫貼圖{' + 字幕' if do_subs else ''} ...")
    if not filt:
        run([FFMPEG, "-y", "-i", str(body), "-c", "copy", output])
        print(f"\n✅ 成品輸出: {output}"); return
    run([FFMPEG, "-y", *inputs, "-filter_complex", ";".join(filt),
         "-map", vmap, "-map", "0:a?", "-c:v", "libx264", "-crf", "20",
         "-preset", "veryfast", "-c:a", "aac", output])
    print(f"\n✅ 成品輸出: {output}")
