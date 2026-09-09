// 邀朋友:用 liff.shareTargetPicker 把邀請卡直接轉傳給對方的 LINE。
//
// 送出的是 Flex 卡(紐崔萊綠),按鈕連到 OA 加好友連結 —— 對方要先加好友,
// 才計得了分、上得了排行榜。
//
// shareTargetPicker 需要在 LINE Developers 的該 LIFF 開啟權限;
// 不可用時(含 ?mock=1)退回「顯示全文 + 複製」,不讓畫面卡死。
(function () {
  const CFG = window.AMP_CONFIG;
  const $ = (id) => document.getElementById(id);

  const shareText = () => [
    CFG.SHARE_TITLE,
    CFG.SHARE_SUBTITLE,
    '連結：' + CFG.OA_ADD_FRIEND_URL,
  ].join('\n');

  // 版型與 supabase/functions/_shared/amp.ts 的入口卡一致(深綠 header + 米白 body)
  function inviteFlex() {
    return {
      type: 'flex',
      altText: shareText(),
      contents: {
        type: 'bubble',
        header: {
          type: 'box', layout: 'vertical', backgroundColor: '#00703C', paddingAll: '18px',
          contents: [
            { type: 'text', text: CFG.SHARE_TITLE, color: '#FFFFFF', weight: 'bold', size: 'lg', wrap: true },
            { type: 'text', text: CFG.SHARE_SUBTITLE, color: '#FFFFFF', size: 'sm', wrap: true, margin: 'sm' },
          ],
        },
        body: {
          type: 'box', layout: 'vertical', spacing: 'md',
          backgroundColor: '#F7F5EE', paddingAll: '18px',
          contents: [
            { type: 'text', text: '安麗蛋白素挑戰', size: 'xs', color: '#6B7A70' },
            {
              type: 'text', wrap: true, size: 'sm', color: '#1F3D2A',
              text: '一起把蛋白素吃好吃滿',
            },
            { type: 'text', text: '自律且誠實,騙人胖十斤', size: 'xs', color: '#7AB800', align: 'center' },
          ],
        },
        footer: {
          type: 'box', layout: 'vertical', paddingAll: '12px',
          contents: [{
            type: 'button', style: 'primary', color: '#00703C', height: 'sm',
            action: { type: 'uri', label: '加入挑戰', uri: CFG.OA_ADD_FRIEND_URL },
          }],
        },
      },
    };
  }

  function showFallback(reason) {
    $('shareText').value = shareText();
    $('shareFallback').classList.remove('hidden');
    if (reason) $('shareMsg').textContent = reason;
  }

  window.AMP.loadShare = function () {
    $('sharePreviewTitle').textContent = CFG.SHARE_TITLE;
    $('sharePreviewSub').textContent = CFG.SHARE_SUBTITLE;
    $('shareMsg').textContent = '';
  };

  document.addEventListener('DOMContentLoaded', function () {
    $('goShare').addEventListener('click', () => window.AMP.go('share'));

    $('shareCopy').addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(shareText());
        window.AMP.toast('已複製,去 LINE 貼給朋友吧');
      } catch (e) {
        $('shareText').select();
        window.AMP.toast('請手動選取複製');
      }
    });

    $('shareBtn').addEventListener('click', async function () {
      const available = !CFG.MOCK && window.liff &&
        typeof liff.isApiAvailable === 'function' && liff.isApiAvailable('shareTargetPicker');

      if (!available) {
        showFallback(CFG.MOCK
          ? '離線試玩模式不能叫出 LINE 的傳送畫面,改用複製。'
          : '這個環境不支援直接傳送(或 LIFF 尚未開啟分享權限),改用複製。');
        return;
      }

      $('shareBtn').disabled = true;
      try {
        const res = await liff.shareTargetPicker([inviteFlex()]);
        // 使用者按取消時 res 是 null,不是錯誤。
        if (res) {
          $('shareMsg').textContent = '已送出!等他加好友就完成邀請。';
          window.AMP.toast('已送出邀請卡');
        } else {
          $('shareMsg').textContent = '已取消,沒有送出。';
        }
      } catch (e) {
        showFallback('傳送失敗:' + (e && e.message ? e.message : e));
      }
      $('shareBtn').disabled = false;
    });
  });
})();
