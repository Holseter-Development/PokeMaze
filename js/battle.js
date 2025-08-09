const Battle = {
  createBattlerFromAPI(apiPoke, level, moves){
    const bs = apiPoke.stats;
    const hp = Math.floor(((bs.hp||45)*2*level)/100) + level + 10;
    const stat = b => Math.floor(((b||50)*2*level)/100)+5;
    const mm = (moves||[]).map(m => Object.assign({ppMax: m.pp}, m));
    return {
      id: apiPoke.id, name: apiPoke.name, displayName: apiPoke.displayName,
      sprite: apiPoke.sprite, back_sprite: apiPoke.back_sprite, types: apiPoke.types,
      cry: apiPoke.cry_legacy || null,
      level, maxhp: hp, hp,
      atk:stat(bs.attack), def:stat(bs.defense), spa:stat(bs['special-attack']), spd:stat(bs['special-defense']), spe:stat(bs.speed),
      moves: mm, status:null, fainted:false, capture_rate: apiPoke.capture_rate,
      xp: 0, next: 50 + level*25
    };
  },

  async maybeEvolve(state, slot){
    const b = state.party[slot];
    if (b.level % 10 !== 0) return;
    const api = await API.getPokemon(b.name);
    const evo = await API.getEvolutionIfEligible(api, b.level);
    if(evo){
      const moves = await API.chooseLevelUpMoves(evo, b.level);
      const evolved = Battle.createBattlerFromAPI(evo, b.level, moves);
      state.party[slot] = evolved;
      Log.write(`${b.displayName} evolved into ${evolved.displayName}!`);
      addDexEntry(evolved);
    }
  },

  calcDamage(attacker, defender, move){
    const isSpecial = move.damage_class === 'special';
    const A = isSpecial ? attacker.spa : attacker.atk;
    const D = isSpecial ? defender.spd : defender.def;
    const base = (((2*attacker.level/5 + 2) * (move.power||10) * A / Math.max(1,D)) / 50) + 2;
    const stab = attacker.types.includes(move.type) ? 1.5 : 1;
    const type = typeEffectiveness(move.type, defender.types);
    const rand = 0.85 + Math.random()*0.15;
    return Math.max(1, Math.floor(base * stab * type * rand));
  },

  async startWild(state, wild){
    if(state.battleActive) return 'busy';
    state.battleActive = true;

    const me = state.party[state.activeIndex||0];
    BattleScene.show(state, me, wild);
    BattleScene.say(`A wild ${wild.displayName} appeared!`);

    if (window.AudioMgr){ AudioMgr.play('wild', {loop:true, volume:0.4}); }
    if (window.AudioMgr){ AudioMgr.playCry(wild.cry); }
    if (window.AudioMgr){ setTimeout(()=>AudioMgr.playCry(me.cry), 300); }

    const doAttack = (src, dst, move)=>{
      if(Math.random()*100 > (move.accuracy||100)){ Log.write(`${src.displayName}'s ${move.name} missed!`); return; }
      const dmg = this.calcDamage(src, dst, move);
      dst.hp = clamp(dst.hp - dmg, 0, dst.maxhp);
      Log.write(`${src.displayName} used ${move.name}! ${dmg} dmg.`);
      BattleScene.damage(dmg, dst===wild ? 'enemy' : 'player');
      if(dst.hp<=0){ dst.fainted=true; Log.write(`${dst.displayName} fainted!`); }
    };
    const enemyMove = ()=> wild.moves[Math.floor(Math.random()*wild.moves.length)];
    const refresh   = ()=>{ renderParty(state.party); BattleScene.updateHP(state.party[state.activeIndex||0], wild); };

    BattleScene.onMove = async (myMove)=>{
      if (myMove.pp > 0) myMove.pp--;
      const me = state.party[state.activeIndex||0];
      const first = me.spe >= wild.spe;
      if(first){ doAttack(me, wild, myMove); if(!wild.fainted) doAttack(wild, me, enemyMove()); }
      else     { doAttack(wild, me, enemyMove()); if(!me.fainted) doAttack(me, wild, myMove); }
      refresh(); await this.checkEnd(state, wild);
    };

    BattleScene.onCatch = ()=>{
      if(state.items.pokeball<=0){ Log.write('No Poké Balls left!'); return; }
      state.items.pokeball--; updateMetaUI(state);
      const hpFactor = (3*wild.maxhp - 2*wild.hp)/(3*wild.maxhp);
      const base = (wild.capture_rate||45)/255;
      const chance = Math.max(0.02, Math.min(0.9, base * (0.35 + hpFactor)));
      if(Math.random()<chance){
        Log.write(`Gotcha! ${wild.displayName} was caught!`);
        state.party.push(wild); addDexEntry(wild);
        if(!state.meta.captured.includes(wild.id)){
          state.meta.captured.push(wild.id);
          const rate = wild.capture_rate||45;
          const bonus = Math.max(1, Math.floor((255 - rate)/50) + 1);
          state.meta.bonusBalls = (state.meta.bonusBalls||0) + bonus;
          Log.write(`Permanent bonus: +${bonus} Poké Ball(s) each run!`);
        }
        this.trainerGain(state, 12 + wild.level*2);
        if (window.AudioMgr){ AudioMgr.play('win', {loop:false, volume:0.5}); setTimeout(()=>AudioMgr.play('amb',{loop:true,volume:0.28}),1800); }
        BattleScene.hide(); state.battleActive=false;
        Storage.save(state);
      }else{
        Log.write(`${wild.displayName} broke free!`);
        doAttack(wild, state.party[state.activeIndex||0], enemyMove()); refresh(); this.checkEnd(state, wild);
      }
    };

    BattleScene.onPotion = ()=>{
      if(state.items.potion<=0){ Log.write('No potions!'); return; }
      const me = state.party[state.activeIndex||0];
      state.items.potion--; me.hp = Math.min(me.maxhp, me.hp + 20);
      Log.write(`${me.displayName} recovered some HP.`);
      updateMetaUI(state); refresh();
    };

    BattleScene.onSwap = ()=>{
      const alive = state.party.map((p,i)=>({p,i})).filter(x=>!x.p.fainted && x.p.hp>0 && x.i!==(state.activeIndex||0));
      if(!alive.length){ Log.write('No healthy Pokémon to swap to.'); return; }
      const html = `<div class="swap-grid">` + alive.map(x=>`
        <div class="swap-card" data-i="${x.i}">
          <div><b>${x.p.displayName}</b> Lv.${x.p.level}</div>
          <div class="bar"><i style="width:${Math.round(100*x.p.hp/x.p.maxhp)}%"></i></div>
        </div>`).join('') + `</div>`;
      const m = modal(html, {title:'Choose Pokémon'});
      m.querySelectorAll('.swap-card').forEach(el=>{
        el.onclick = ()=>{
          const i = parseInt(el.getAttribute('data-i'),10);
          state.activeIndex = i; Log.write(`Go! ${state.party[i].displayName}!`);
          m.classList.add('hidden'); m.innerHTML='';
          BattleScene.show(state, state.party[i], wild);
          if (window.AudioMgr){ AudioMgr.playCry(state.party[i].cry); }
        };
      });
    };
  },

  async checkEnd(state, wild){
    const me = state.party[state.activeIndex||0];

    if(wild.fainted){
      const gain = Math.floor(15 + wild.level*7);
      me.xp += gain; Log.write(`${me.displayName} gained ${gain} XP!`);
      while(me.xp >= me.next){
        me.xp -= me.next; me.level++; me.next = 50 + me.level*25;
        me.maxhp += 3; me.hp = me.maxhp;
        me.atk+=2; me.def+=2; me.spa+=2; me.spd+=2; me.spe+=1;
        me.moves.forEach(m => { m.ppMax = (m.ppMax||m.pp||20) + 1; m.pp = Math.min(m.ppMax, (m.pp||m.ppMax)); });
        Log.write(`${me.displayName} grew to Lv.${me.level}!`);
        await this.maybeEvolve(state, state.activeIndex||0);
      }
      renderParty(state.party);

      this.trainerGain(state, 10 + wild.level);
      if (window.AudioMgr){ AudioMgr.play('win', {loop:false, volume:0.5}); setTimeout(()=>AudioMgr.play('amb',{loop:true,volume:0.28}),1800); }
      BattleScene.hide(); state.battleActive=false;
    }

    if(me.hp<=0){
      const idx = state.party.findIndex(p=>p.hp>0 && !p.fainted);
      if(idx>=0){
        state.activeIndex = idx; Log.write(`Go! ${state.party[idx].displayName}!`);
        BattleScene.show(state, state.party[idx], wild);
        if (window.AudioMgr){ AudioMgr.playCry(state.party[idx].cry); }
      }else{
        this.defeat(state);
        if (window.AudioMgr) AudioMgr.play('amb', {loop:true, volume:0.28});
        BattleScene.hide(); state.battleActive=false;
      }
    }
  },

  trainerGain(state, xp){
    state.playerXp = (state.playerXp||0) + xp;
    while(state.playerXp >= (state.playerLevel||1)*100){
      state.playerXp -= (state.playerLevel||1)*100;
      state.playerLevel = (state.playerLevel||1) + 1;
      Log.write(`Trainer leveled up! Lv ${state.playerLevel}.`);
    }
    updateMetaUI(state);
  },

  defeat(state){
    Log.write('You were defeated. Returning home. Progress persists.');
    state.mode='home';
    state.party.forEach(p=>{ p.hp=p.maxhp; });
    state.items.pokeball = Math.max(state.items.pokeball, 3);
    updateMetaUI(state);
    Storage.save(state);
  }
};
