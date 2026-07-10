const fs=require("fs");
const d=require("/home/user/mainwork/household-finance/data.json");
const CUR="NT$";
const fmt=n=>CUR+Math.round(n).toLocaleString("en-US");
const fmtK=n=>Math.abs(n)>=10000?CUR+(n/10000).toFixed(n%10000?1:0)+"萬":fmt(n);
const inc=d.income.filter(x=>(x.freq||"monthly")==="monthly").reduce((s,x)=>s+ +x.amount,0);
const exp=d.expenses.filter(x=>(x.freq||"monthly")==="monthly").reduce((s,x)=>s+ +x.amount,0);
const bal=inc-exp, savRate=bal/inc;
const liquid=d.accounts.filter(a=>a.liquid!==false).reduce((s,a)=>s+ +a.balance,0);
const debt=d.loans.reduce((s,l)=>s+ +l.balance,0);
const assetTotal=d.assets.reduce((s,a)=>s+ +a.value,0)+d.accounts.reduce((s,a)=>s+ +a.balance,0);
const net=assetTotal-debt, emMonths=liquid/exp;
const debtPay=d.loans.reduce((s,l)=>s+ +(l.monthlyPayment||0),0), debtRatio=debtPay/inc;
const cats=Object.entries(d.expenses.reduce((m,x)=>{m[x.category]=(m[x.category]||0)+ +x.amount;return m},{})).sort((a,b)=>b[1]-a[1]);
const PAL=["#3b6ef5","#1f9d6b","#c98a12","#8a5cf6","#e07b39","#39b0c9","#d1495b","#7a8699"];
const loan=d.loans[0];
const r=loan.rate/12, interest=loan.balance*r, principal=loan.monthlyPayment-interest;
const pm=Math.ceil(-Math.log(1-r*loan.balance/loan.monthlyPayment)/Math.log(1+r));
function lights(){const L=[];
 if(savRate>=0.2)L.push(["g","現金流健康","儲蓄率 "+(savRate*100).toFixed(0)+"%,每月穩定有結餘 "+fmt(bal)+",可加速累積資產。"]);
 else if(bal>=0)L.push(["y","現金流偏緊","儲蓄率 "+(savRate*100).toFixed(0)+"%(穩健目標 20%)。結餘 "+fmt(bal)+"。"]);
 else L.push(["r","現金流赤字","每月透支 "+fmt(-bal)+",最優先處理。"]);
 if(emMonths>=6)L.push(["g","緊急預備金充足",emMonths.toFixed(1)+" 個月支出,足以撐過收入中斷。"]);
 else if(emMonths>=3)L.push(["y","緊急預備金堪用",emMonths.toFixed(1)+" 個月(建議 6 個月)。把每月結餘優先補到這裡。"]);
 else L.push(["r","緊急預備金不足",emMonths.toFixed(1)+" 個月,先補到 3–6 個月再投資。"]);
 if(debtRatio<0.33)L.push(["g","負債比健康","每月債務支出佔收入 "+(debtRatio*100).toFixed(0)+"%,在安全區(<33%)。"]);
 else if(debtRatio<=0.4)L.push(["y","負債比偏高","每月債務支出佔收入 "+(debtRatio*100).toFixed(0)+"%。"]);
 else L.push(["r","負債比過高","每月債務支出佔收入 "+(debtRatio*100).toFixed(0)+"%,避免再增貸。"]);
 return L;}
const kpi=(l,v,c)=>`<div class="card kpi"><div class="label">${l}</div><div class="val"${c?` style="color:${c}"`:""}>${v}</div></div>`;
const html=`<!doctype html>
<html lang="zh-Hant"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>家庭財務儀表板</title>
<style>
:root{--bg:#0e1420;--card:#161f2e;--ink:#eaf0fa;--muted:#93a1ba;--line:#26324a;--green:#3ddc97;--greenbg:#123024;--yellow:#e0a93b;--yellowbg:#332812;--red:#f2748a;--redbg:#3a1c22;--accent:#5b8bff;--shadow:0 1px 3px rgba(0,0,0,.4),0 6px 24px rgba(0,0,0,.3)}
@media(prefers-color-scheme:light){:root{--bg:#f4f6f9;--card:#fff;--ink:#1a2233;--muted:#63708a;--line:#e5eaf2;--green:#1f9d6b;--greenbg:#e4f5ec;--yellow:#c98a12;--yellowbg:#fbf1dc;--red:#d1495b;--redbg:#fbe6e9;--accent:#3b6ef5;--shadow:0 1px 3px rgba(20,30,50,.06),0 6px 24px rgba(20,30,50,.05)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;line-height:1.55}
.wrap{max-width:1040px;margin:0 auto;padding:22px 16px 56px}
h1{font-size:21px;margin:0 0 2px}
.sub{color:var(--muted);font-size:13px;margin-bottom:16px}
.banner{background:var(--yellowbg);color:var(--yellow);border:1px solid var(--line);border-radius:10px;padding:9px 13px;font-size:12.5px;margin-bottom:16px}
.grid{display:grid;gap:12px}
.kpis{grid-template-columns:repeat(4,1fr);margin-bottom:12px}
@media(max-width:720px){.kpis{grid-template-columns:repeat(2,1fr)}}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;box-shadow:var(--shadow)}
.kpi .label{font-size:12.5px;color:var(--muted);margin-bottom:6px}
.kpi .val{font-size:23px;font-weight:700;font-variant-numeric:tabular-nums}
.kpi .val small{font-size:13px;font-weight:600;color:var(--muted)}
.cols{grid-template-columns:1.15fr .85fr;margin-top:12px}
@media(max-width:820px){.cols{grid-template-columns:1fr}}
h2{font-size:15px;margin:0 0 13px}
.light{display:flex;gap:11px;align-items:flex-start;padding:10px 12px;border-radius:10px;margin-bottom:9px}
.light:last-child{margin-bottom:0}
.light .dot{width:10px;height:10px;border-radius:50%;margin-top:6px;flex:none}
.light .t{font-weight:600;font-size:14px}.light .d{font-size:12.5px;color:var(--muted)}
.g{background:var(--greenbg)}.g .dot{background:var(--green)}.g .t{color:var(--green)}
.y{background:var(--yellowbg)}.y .dot{background:var(--yellow)}.y .t{color:var(--yellow)}
.r{background:var(--redbg)}.r .dot{background:var(--red)}.r .t{color:var(--red)}
.exp{display:flex;flex-direction:column;gap:11px}
.exp .row .top{display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px}
.exp .amt{color:var(--muted);font-variant-numeric:tabular-nums}
.bar{height:9px;border-radius:6px;background:var(--line);overflow:hidden}
.bar>i{display:block;height:100%;border-radius:6px}
.mort .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);font-size:13.5px}
.mort .row:last-child{border:none}.mort b{font-variant-numeric:tabular-nums}
.goal{margin-bottom:13px}.goal .top{display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px}
.goal .pct{color:var(--muted);font-variant-numeric:tabular-nums}
.note{font-size:12px;color:var(--muted);margin-top:8px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line)}
th{color:var(--muted);font-weight:600;font-size:12px}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.pill{display:inline-block;font-size:11px;padding:1px 7px;border-radius:20px;background:var(--line);color:var(--muted);margin-left:6px}
</style></head><body><div class="wrap">
<h1>🏡 家庭財務儀表板</h1>
<div class="sub">${d.meta.household.join(" & ")} · 更新 ${d.meta.updated} · 幣別 ${d.meta.currency}</div>
<div class="banner">⚠️ 目前顯示的是範例數字。把真實數字給 Claude,它會換掉並重新產生這張表。</div>
<div class="grid kpis">
${kpi("月總收入",fmt(inc))}${kpi("月總支出",fmt(exp))}${kpi("月結餘(現金流)",fmt(bal),bal>=0?"var(--green)":"var(--red)")}${kpi("儲蓄率",(savRate*100).toFixed(0)+'<small>%</small>')}
</div>
<div class="grid kpis">
${kpi("淨值(資產−負債)",fmtK(net))}${kpi("緊急預備金",emMonths.toFixed(1)+'<small>個月</small>')}${kpi("負債總額",fmtK(debt))}${kpi("流動現金",fmtK(liquid))}
</div>
<div class="grid cols">
<div class="card"><h2>🚦 財務健檢</h2>${lights().map(x=>`<div class="light ${x[0]}"><span class="dot"></span><div><div class="t">${x[1]}</div><div class="d">${x[2]}</div></div></div>`).join("")}</div>
<div class="card"><h2>💸 月支出結構</h2><div class="exp">${cats.map((c,i)=>`<div class="row"><div class="top"><span>${c[0]}</span><span class="amt">${fmt(c[1])} · ${(c[1]/exp*100).toFixed(0)}%</span></div><div class="bar"><i style="width:${(c[1]/cats[0][1]*100).toFixed(1)}%;background:${PAL[i%PAL.length]}"></i></div></div>`).join("")}</div></div>
</div>
<div class="grid cols">
<div class="card mort"><h2>🏦 ${loan.name}</h2>
<div class="row"><span>剩餘本金</span><b>${fmt(loan.balance)}</b></div>
<div class="row"><span>利率</span><b>${(loan.rate*100).toFixed(2)}%</b></div>
<div class="row"><span>每月還款</span><b>${fmt(loan.monthlyPayment)}</b></div>
<div class="row"><span>本期利息 / 本金</span><b>${fmt(interest)} / ${fmt(principal)}</b></div>
<div class="row"><span>預估還清</span><b>約 ${Math.floor(pm/12)} 年 ${pm%12} 個月</b></div>
<div class="note">低利自住房貸屬「好債」,是否提前還款可請 Claude 做取捨分析。</div></div>
<div class="card"><h2>🎯 目標進度</h2>${d.goals.map(g=>{const p=Math.min(100,g.current/g.target*100);return `<div class="goal"><div class="top"><b>${g.name}</b><span class="pct">${p.toFixed(0)}% · ${fmt(g.current)}/${fmt(g.target)}</span></div><div class="bar"><i style="width:${p}%;background:${p>=100?'var(--green)':'var(--accent)'}"></i></div></div>`}).join("")}</div>
</div>
<div class="card" style="margin-top:12px"><h2>🧾 最近交易</h2>
<table><thead><tr><th>日期</th><th>類別</th><th>人</th><th class="num">金額</th></tr></thead><tbody>
${d.transactions.slice().reverse().slice(0,8).map(t=>`<tr><td>${t.date}</td><td>${t.category}<span class="pill">${t.type==="income"?"收入":"支出"}</span></td><td>${t.owner||"—"}</td><td class="num"${t.type==="income"?' style="color:var(--green)"':''}>${t.type==="income"?"+":"−"}${fmt(t.amount)}</td></tr>`).join("")}
</tbody></table></div>
<div class="note" style="margin-top:18px">這是我們家的財務快照,由 data.json 產生。要更新數字就跟 Claude 說一聲。此頁唯讀、不含帳密,可安心分享。</div>
</div></body></html>`;
fs.writeFileSync("/home/user/mainwork/household-finance/dashboard-static.html",html);
console.log("written, bytes:",html.length);
console.log("收入",inc,"支出",exp,"結餘",bal,"儲蓄率",(savRate*100).toFixed(0)+"%","緊急金",emMonths.toFixed(1),"還清",Math.floor(pm/12)+"y"+pm%12+"m");
