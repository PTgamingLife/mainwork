#!/usr/bin/env node
// 工作大腦網狀圖產生器
// 拉 brain_nodes() + brain_similarity_edges() -> 產出自帶力導向圖的 brain-map.html
// 用法: SUPABASE_ANON_KEY=xxx node render-map.mjs [threshold]
// threshold: RAG 相似度連線門檻 (預設 0.75)

import { writeFileSync } from "node:fs";

const URL = process.env.SUPABASE_URL || "https://hhcubvixldieuwdeqnwc.supabase.co";
const KEY = process.env.SUPABASE_ANON_KEY;
const THRESHOLD = Number(process.argv[2] ?? 0.75);

if (!KEY) {
  console.error("缺 SUPABASE_ANON_KEY。用 mcp__Supabase__get_publishable_keys 取得後帶入環境變數。");
  process.exit(1);
}

async function rpc(fn, body = {}) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${await r.text()}`);
  return r.json();
}

const nodes = await rpc("brain_nodes");
const edges = await rpc("brain_similarity_edges", { threshold: THRESHOLD });
console.log(`節點 ${nodes.length} 個, RAG 連線 ${edges.length} 條 (門檻 ${THRESHOLD})`);

const html = `<title>工作大腦網狀圖</title>
<style>
  :root{--bg:#0f1117;--fg:#e7e9ee;--panel:#171a22;--edge:rgba(255,255,255,.12)}
  @media(prefers-color-scheme:light){:root{--bg:#f6f7f9;--fg:#1a1d24;--panel:#fff;--edge:rgba(0,0,0,.12)}}
  html,body{margin:0;height:100%;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,"PingFang TC","Microsoft JhengHei",sans-serif}
  #wrap{position:fixed;inset:0}
  canvas{display:block;width:100%;height:100%}
  #legend{position:fixed;top:12px;left:12px;background:var(--panel);border-radius:10px;padding:10px 12px;box-shadow:0 2px 12px rgba(0,0,0,.2)}
  #legend b{display:block;margin-bottom:6px;font-size:12px;opacity:.7}
  .row{display:flex;align-items:center;gap:8px;margin:3px 0}
  .dot{width:11px;height:11px;border-radius:50%}
  #meta{position:fixed;bottom:12px;left:12px;font-size:12px;opacity:.6}
  #tip{position:fixed;pointer-events:none;background:var(--panel);border-radius:8px;padding:6px 10px;font-size:12px;box-shadow:0 2px 10px rgba(0,0,0,.3);opacity:0;transition:opacity .1s;max-width:260px}
</style>
<div id="wrap"><canvas id="c"></canvas></div>
<div id="legend"><b>分類</b>
  <div class="row"><span class="dot" style="background:#5b8ff9"></span>知識 knowledge</div>
  <div class="row"><span class="dot" style="background:#61ddaa"></span>工具 tool</div>
  <div class="row"><span class="dot" style="background:#f6bd16"></span>遊戲 game</div>
  <div class="row"><span class="dot" style="background:#ef6b6b"></span>社群流量 social</div>
  <div class="row"><span class="dot" style="background:#b37feb"></span>商業財務 business</div>
</div>
<div id="meta">節點 ${nodes.length} · RAG 連線 ${edges.length} · 門檻 ${THRESHOLD}</div>
<div id="tip"></div>
<script>
const NODES=${JSON.stringify(nodes)}, EDGES=${JSON.stringify(edges)};
const COLOR={knowledge:"#5b8ff9",tool:"#61ddaa",game:"#f6bd16",social:"#ef6b6b",business:"#b37feb"};
const cat=n=>(n.categories&&n.categories[0])||"knowledge";
const c=document.getElementById("c"),ctx=c.getContext("2d"),tip=document.getElementById("tip");
let W,H,DPR;function resize(){DPR=devicePixelRatio||1;W=c.clientWidth;H=c.clientHeight;c.width=W*DPR;c.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0)}
addEventListener("resize",resize);resize();
const idx=new Map(NODES.map((n,i)=>[n.id,i]));
const P=NODES.map(()=>({x:W/2+(Math.random()-.5)*300,y:H/2+(Math.random()-.5)*300,vx:0,vy:0}));
const links=EDGES.map(e=>({s:idx.get(e.source),t:idx.get(e.target),w:e.similarity})).filter(l=>l.s!=null&&l.t!=null);
const deg=NODES.map(()=>1);links.forEach(l=>{deg[l.s]++;deg[l.t]++});
function step(){
  for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){
    let dx=P[i].x-P[j].x,dy=P[i].y-P[j].y,d2=dx*dx+dy*dy||1,f=1600/d2,d=Math.sqrt(d2);
    dx/=d;dy/=d;P[i].vx+=dx*f;P[i].vy+=dy*f;P[j].vx-=dx*f;P[j].vy-=dy*f;}
  links.forEach(l=>{let a=P[l.s],b=P[l.t],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,
    target=90+(1-l.w)*140,f=(d-target)*0.01*l.w;dx/=d;dy/=d;
    a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;});
  P.forEach(p=>{p.vx+=(W/2-p.x)*0.0008;p.vy+=(H/2-p.y)*0.0008;
    p.x+=p.vx*=.85;p.y+=p.vy*=.85;});
}
function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.lineCap="round";
  links.forEach(l=>{let a=P[l.s],b=P[l.t];
    ctx.strokeStyle="rgba(120,140,200,"+(0.12+l.w*0.5)+")";ctx.lineWidth=0.5+l.w*2.5;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();});
  NODES.forEach((n,i)=>{let p=P[i],r=5+Math.min(deg[i],10);
    ctx.fillStyle=COLOR[cat(n)]||"#888";ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fill();});
}
let hover=-1;
c.addEventListener("mousemove",e=>{const r=c.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  hover=-1;for(let i=0;i<P.length;i++){if(Math.hypot(P[i].x-mx,P[i].y-my)<12){hover=i;break;}}
  if(hover>=0){tip.style.opacity=1;tip.style.left=e.clientX+12+"px";tip.style.top=e.clientY+12+"px";
    tip.textContent=(NODES[hover].title||"")+"  ["+(NODES[hover].categories||[]).join(", ")+"]";}
  else tip.style.opacity=0;});
(function loop(){for(let k=0;k<2;k++)step();draw();requestAnimationFrame(loop)})();
</script>`;

writeFileSync(new URL("../../../brain-map.html", import.meta.url).pathname, html);
console.log("已產出 brain-map.html");
