
const Log = {
  el: null,
  init(){ this.el = document.getElementById('log'); },
  write(msg){ const p=document.createElement('div'); p.textContent=msg; this.el.appendChild(p); this.el.scrollTop=this.el.scrollHeight; }
};

function modal(contentHTML, {title="Dialog"}={}){
  const root = document.getElementById('modalRoot');
  root.classList.remove('hidden');
  root.innerHTML = `<div class="modal"><header><strong>${title}</strong><button id="modalClose" class="btn">✕</button></header><div class="content">${contentHTML}</div></div>`;
  root.querySelector('#modalClose').onclick = ()=>{ root.classList.add('hidden'); root.innerHTML = ''; };
  return root;
}

function homeScreen(onStart){
  const html = `
    <h1 class="title">PokéRaid</h1>
    <p class="subtitle">Roguelite dungeon crawler with classic battles</p>
    <div class="home-actions">
      <button id="btnStartRaid" class="btn-wide">Enter Dungeon</button>
      <button id="btnPickStarter" class="btn-wide">Choose Starter</button>
    </div>
    <p class="small">Tip: WASD to move, arrow keys or mouse drag to turn.</p>`;
  const m = modal(html, {title:"Home"});
  m.querySelector('#btnStartRaid').onclick = ()=>{ m.classList.add('hidden'); m.innerHTML=''; onStart(); };
  m.querySelector('#btnPickStarter').onclick = ()=>{ pickStarter((p)=>{ onStart(p); }); };
}

function pickStarter(onPick){
  const html = `<p>Choose your starter Pokémon:</p><div class="choice-grid" id="starterGrid"></div>`;
  const m = modal(html, {title:"Your Starter"});
  const grid = m.querySelector('#starterGrid');
  STARTERS.forEach(async id=>{
    const p = await API.getPokemon(id);
    const el = document.createElement('div');
    el.className = 'choice';
    el.innerHTML = `<img src="${p.sprite}" alt=""><div><div><b>${p.displayName}</b></div><div class="small">${p.types.join(' / ')}</div></div>`;
    el.onclick = ()=>{ m.classList.add('hidden'); m.innerHTML=''; onPick(p); };
    grid.appendChild(el);
  });
}

function showHelp(){
  const html = `<p><b>Controls</b></p>
    <ul><li>Move: <kbd>W A S D</kbd></li><li>Turn: <kbd>← →</kbd> or Mouse drag</li><li>Interact / Confirm: <kbd>Space</kbd> / Click</li></ul>
    <p><b>Loop</b></p><p>Explore, battle, catch, and climb floors. If defeated you return home but keep progress.</p>`;
  modal(html, {title:"Help"});
}

function renderParty(party){
  const hud = document.getElementById('partyHud');
  hud.innerHTML = '';
  party.forEach(p=>{
    const el = document.createElement('div');
    el.className = 'poke';
    el.innerHTML = `<img src="${p.sprite}" width="56" height="56" style="image-rendering:pixelated">
      <div class="info"><div><b>${p.displayName}</b> Lv.${p.level}</div><div class="bar"><i style="width:${Math.round(100*p.hp/p.maxhp)}%"></i></div></div>`;
    hud.appendChild(el);
  });
}

function updateMetaUI(state){
  document.getElementById('pokeballs').textContent = state.items.pokeball;
  document.getElementById('money').textContent = state.money;
  document.getElementById('floorLabel').textContent = state.mode==='home' ? 'Home' : ('Floor ' + state.floor);
}

function addDexEntry(poke){
  const dex = document.getElementById('pokedex');
  const el = document.createElement('div');
  el.className = 'dex-entry';
  el.innerHTML = `<img src="${poke.sprite}"><div><div><b>#${poke.id} ${poke.name}</b></div><div class="small">${poke.types.join(' / ')}</div></div>`;
  dex.appendChild(el);
}
