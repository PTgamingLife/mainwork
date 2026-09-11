// 限時任務「你希望誰變健康?」—— 整輪只能領一次的 +3。
//
// 重複送出由資料庫的 partial unique index(round_id, member_id where wish)擋,
// amp-api 會回 ALREADY_WISHED;前端這邊只是先把畫面鎖住,少打一趟。
(function () {
  const $ = (id) => document.getElementById(id);

  // 已完成就把表單換成「已送出」那一塊
  function paint(wish) {
    const done = !!(wish && wish.done);
    $('wishForm').classList.toggle('hidden', done);
    $('wishDone').classList.toggle('hidden', !done);
    if (done) $('wishDoneName').textContent = wish.target || '那個人';
  }

  // 動畫底稿固定 1000×1000,要等比縮到卡片寬度。
  // CSS 做不到(calc 不能拿 % 除以 px),所以在這裡量出來設成變數。
  function fitAnim() {
    const box = document.querySelector('.wish-anim');
    if (!box) return;
    box.style.setProperty('--wish-scale', box.clientWidth / 1000);
  }

  window.AMP.loadWish = function () {
    $('wishMsg').textContent = '';
    fitAnim();
    paint(window.AMP.state && window.AMP.state.wish);
  };

  window.addEventListener('resize', fitAnim);

  document.addEventListener('DOMContentLoaded', function () {
    $('wishBtn').addEventListener('click', async function () {
      const name = $('wishName').value.trim();
      if (!name) {
        $('wishMsg').textContent = '請寫下那個人的名字 —— 自律且誠實,騙人胖十斤';
        return;
      }
      $('wishBtn').disabled = true;
      const data = await window.AMP.api('add-action', { type: 'wish', targetName: name, note: '' });
      $('wishBtn').disabled = false;

      if (!data.ok) {
        if (data.error === 'ALREADY_WISHED') {
          $('wishMsg').textContent = '這個任務整輪只能做一次,你已經送過了。';
          paint({ done: true, target: name });
          return;
        }
        if (data.error === 'TARGET_REQUIRED') {
          $('wishMsg').textContent = '請寫下那個人的名字';
          return;
        }
        $('wishMsg').textContent = '送出失敗:' + (data.error || '未知錯誤');
        return;
      }

      window.AMP.applyState(data);
      paint({ done: true, target: name });
      window.AMP.toast(`+${data.gained} 分!今天 ${data.todayPoints} 分,今日第 ${data.rank} 名`);
    });
  });
})();
