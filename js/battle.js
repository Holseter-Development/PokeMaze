
const Battle = {
  createBattlerFromAPI(apiPoke, level, moves){
    const bs = apiPoke.stats;
    const hp = Math.floor(((bs.hp||45)*2*level)/100) + level + 10;
    function stat(b){ return Math.floor(((b||50)*2*level)/100)+5; }
    return {
      id: apiPoke.id, name: apiPoke.name, displayName: apiPoke.displayName,
      sprite: apiPoke.sprite, back_sprite: apiPoke.back_sprite, types: apiPoke.types,
      level, maxhp: hp, hp, atk:stat(bs.attack), def:stat(bs.defense), spa:stat(bs['special-attack']), spd:stat(bs['special-defense']), spe:stat(bs.speed),
      moves, status:null, fainted:false, capture_rate: apiPoke.capture_rate
    };
  },

  async maybeEvolve(state, slot){
    const b = state.party[slot];
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
    const stab = attacker.types.includes(move.type) ? 1.5 : 1.0;
    const type = typeEffectiveness(move.type, defender.types);
    const rand = 0.85 + Math.random()*0.15;
    return Math.max(1, Math.floor(base * stab * type * rand));
  },

  async startWild(state, wild){
    if(state.lock) return 'busy';
    state.lock = true;
    const player = state.party[0];
    try{
      BattleScene.show(state, player, wild);
      BattleScene.say(`A wild ${wild.displayName} appeared!`);

      const doAttack = (src, dst, move)=>{
        if(Math.random()*100 > (move.accuracy||100)){ Log.write(`${src.displayName}'s ${move.name} missed!`); return; }
        const dmg = Battle.calcDamage(src, dst, move);
        dst.hp = clamp(dst.hp - dmg, 0, dst.maxhp);
        Log.write(`${src.displayName} used ${move.name}! ${dmg} dmg.`);
        if(dst.hp<=0){ dst.fainted=true; Log.write(`${dst.displayName} fainted!`); }
      };
      const enemyMove = ()=> wild.moves[Math.floor(Math.random()*wild.moves.length)];

      BattleScene.onMove = async (myMove)=>{
        const first = player.spe >= wild.spe;
        if(first){ doAttack(player, wild, myMove); if(!wild.fainted){ doAttack(wild, player, enemyMove()); } }
        else { doAttack(wild, player, enemyMove()); if(!player.fainted){ doAttack(player, wild, myMove); } }
        BattleScene.updateHP(player, wild);
        await this.checkEnd(state, wild);
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
          BattleScene.hide();
        }else{
          Log.write(`${wild.displayName} broke free!`);
          doAttack(wild, player, enemyMove()); BattleScene.updateHP(player, wild);
          this.checkEnd(state, wild);
        }
      };

      BattleScene.onRun = ()=>{
        const canRun = player.spe >= wild.spe || Math.random()<0.5;
        if(canRun){ Log.write('Got away safely!'); BattleScene.hide(); }
        else { Log.write('Can’t escape!'); doAttack(wild, player, enemyMove()); BattleScene.updateHP(player, wild); this.checkEnd(state, wild); }
      };

      return new Promise(resolve=>{
        const obs = new MutationObserver(()=>{
          if(BattleScene.el && BattleScene.el.classList.contains('hidden')){
            obs.disconnect(); resolve('end');
          }
        });
        obs.observe(BattleScene.el, {attributes:true});
      });
    } finally {
      state.lock = false;
    }
  },

  async checkEnd(state, wild){
    const player = state.party[0];
    if(wild.fainted){
      const gain = Math.floor(20 + wild.level*8);
      player.xp = (player.xp||0) + gain;
      Log.write(`${player.displayName} gained ${gain} XP!`);
      while(player.xp >= (player.next||50 + player.level*25)){
        player.xp -= (player.next||50 + player.level*25);
        player.level++; player.maxhp += 3; player.hp = player.maxhp;
        player.atk+=2; player.def+=2; player.spa+=2; player.spd+=2; player.spe+=1;
        Log.write(`${player.displayName} grew to Lv.${player.level}!`);
        await this.maybeEvolve(state, 0);
      }
      renderParty(state.party);
      BattleScene.hide();
    }
    if(player.hp<=0){
      this.defeat(state);
      BattleScene.hide();
    }
  },

  defeat(state){
    Log.write('You were defeated. Returning home. Progress persists.');
    state.mode='home';
    state.party.forEach(p=>{ p.hp=p.maxhp; });
    state.items.pokeball = Math.max(state.items.pokeball, 3);
    updateMetaUI(state);
    Storage.save(state);
  },

  async startTrainer(state, enemyParty){
    if(state.lock) return 'busy';
    state.lock = true;
    try{
      Log.write('A trainer challenges you!');
      for(let i=0;i<enemyParty.length;i++){
        const wild = enemyParty[i];
        await this.startWild(state, wild);
        if(state.mode==='home') return 'defeat';
      }
      const reward = 200 + Math.floor(state.floor*20);
      state.money += reward;
      Log.write(`You beat the trainer! Earned ₽${reward}.`);
      updateMetaUI(state);
      return 'victory';
    } finally {
      state.lock = false;
    }
  }
};
