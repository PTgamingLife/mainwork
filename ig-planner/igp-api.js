// IG Planner — Supabase Auth(Email 驗證碼 / 魔術連結)+ igp_plan 讀寫
// 不用 supabase-js:直接打 REST,少一個 CDN 依賴。
// ?demo=1 時不登入,資料只存本機 localStorage。

const IGP_SB_URL = 'https://wcemkmwrlvijxxwybrgs.supabase.co';
const IGP_SB_KEY = 'sb_publishable_grlcrRPSJNWMA7VRzhve8A_tUu-VQnn';
const IGP_DEMO = new URLSearchParams(location.search).has('demo');

const igpStore = {
  get(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 私密模式等狀況,略過 */ }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch { /* 同上 */ }
  },
};

const igpAuth = {
  session: igpStore.get('igp_session', null),

  get user() { return IGP_DEMO ? { id: 'demo', email: '示範模式' } : this.session?.user ?? null; },

  save(s) {
    this.session = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + Number(s.expires_in || 3600),
      user: { id: s.user.id, email: s.user.email },
    };
    igpStore.set('igp_session', this.session);
  },

  clear() {
    this.session = null;
    igpStore.del('igp_session');
  },

  async call(path, body, token) {
    const res = await fetch(`${IGP_SB_URL}/auth/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey: IGP_SB_KEY,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.msg || data.error_description || data.message || `登入服務錯誤 ${res.status}`);
    return data;
  },

  redirectTo() { return encodeURIComponent(location.origin + location.pathname); },

  // Google 登入:整頁跳到 Supabase,登入完帶著 #access_token 回來
  google() {
    location.href = `${IGP_SB_URL}/auth/v1/authorize?provider=google&redirect_to=${this.redirectTo()}`;
  },

  // 寄出 Email 魔術連結
  async sendLink(email) {
    await this.call(`otp?redirect_to=${this.redirectTo()}`, { email, create_user: true });
  },

  // Google / 魔術連結回來時,token 在網址 # 後面
  async fromUrlHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    const access = h.get('access_token');
    if (!access) return false;
    history.replaceState(null, '', location.pathname + location.search);
    const res = await fetch(`${IGP_SB_URL}/auth/v1/user`, {
      headers: { apikey: IGP_SB_KEY, Authorization: `Bearer ${access}` },
    });
    if (!res.ok) return false;
    const user = await res.json();
    this.save({
      access_token: access,
      refresh_token: h.get('refresh_token'),
      expires_in: h.get('expires_in'),
      user,
    });
    return true;
  },

  async refresh() {
    if (!this.session?.refresh_token) throw new Error('NO_SESSION');
    const s = await this.call('token?grant_type=refresh_token', { refresh_token: this.session.refresh_token });
    this.save(s);
  },

  async token() {
    if (!this.session) throw new Error('NO_SESSION');
    if (this.session.expires_at - 60 < Date.now() / 1000) await this.refresh();
    return this.session.access_token;
  },

  async logout() {
    const t = this.session?.access_token;
    this.clear();
    if (t) await this.call('logout', {}, t).catch(() => {});
  },
};

const igpApi = {
  cacheKey() { return `igp_cache_${igpAuth.user?.id}`; },
  pendingKey() { return `igp_pending_${igpAuth.user?.id}`; },

  async rest(path, opts = {}, retried = false) {
    const token = await igpAuth.token();
    const res = await fetch(`${IGP_SB_URL}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: IGP_SB_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401 && !retried) {
      await igpAuth.refresh();
      return this.rest(path, opts, true);
    }
    if (!res.ok) throw new Error(`資料庫錯誤 ${res.status}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  },

  // 回傳 { 'YYYY-MM-DD': episode }
  cached() { return igpStore.get(this.cacheKey(), {}); },

  async loadAll() {
    if (IGP_DEMO) return this.cached();
    const rows = await this.rest('igp_plan?select=igp_date,igp_data&order=igp_date');
    const map = {};
    rows.forEach(r => { map[r.igp_date] = { ...r.igp_data, igp_date: r.igp_date }; });
    // 還沒同步上去的本機修改蓋過雲端版本
    const cache = this.cached();
    Object.keys(igpStore.get(this.pendingKey(), {})).forEach(d => {
      if (cache[d]) map[d] = cache[d]; else delete map[d];
    });
    igpStore.set(this.cacheKey(), map);
    return map;
  },

  writeCache(ep, removed = false) {
    const cache = this.cached();
    if (removed) delete cache[ep.igp_date]; else cache[ep.igp_date] = ep;
    igpStore.set(this.cacheKey(), cache);
    const pending = igpStore.get(this.pendingKey(), {});
    // 存時間戳,flush 期間又被改到的日期才不會被誤清
    pending[ep.igp_date] = `${Date.now()}-${Math.random()}`;
    igpStore.set(this.pendingKey(), pending);
  },

  async upsertMany(eps) {
    if (IGP_DEMO || !eps.length) return;
    const now = new Date().toISOString();
    await this.rest('igp_plan?on_conflict=igp_user_id,igp_date', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(eps.map(ep => ({
        igp_user_id: igpAuth.user.id,
        igp_date: ep.igp_date,
        igp_data: ep,
        igp_updated_at: now,
      }))),
    });
  },

  async remove(date) {
    if (IGP_DEMO) return;
    await this.rest(`igp_plan?igp_date=eq.${encodeURIComponent(date)}`, { method: 'DELETE' });
  },

  // 把本機待同步的變更推上雲端;回傳是否全部成功
  async flush() {
    if (IGP_DEMO) { igpStore.set(this.pendingKey(), {}); return true; }
    const pending = igpStore.get(this.pendingKey(), {});
    const dates = Object.keys(pending);
    if (!dates.length) return true;
    const cache = this.cached();
    try {
      await this.upsertMany(dates.filter(d => cache[d]).map(d => cache[d]));
      for (const d of dates.filter(d => !cache[d])) await this.remove(d);
      const now = igpStore.get(this.pendingKey(), {});
      dates.forEach(d => { if (now[d] === pending[d]) delete now[d]; });
      igpStore.set(this.pendingKey(), now);
      return true;
    } catch (e) {
      console.warn('igp flush failed', e);
      return false;
    }
  },
};
