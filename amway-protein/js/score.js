// 加分頁:三顆按鈕。推薦與分享一定要填對方名字才送得出去(規則與資料庫 check 一致)。
(function () {
  const $ = (id) => document.getElementById(id);
  const LABEL = {
    eat: { title: '記錄一湯匙', points: 1 },
    share: { title: '分享給誰?', points: 3 },
    refer: { title: '推薦給誰?', points: 5 },
  };
  let pending = null;

  async function submit(type, targetName, note) {
    const data = await window.AMP.api('add-action', { type, targetName, note });
    if (!data.ok) {
      if (data.error === 'TARGET_REQUIRED') return { err: '請填寫對方的名字' };
      return { err: '加分失敗:' + (data.error || '未知錯誤') };
    }
    window.AMP.applyState(data);
    window.AMP.toast(`+${data.gained} 分!目前 ${data.totalPoints} 分,第 ${data.rank} 名`);
    return {};
  }

  function openSheet(type) {
    pending = type;
    $('targetTitle').textContent = LABEL[type].title;
    $('targetName').value = '';
    $('targetNote').value = '';
    $('targetMsg').textContent = '';
    $('targetOverlay').classList.remove('hidden');
    setTimeout(() => $('targetName').focus(), 50);
  }

  function closeSheet() {
    pending = null;
    $('targetOverlay').classList.add('hidden');
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.act').forEach((btn) => {
      btn.addEventListener('click', async function () {
        const type = btn.dataset.type;
        if (type === 'eat') {
          btn.disabled = true;
          const r = await submit('eat', '', '');
          btn.disabled = false;
          if (r.err) window.AMP.toast(r.err);
          return;
        }
        openSheet(type);
      });
    });

    $('targetCancel').addEventListener('click', closeSheet);

    $('targetOk').addEventListener('click', async function () {
      if (!pending) return;
      const name = $('targetName').value.trim();
      if (!name) {
        $('targetMsg').textContent = '請填寫對方的名字 —— 自律且誠實,騙人胖十斤';
        return;
      }
      $('targetOk').disabled = true;
      const r = await submit(pending, name, $('targetNote').value.trim());
      $('targetOk').disabled = false;
      if (r.err) { $('targetMsg').textContent = r.err; return; }
      closeSheet();
    });

    $('targetName').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') $('targetOk').click();
    });
  });
})();
