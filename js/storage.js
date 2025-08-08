
const SAVE_KEY = "pokeraid_save_v4";
const CACHE_KEY = "pokeraid_cache_v1";
const Storage = {
  save(state){ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); },
  load(){ try{ return JSON.parse(localStorage.getItem(SAVE_KEY)||"null"); }catch(e){ return null; } },
  clear(){ localStorage.removeItem(SAVE_KEY); },
  cacheGet(key){ const obj = JSON.parse(localStorage.getItem(CACHE_KEY)||"{}"); return obj[key]; },
  cacheSet(key, value){ const obj = JSON.parse(localStorage.getItem(CACHE_KEY)||"{}"); obj[key]=value; localStorage.setItem(CACHE_KEY, JSON.stringify(obj)); }
};
