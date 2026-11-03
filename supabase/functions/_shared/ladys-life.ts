// LadyS — 每年重複的紀念日 + 經期預測(早上推播、群組指令、LIFF 共用的計算)
import { ladysAddDays, ladysSelect, ladysTodayTaipei } from "./ladys.ts";

const dayMs = 864e5;
const ymdToUtc = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
export const ladysDaysBetween = (a: string, b: string) => Math.round((ymdToUtc(b) - ymdToUtc(a)) / dayMs);

// 原始日期(台北)在 fromYmd 當天或之後的下一次;2/29 在平年改 2/28
export function ladysNextYearly(originYmd: string, fromYmd: string): string {
  const md = originYmd.slice(5);
  for (let y = +fromYmd.slice(0, 4); ; y++) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const d = `${y}-${md === "02-29" && !leap ? "02-28" : md}`;
    if (d >= fromYmd) return d;
  }
}

export async function ladysYearlyEvents(): Promise<any[]> {
  return await ladysSelect("ladys_events", "ladys_deleted=eq.false&ladys_recur=eq.yearly&select=*");
}

// 把每年重複的行程展開成 [fromYmd, toYmdExclusive) 之間的實際日期(保留原本的時間)
export function ladysExpandYearly(rows: any[], fromYmd: string, toYmdExclusive: string): any[] {
  const out: any[] = [];
  for (const e of rows) {
    const origin = ladysTodayTaipei(new Date(e.ladys_start_at));
    const d = ladysNextYearly(origin, fromYmd);
    if (d >= toYmdExclusive) continue;
    const shift = ymdToUtc(d) - ymdToUtc(origin);
    out.push({
      ...e,
      ladys_start_at: new Date(new Date(e.ladys_start_at).getTime() + shift).toISOString(),
      ladys_end_at: e.ladys_end_at ? new Date(new Date(e.ladys_end_at).getTime() + shift).toISOString() : null,
      ladys_years: +d.slice(0, 4) - +origin.slice(0, 4), // 第幾週年(0 = 原始那年)
    });
  }
  return out;
}

// 紀念日提醒:今天起往後看,命中「提前天數」的那幾筆(0 = 當天,由今日行程顯示,這裡只回 >0)
export function ladysAnniversaryReminders(rows: any[], today: string, remindDays: number[]): string[] {
  const lines: string[] = [];
  for (const e of rows) {
    const origin = ladysTodayTaipei(new Date(e.ladys_start_at));
    const next = ladysNextYearly(origin, today);
    const left = ladysDaysBetween(today, next);
    if (left > 0 && remindDays.includes(left)) {
      const n = +next.slice(0, 4) - +origin.slice(0, 4);
      lines.push(`💝 再 ${left} 天:${e.ladys_title}${n > 0 ? `(${n} 週年)` : ""}`);
    }
  }
  return lines;
}

// 經期統計:最近一次開始、平均週期(只採 15~60 天的合理間隔,取最近 6 次)、預測下次
export function ladysPeriodStats(life: any[]): { last: string | null; avg: number | null; next: string | null; count: number } {
  const starts = [...new Set(life.filter((r) => r.ladys_kind === "period_start" && !r.ladys_deleted).map((r) => r.ladys_date))].sort();
  const last = starts.at(-1) ?? null;
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const g = ladysDaysBetween(starts[i - 1], starts[i]);
    if (g >= 15 && g <= 60) gaps.push(g);
  }
  const recent = gaps.slice(-6);
  const avg = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : null;
  return { last, avg, next: last && avg ? ladysAddDays(last, avg) : null, count: starts.length };
}

export async function ladysLoadPeriodStats() {
  const rows = await ladysSelect("ladys_life", "ladys_deleted=eq.false&ladys_kind=eq.period_start&order=ladys_date.asc&select=ladys_date,ladys_kind,ladys_deleted");
  return ladysPeriodStats(rows);
}
