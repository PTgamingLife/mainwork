"""lf_ 頁面結構偵測:輸出 DOM 骨架(所有文字內容遮蔽成長度),用來修正 lf_selectors.json。"""
import time

from lf_config import LF_DATA

LF_JS_SKELETON = """() => {
  const lines = []; let count = 0;
  const walk = (el, d) => {
    if (count > 5000 || d > 30) return;
    count++;
    const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\\s+/)
      .filter(Boolean).slice(0, 4).map(c => '.' + c).join('');
    const a = [];
    for (const n of ['role', 'type', 'placeholder', 'data-mid', 'data-message-id']) {
      if (el.hasAttribute && el.hasAttribute(n)) a.push(n + (['role','type','placeholder'].includes(n)
        ? '=' + el.getAttribute(n) : ''));
    }
    const isBtn = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' ||
      el.getAttribute('role') === 'tab';
    if (isBtn && el.getAttribute('aria-label')) a.push('aria-label=' + el.getAttribute('aria-label'));
    if (el.isContentEditable && el.getAttribute('contenteditable')) a.push('contenteditable');
    let own = 0;
    el.childNodes.forEach(n => { if (n.nodeType === 3) own += n.textContent.trim().length; });
    const st = getComputedStyle(el);
    const scroll = /(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 5;
    lines.push('  '.repeat(d) + el.tagName.toLowerCase() + cls + (a.length ? ' [' + a.join(' ') + ']' : '')
      + (own ? ' T' + own : '') + (scroll ? ' <SCROLL>' : ''));
    [...el.children].forEach(c => walk(c, d + 1));
  };
  walk(document.body, 0);
  return lines.join('\\n');
}"""


LF_JS_CLASSES = """(itemSel) => {
  const seen = {};
  document.querySelectorAll(itemSel).forEach(it => it.querySelectorAll('*').forEach(e => {
    const c = typeof e.className === 'string' ? e.className : '';
    c.split(/\\s+/).filter(Boolean).forEach(k => { seen[k] = (seen[k] || 0) + 1; });
  }));
  return seen;
}"""


def lf_scan_classes(page, item_sel: str, rounds: int = 400) -> str:
    """捲完整個清單,統計清單項目內出現過的 class(不含任何文字),用來找未讀徽章等元素。"""
    from lf_scraper import LF_JS_MARK_SCROLL, LF_JS_SCROLL
    LF_DATA.mkdir(parents=True, exist_ok=True)
    page.evaluate(LF_JS_MARK_SCROLL, [item_sel, "data-lf-scroll"])
    total: dict[str, int] = {}
    for _ in range(rounds):
        for k, v in page.evaluate(LF_JS_CLASSES, item_sel).items():
            total[k] = max(total.get(k, 0), v)
        r = page.evaluate(LF_JS_SCROLL, ["data-lf-scroll", "down"])
        if r.get("bottom", True):
            break
        time.sleep(0.5)
    path = LF_DATA / f"lf_classes_{time.strftime('%H%M%S')}.txt"
    path.write_text("\n".join(f"{v}\t{k}" for k, v in sorted(total.items())), encoding="utf-8")
    page.evaluate(LF_JS_SCROLL, ["data-lf-scroll", "up"])
    return str(path)


def lf_probe_page(page, label: str = "current") -> str:
    LF_DATA.mkdir(parents=True, exist_ok=True)
    safe = "".join(ch for ch in label if ch.isalnum() or ch in "-_")[:30] or "current"
    path = LF_DATA / f"lf_probe_{safe}_{time.strftime('%H%M%S')}.txt"
    text = page.evaluate(LF_JS_SKELETON)
    path.write_text(f"url={page.url}\n{text}", encoding="utf-8")
    return str(path)
