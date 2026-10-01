// 賽季結算的「發出掌聲給前五名」。
//
// 一鍵送給全部五位、整輪只能一次、不加分(賽季已結束,分數不該再動)。
// 重複送出由資料庫的 unique(round_id, from_member_id)擋,前端只是先把畫面鎖住。
(function () {
  const $ = (id) => document.getElementById(id);
  const MEDALS = ['🥇', '🥈', '🥉', '🏅', '🏅'];

  function paint(data) {
    const top = (data && data.top) || [];
    $('clapList').innerHTML = top.map((r, i) =>
      `<li class="clap-row">
         <span class="clap-medal">${MEDALS[i] || '🏅'}</span>
         <span class="clap-name"></span>
         <span class="clap-pts">${r.points} 分</span>
       </li>`).join('');
    // 名字一律用 textContent 寫進去 —— 那是別人在 LINE 設的暱稱,不能當成 HTML
    $('clapList').querySelectorAll('.clap-name').forEach((el, i) => {
      el.textContent = top[i] ? top[i].name : '';
    });

    const done = !!(data && data.done);
    $('clapBtn').classList.toggle('hidden', done);
    $('clapDone').classList.toggle('hidden', !done);
    if (done) $('clapTotal').textContent = String((data && data.total) || 0);
  }

  window.AMP.loadClap = async function () {
    $('clapMsg').textContent = '';
    const data = await window.AMP.api('clap-status', {});
    if (!data.ok) {
      $('clapMsg').textContent = '載入失敗:' + (data.error || '未知錯誤');
      return;
    }
    paint(data);
  };

  document.addEventListener('DOMContentLoaded', function () {
    $('clapBtn').addEventListener('click', async function () {
      $('clapBtn').disabled = true;
      const data = await window.AMP.api('clap', {});
      $('clapBtn').disabled = false;

      if (!data.ok) {
        $('clapMsg').textContent = '送出失敗:' + (data.error || '未知錯誤');
        return;
      }
      paint(data);
      window.AMP.toast('掌聲送出了!今晚 21:00 他們會收到');
    });
  });
})();
