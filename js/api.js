
const API = {
  base: 'https://pokeapi.co/api/v2',
  async _fetch(url){
    const cached = Storage.cacheGet(url);
    if(cached) return cached;
    const res = await fetch(url);
    if(!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    Storage.cacheSet(url, data);
    return data;
  },
  async getPokemon(idOrName){
    const data = await this._fetch(`${this.base}/pokemon/${idOrName}`);
    const species = await this._fetch(data.species.url);
    const types = data.types.map(t=>t.type.name);
    const spriteFront = data.sprites.front_default || data.sprites.other?.['official-artwork']?.front_default;
    const spriteBack = data.sprites.back_default || spriteFront; // fallback
    const stats = Object.fromEntries(data.stats.map(s=>[s.stat.name, s.base_stat]));
    return {
      id: data.id,
      name: data.name,
      displayName: data.name[0].toUpperCase()+data.name.slice(1),
      sprite: spriteFront,
      back_sprite: spriteBack,
      types,
      stats,
      species,
      capture_rate: species.capture_rate,
      moves: data.moves
    };
  },
  async chooseLevelUpMoves(pokemon, level){
    const gen1 = new Set(['red-blue','yellow']);
    const learnsets = pokemon.moves
      .map(m=>{
        const vg = m.version_group_details.find(v =>
          gen1.has(v.version_group.name) &&
          v.move_learn_method.name === 'level-up' &&
          v.level_learned_at <= level
        );
        return vg ? { name:m.move.name, level:vg.level_learned_at } : null;
      })
      .filter(Boolean);
    const entries = [];
    for(const m of learnsets.slice(0, 40)){
      try{
        const md = await this._fetch(`${this.base}/move/${m.name}`);
        entries.push({
          name: md.name, power: md.power||0, accuracy: md.accuracy||100, pp: md.pp||20, type: md.type.name, damage_class: md.damage_class.name
        });
      }catch(e){}
    }
    entries.sort((a,b)=> (b.power||0) - (a.power||0));
    return entries.slice(0,4);
  },
  async getRandomEncounter(floor){
    const maxId = 151;
    const base = Math.min(maxId, Math.floor(30 + floor*2 + Math.random()*floor*2));
    const id = 1 + Math.floor(Math.random()*base);
    const p = await this.getPokemon(id);
    const level = Math.max(2, Math.min(60, 2 + Math.floor(floor*0.8) + Math.floor(Math.random()*3)));
    const moves = await this.chooseLevelUpMoves(p, level);
    return Battle.createBattlerFromAPI(p, level, moves);
  },
  async getTrainerParty(floor){
    const size = 1 + Math.min(3, Math.floor(floor/5));
    const party = [];
    for(let i=0;i<size;i++){ party.push(await this.getRandomEncounter(Math.max(1, floor-1))); }
    return party;
  },
  async getEvolutionIfEligible(apiPokemon, level){
    try{
      const evoChain = await this._fetch(apiPokemon.species.evolution_chain.url);
      function findNode(n, name){
        if(n.species.name===name) return n;
        for(const ch of n.evolves_to){ const f = findNode(ch, name); if(f) return f; }
        return null;
      }
      const cur = findNode(evoChain.chain, apiPokemon.name);
      if(!cur) return null;
      const next = cur.evolves_to?.[0];
      if(!next) return null;
      const tr = next.evolution_details?.[0];
      if(tr?.min_level && level>=tr.min_level){
        const evo = await this.getPokemon(next.species.name);
        return evo;
      }
      return null;
    }catch(e){ return null; }
  }
};
