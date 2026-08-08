# -*- coding: utf-8 -*-
"""luxe_html:HTML/CSS/GSAP 場景引擎(取代 PIL 手畫)。
每個場景 = 一個透明背景 HTML,GSAP 動畫;Playwright 無頭 Chrome 逐幀截圖 → 透明 PNG 序列,
可像 luxe_anim 一樣疊進 render_luxe。回傳 {pattern,fps,frames,w,h}。

場景:title / list / counter / swap(深色珊瑚 dark / 米白 cream 主題)。
相依:playwright(pip install playwright; python -m playwright install chromium)。
"""
from __future__ import annotations
import shutil
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

_GSAP = (Path(__file__).parent / "assets" / "gsap.min.js").read_text(encoding="utf-8")

THEMES = {
    "dark":  {"bg": "transparent", "ink": "#F5F2EE", "mute": "#8C8E90",
              "accent": "#D97757", "gold": "#D6AA5C", "panel": "#1E1D21", "line": "#302E34"},
    "cream": {"bg": "transparent", "ink": "#22201C", "mute": "#8C8578",
              "accent": "#B08A4A", "gold": "#B08A4A", "panel": "#EAE3D6", "line": "#D6CBB8"},
}


def _page(inner: str, script: str, theme: str, w=1080, h=1920) -> str:
    t = THEMES.get(theme, THEMES["dark"])
    css_vars = ";".join(f"--{k}:{v}" for k, v in t.items())
    return f"""<!doctype html><html><head><meta charset="utf-8">
<script>{_GSAP}</script>
<style>
:root{{{css_vars}}}
html,body{{margin:0;padding:0;background:transparent;width:{w}px;height:{h}px;overflow:hidden;
 font-family:"Microsoft JhengHei","Segoe UI",sans-serif;color:var(--ink)}}
#stage{{position:relative;width:{w}px;height:{h}px}}
.kicker{{color:var(--accent);font-weight:700;font-size:34px;letter-spacing:8px}}
.rule{{width:260px;height:3px;background:var(--accent);transform-origin:left;margin:14px 0}}
.big{{font-weight:800;font-size:96px;line-height:1.1}}
.big .g{{color:var(--accent)}}
.ghost{{position:absolute;font-weight:800;font-size:150px;color:var(--ink);opacity:.10}}
.panel{{background:var(--panel);border:2px solid var(--line);border-radius:28px;padding:44px 48px}}
.badge{{display:inline-block;background:var(--accent);color:#161418;font-weight:700;
 font-size:34px;padding:10px 26px;border-radius:22px}}
.item{{display:flex;align-items:center;gap:22px;font-size:44px;font-weight:700;margin:22px 0}}
.tri{{width:0;height:0;border-left:20px solid var(--accent);
 border-top:12px solid transparent;border-bottom:12px solid transparent}}
.num{{font-weight:800;font-size:150px}}
.lab{{color:var(--mute);font-size:52px;font-weight:700;margin-top:8px}}
.arrow{{color:#22DD66;font-size:70px}}
.swapwrap{{position:absolute;left:0;right:0;text-align:center}}
.old{{font-weight:800;font-size:76px;color:var(--ink);position:relative;display:inline-block}}
.old .strike{{position:absolute;left:0;top:50%;height:9px;background:var(--accent);width:0}}
.new{{font-weight:800;font-size:88px;color:var(--accent);opacity:0}}
</style></head><body><div id="stage">{inner}</div>
<script>
const tl=gsap.timeline({{paused:true}});
{script}
window.__dur=tl.duration();
window.seek=(t)=>{{tl.pause();tl.time(Math.min(t,tl.duration()))}};
window.seek(0);
</script></body></html>"""


def title(spec, theme="dark"):
    inner = f"""<div style="position:absolute;left:90px;top:150px">
      <div class="kicker" id="k">{spec.get('label','')}</div><div class="rule" id="r"></div></div>
      <div class="ghost" id="gh" style="left:80px;top:250px">{spec.get('ghost','')}</div>
      <div class="big" id="h" style="position:absolute;left:90px;top:400px">{spec.get('main','')}</div>"""
    script = """tl.from('#r',{scaleX:0,duration:.5,ease:'power2.out'},0)
      .from('#k',{opacity:0,y:14,duration:.4},0)
      .from('#gh',{opacity:0,y:24,duration:.7,ease:'power2.out'},.15)
      .from('#h',{opacity:0,y:34,duration:.6,ease:'power3.out'},.3)"""
    return _page(inner, script, theme)


def list_card(spec, theme="dark"):
    items = spec.get("items", [])
    rows = "".join(f'<div class="item" id="it{i}"><div class="tri"></div><div>{t}</div></div>'
                   for i, t in enumerate(items))
    inner = f"""<div class="panel" id="p" style="position:absolute;left:90px;top:150px;width:820px">
      <div class="badge" id="b">{spec.get('title','課程內容')}</div>
      <div style="height:26px"></div>{rows}</div>"""
    script = """tl.from('#p',{opacity:0,y:30,duration:.5,ease:'power2.out'},0)
      .from('#b',{opacity:0,scale:.8,transformOrigin:'left center',duration:.4},.1)
      .from('[id^=it]',{opacity:0,x:-24,duration:.4,stagger:.16,ease:'power2.out'},.35)"""
    return _page(inner, script, theme)


def counter(spec, theme="dark"):
    frm, to = float(spec.get("from", 0)), float(spec.get("to", 100))
    inner = f"""<div style="position:absolute;left:0;right:0;top:150px;text-align:center">
      <span class="arrow">▲</span>
      <div class="num" id="n">0</div><div class="lab">{spec.get('label','')}</div></div>"""
    script = f"""const o={{v:{frm}}};const el=document.getElementById('n');
      const fmt=(v)=>{{v=Math.round(v);return v>=10000?(v/10000).toFixed(1)+'萬':''+v}};
      el.textContent=fmt({frm});
      tl.to(o,{{v:{to},duration:1.6,ease:'power1.out',onUpdate:()=>el.textContent=fmt(o.v)}},0)
      .from('.arrow',{{opacity:0,y:20,duration:.4}},0)
      .from('.num',{{scale:.6,transformOrigin:'center',duration:.4,ease:'back.out(2)'}},0)"""
    return _page(inner, script, theme)


def swap(spec, theme="dark"):
    inner = f"""<div class="swapwrap" style="top:250px"><span class="old" id="o">{spec.get('old','')}
      <span class="strike" id="s"></span></span></div>
      <div class="swapwrap" style="top:250px"><span class="new" id="n">{spec.get('new','')}</span></div>"""
    script = """tl.to('#s',{width:'100%',duration:.6,ease:'power1.inOut'},.3)
      .to('#o',{opacity:.35,duration:.3},.9)
      .to('#o',{opacity:0,duration:.3},1.4)
      .fromTo('#n',{opacity:0,scale:.7,transformOrigin:'center'},
              {opacity:1,scale:1,duration:.5,ease:'back.out(1.8)'},1.5)"""
    return _page(inner, script, theme)


BUILDERS = {"title": title, "list": list_card, "counter": counter, "swap": swap}


def render_scene(scene_type, spec, outdir, theme="dark", dur=None, fps=30, w=1080, h=1920):
    from playwright.sync_api import sync_playwright
    out = Path(outdir); out.mkdir(parents=True, exist_ok=True)
    html_path = out / "scene.html"
    html_path.write_text(BUILDERS[scene_type](spec, theme), encoding="utf-8")
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
        pg.goto(html_path.as_uri())
        pg.wait_for_function("window.seek && window.__dur!==undefined")
        total = dur if dur else pg.evaluate("window.__dur")
        n = int(total * fps) + 4
        for i in range(n):
            pg.evaluate("(t)=>window.seek(t)", i / fps)
            pg.screenshot(path=str(out / f"h_{i:05d}.png"), omit_background=True)
        b.close()
    return {"pattern": str(out / "h_%05d.png"), "fps": fps, "frames": n, "w": w, "h": h}


if __name__ == "__main__":
    import json
    st, spec = sys.argv[1], json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    print(render_scene(st, spec, sys.argv[3] if len(sys.argv) > 3 else "_scene"))
