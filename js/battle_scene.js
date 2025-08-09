const BattleScene = {
  el: null,
  onMove: null, onCatch: null, onRun: null, onSwap: null, onPotion: null,

  show(state, player, enemy){
    if(!this.el) this.el = document.getElementById('battleOverlay');
    this.el.classList.remove('hidden');
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
            <div class="bar e-bar">
              <div class="name"><b>${enemy.displayName}</b> Lv.${enemy.level}</div>
              <div class="hp"><i id="eHP" style="width:${Math.round(100*enemy.hp/enemy.maxhp)}%"></i></div>
            </div>
            <div class="bar p-bar">
              <div class="name"><b>${player.displayName}</b> Lv.${player.level}</div>
              <div class="hp"><i id="pHP" style="width:${Math.round(100*player.hp/player.maxhp)}%"></i></div>
              <div class="xp"><i id="pXP" style="width:${Math.round(100*(player.xp||0)/(player.next||100))}%"></i></div>
            </div>
          </div>
          <div class="float-dmg dmg-enemy" id="dmgE"></div>
          <div class="float-dmg dmg-player" id="dmgP"></div>
          <div class="battle-text" id="textbox">A wild ${enemy.displayName} appeared!</div>
        </div>

        <div class="battle-ui">
          <div class="left-moves" id="moves"></div>
          <div class="right-actions">
            <button class="btn-big" id="btnBall">Throw Ball</button>
            <button class="btn-big" id="btnPotion">Use Potion</button>
            <button class="btn-big" id="btnSwap">Swap</button>
            <button class="btn-big danger" id="btnRun">Run</button>
          </div>
        </div>
      </div>`;

    const mv = this.el.querySelector('#moves');
    (player.moves||[]).forEach(m=>{
      const b = document.createElement('button');
      b.className = 'move';
      b.innerHTML = `<div class="title">${m.name}</div><div class="meta">${m.type.toUpperCase()} • ${m.damage_class} • PP ${m.pp}</div>`;
      b.onclick = ()=> this.onMove && this.onMove(m);
      mv.appendChild(b);
    });
    this.el.querySelector('#btnBall').onclick   = ()=> this.onCatch  && this.onCatch();
    this.el.querySelector('#btnPotion').onclick = ()=> this.onPotion && this.onPotion();
    this.el.querySelector('#btnSwap').onclick   = ()=> this.onSwap   && this.onSwap();
    this.el.querySelector('#btnRun').onclick    = ()=> this.onRun    && this.onRun();
  },

  updateHP(player, enemy){
    const p = this.el.querySelector('#pHP'); if(p) p.style.width = Math.round(100*player.hp/player.maxhp) + '%';
    const e = this.el.querySelector('#eHP'); if(e) e.style.width = Math.round(100*enemy.hp/ enemy.maxhp) + '%';
    const x = this.el.querySelector('#pXP'); if(x) x.style.width = Math.min(100, Math.round(100*(player.xp||0)/(player.next||100))) + '%';
  },

  say(text){ const tb = this.el.querySelector('#textbox'); if(tb) tb.textContent = text; },
  damage(num, target){
    const id = target === 'player' ? '#dmgP' : '#dmgE';
    const d = this.el.querySelector(id);
    if(!d) return;
    d.textContent = `-${num}`;
    d.classList.remove('show');
    void d.offsetWidth;
    d.classList.add('show');
    setTimeout(()=>d.classList.remove('show'), 1000);
  },
  hide(){ if(this.el){ this.el.classList.add('hidden'); this.el.innerHTML=''; } }
};
