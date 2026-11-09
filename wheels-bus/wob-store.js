// wob_store：照片、影片、歌曲都存在這台裝置的 IndexedDB，不上傳。
const wob_store = (() => {
  const WOB_DB = 'wob_db';
  const WOB_FILES = 'wob_files';
  const WOB_META = 'wob_meta';
  let wob_dbp = null;

  function wob_open() {
    if (wob_dbp) return wob_dbp;
    wob_dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(WOB_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore(WOB_FILES, { keyPath: 'id' });
        db.createObjectStore(WOB_META, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return wob_dbp;
  }

  async function wob_tx(store, mode, fn) {
    const db = await wob_open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const os = tx.objectStore(store);
      const out = fn(os);
      tx.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function wob_id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  return {
    wob_id,
    putFiles(records) {
      return wob_tx(WOB_FILES, 'readwrite', os => { records.forEach(r => os.put(r)); });
    },
    getAllFiles() {
      return wob_tx(WOB_FILES, 'readonly', os => os.getAll());
    },
    deleteFile(id) {
      return wob_tx(WOB_FILES, 'readwrite', os => { os.delete(id); });
    },
    setMeta(key, value) {
      return wob_tx(WOB_META, 'readwrite', os => { os.put({ key, value }); });
    },
    async getMeta(key) {
      const row = await wob_tx(WOB_META, 'readonly', os => os.get(key));
      return row ? row.value : undefined;
    },
    clearAll() {
      return Promise.all([
        wob_tx(WOB_FILES, 'readwrite', os => { os.clear(); }),
        wob_tx(WOB_META, 'readwrite', os => { os.clear(); }),
      ]);
    },
  };
})();
