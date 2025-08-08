const BattleScene = {
  el: null,
  onMove: null,
  onCatch: null,
  onRun: null,
  onSwap: null,
  onPotion: null,

  show(state, player, enemy){
    if(!this.el) this.el = document.getElementById('battleOverlay');
    this.el.classList.remove('hidden');
    this.el.classList.add('appear');
    this.el.innerHTML = `
      <div class="bui">
        <div class="scene">
          <div class="bg"></div>
          <div class="platform p-platform"></div>
          <div class="platform e-platform"></div>
          <div class="sprites">
            <img class="p-sprite" id="pSprite" src="${player.back_sprite}">
            <img class="e-sprite" id="eSprite" src="${enemy.sprite}">
          </div>
          <div class="bars">
            <div class="bar e-bar"><div><b>${enemy.displayName}</b> Lv.${enemy.level}</div><div class="hp"><i id="eHP" style="width:${Math.round(100*enemy.hp/enemy.maxhp)}%"></i></div></div>
            <div class="bar p-bar"><div><b>${player.displayName}</b> Lv.${player.level}</div><div class="hp"><i id="pHP" style="width:${Math.round(100*player.hp/player.maxhp)}%"></i></div></div>
          </div>
        </div>
        <div class="menu">
          <div class="moves" id="moves"></div>
          <div class="actions">
            <button id="btnCatch"  class="btn-big">Throw Ball</button>
            <button id="btnPotion" class="btn-big">Use Potion</button>
            <button id="btnSwap"   class="btn-big">Swap</button>
            <button id="btnRun"    class="btn-big">Run</button>
          </div>
          <div class="textbox" id="textbox">A wild ${enemy.displayName} appeared!</div>
        </div>
      </div>`;
    const mv = this.el.querySelector('#moves');
    (player.moves||[]).forEach(m=>{
      const b = document.createElement('button');
      b.className = 'move';
      b.innerHTML = `<div><b>${m.name}</b></div><small>${m.type.toUpperCase()} • ${m.damage_class} • PP ${m.pp}</small>`;
      b.onclick = ()=> this.onMove && this.onMove(m);
      mv.appendChild(b);
    });
    this.el.querySelector('#btnCatch').onclick  = ()=> this.onCatch  && this.onCatch();
    this.el.querySelector('#btnPotion').onclick = ()=> this.onPotion && this.onPotion();
    this.el.querySelector('#btnSwap').onclick   = ()=> this.onSwap   && this.onSwap();
    this.el.querySelector('#btnRun').onclick    = ()=> this.onRun    && this.onRun();
  },

  updateHP(player, enemy){
    const p = this.el.querySelector('#pHP'); if(p) p.style.width = Math.round(100*player.hp/player.maxhp) + '%';
    const e = this.el.querySelector('#eHP'); if(e) e.style.width = Math.round(100*enemy.hp/ enemy.maxhp) + '%';
  },

  say(text){ const tb = this.el.querySelector('#textbox'); if(tb) tb.textContent = text; },
  hide(){ if(this.el){ this.el.classList.add('hidden'); this.el.innerHTML=''; } }
};
