const Game = {
  state: {
    mode: 'home',
    floor: 1,
    party: [],
    items: { pokeball: 5, greatball: 0, potion: 2 },
    money: 0,
    meta: { perks: [], bonusBalls: 0, captured: [], unlockedFloors:[1] },
    maxFloorReached: 1,
    lock: false,
    battleActive: false,
    activeIndex: 0,
    playerXp: 0,
    playerLevel: 1,
  },

  canvas: null, ctx: null,
  keys: {}, lastStep: 0,

  async ensureAudioLoaded(){
    if (!window.AudioMgr){
      await new Promise(res=>{
        const s = document.createElement('script');
        s.src = 'js/audio.js'; s.onload = res; document.body.appendChild(s);
      });
    }
    if (window.AudioMgr) AudioMgr.init();
  },

  init(){
    Log.init();
    this.ensureAudioLoaded();

    // Auto-load any saved state and ensure meta fields exist
    const loaded = Storage.load();
    if (loaded) {
      this.state = Object.assign(this.state, loaded);
      this.state.items = Object.assign({pokeball:5, greatball:0, potion:2}, loaded.items||{});
      this.state.meta = Object.assign({perks: [], bonusBalls: 0, captured: [], unlockedFloors:[1]}, loaded.meta||{});
    }

    this.canvas = document.getElementById('view');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    World.genHome();

    this.bindControls();
    document.getElementById('btnEnter').onclick = ()=> this.enterDungeon();
    document.getElementById('btnHome').onclick  = ()=> this.showHome();
    document.getElementById('btnSave').onclick  = ()=> Storage.save(this.state);
    document.getElementById('btnLoad').onclick  = ()=>{
      const s = Storage.load();
      if (s) {
        this.state = Object.assign(this.state, s);
        this.state.items = Object.assign({pokeball:5, greatball:0, potion:2}, s.items||{});
        this.state.meta = Object.assign({perks: [], bonusBalls: 0, captured: [], unlockedFloors:[1]}, s.meta||{});
      }
      updateMetaUI(this.state);
      renderParty(this.state.party);
      if (this.state.mode === 'dungeon') World.gen(this.state.floor);
      };
    document.getElementById('btnHelp').onclick  = showHelp;
    document.getElementById('btnMute').onclick  = ()=>{
      if(window.AudioMgr){ const m = AudioMgr.toggleMute(); document.getElementById('btnMute').textContent = m ? 'Unmute' : 'Mute'; }
    };

    updateMetaUI(this.state);
    renderParty(this.state.party);

    this.showHome(true);
    this.loop(0);
  },

  showHome(initial=false){
    this.state.mode = 'home';

    // Heal the party when returning home
    this.state.party.forEach(p => {
      p.hp = p.maxhp;
      p.status = null;
      p.fainted = false;
      if (Array.isArray(p.moves)) {
        p.moves.forEach(m => { m.pp = m.ppMax || m.pp; });
      }
    });
    renderParty(this.state.party);

    Log.write('All Pokémon have been healed.');

    // unlock new starting floors every 5 floors reached
    const highest = Math.floor((this.state.maxFloorReached||1)/5)*5;
    const unlocked=this.state.meta.unlockedFloors||[1];
    for(let f=5;f<=highest;f+=5){ if(!unlocked.includes(f)) unlocked.push(f); }
    this.state.meta.unlockedFloors = unlocked;
    this.state.floor = 1;
    this.state.maxFloorReached = 1;

    updateMetaUI(this.state);
    Storage.save(this.state);

    World.genHome();

    if(!this.state.party.length){
      Log.write('Visit Professor Oak to choose your starter.');
    }

    if (window.AudioMgr) AudioMgr.play('amb', {loop:true, volume:0.25});
  },

  enterDungeon(){
    if (!this.state.party.length) {
      Log.write('You need a Pokémon from Professor Oak first.');
      return;
    }
    const opts=this.state.meta.unlockedFloors||[1];
    let start=opts[0];
    if(opts.length>1){
      const input=prompt(`Start at which floor? Available: ${opts.join(', ')}`, String(start));
      const num=parseInt(input,10); if(opts.includes(num)) start=num;
    }
    this.state.floor=start;
    this.beginRun();
  },

  beginRun(){
    this.state.mode = 'dungeon';
    World.gen(this.state.floor);
    this.state.maxFloorReached = Math.max(this.state.maxFloorReached||1, this.state.floor);
    const baseBalls = 5 + (this.state.meta.bonusBalls||0);
    this.state.items.pokeball = Math.max(this.state.items.pokeball, baseBalls);
    updateMetaUI(this.state);
    Log.write(`Entered the dungeon with ${this.state.items.pokeball} Poké Ball(s).`);
    if (window.AudioMgr) AudioMgr.play('amb', {loop:true, volume:0.25});
  },

  bindControls(){
    window.addEventListener('keydown', e => { 
      this.keys[e.key.toLowerCase()] = true; 
      if(e.key === ' '){ this.interact(); }
    });
    window.addEventListener('keyup',   e => { this.keys[e.key.toLowerCase()] = false; });

    let dragging=false, lastX=0;
    this.canvas.addEventListener('mousedown', e => { dragging=true; lastX=e.clientX; });
    window.addEventListener('mouseup', ()=> dragging=false);
    window.addEventListener('mousemove', e => {
      if (dragging) {
        const dx = e.clientX - lastX; lastX = e.clientX;
        World.player.dir += dx * 0.003;
      }
    });
  },

  interact(){
    if(this.state.mode !== 'home') return;
    const p = World.player;
    const npc = (World.entities||[]).find(e=>Math.hypot(e.x-p.x, e.y-p.y) < 1);
    if(!npc) return;
    World.animate(npc);
    if(npc.type==='oak') this.talkOak();
    else if(npc.type==='shop') this.openShop();
  },

  openShop(){
    const html = `
      <p>Welcome! What would you like?</p>
      <button id="buyPotion" class="btn-wide">Potion (₽100)</button>
      <button id="buyGreat" class="btn-wide">Great Ball (₽300)</button>`;
    const m = modal(html,{title:'Shop'});
    m.querySelector('#buyPotion').onclick = ()=>{
      const cost=100;
      if((this.state.money||0) >= cost){
        this.state.money -= cost;
        this.state.items.potion = (this.state.items.potion||0)+1;
        Log.write('Bought a potion.');
        updateMetaUI(this.state); Storage.save(this.state);
      }else{ Log.write('Not enough money.'); }
    };
    m.querySelector('#buyGreat').onclick = ()=>{
      const cost=300;
      if((this.state.money||0) >= cost){
        this.state.money -= cost;
        this.state.items.greatball = (this.state.items.greatball||0)+1;
        Log.write('Bought a Great Ball.');
        updateMetaUI(this.state); Storage.save(this.state);
      }else{ Log.write('Not enough money.'); }
    };
  },

  async talkOak(){
    if(!this.state.party.length){
      pickStarter(async (p)=>{
        const moves = await API.chooseLevelUpMoves(p,1);
        const starter = Battle.createBattlerFromAPI(p,1,moves);
        this.state.party=[starter]; this.state.activeIndex=0;
        addDexEntry(starter); renderParty(this.state.party); updateMetaUI(this.state); Storage.save(this.state);
        Log.write(`You chose ${starter.displayName}!`);
      });
      return;
    }
    const eligible = this.state.party.map((p,i)=>({p,i}))
      .filter(x=>x.p.hp===x.p.maxhp && x.p.xp >= x.p.next);
    let html = `<p>Professor Oak: Need assistance?</p>
      <button id="oakTips" class="btn-wide">Any tips?</button>`;
    if(eligible.length){
      html += `<p>Evolve a Pokémon:</p><div class="choice-grid">`+
        eligible.map(x=>`<div class="choice" data-i="${x.i}"><div><b>${x.p.displayName}</b> Lv.${x.p.level}</div></div>`).join('')+
        `</div>`;
    }
    const m = modal(html,{title:'Professor Oak'});
    m.querySelector('#oakTips').onclick = ()=>{ Log.write('Oak: Train hard and catch many Pokémon!'); };
    if(eligible.length){
      m.querySelectorAll('.choice').forEach(el=>{
        el.onclick = async ()=>{
          const i = parseInt(el.getAttribute('data-i'),10);
          m.classList.add('hidden'); m.innerHTML='';
          await this.levelUp(i);
        };
      });
    }
  },

  async levelUp(idx){
    const me = this.state.party[idx];
    while(me.xp >= me.next){
      me.xp -= me.next; me.level++; me.next = 50 + me.level*25;
      me.maxhp += 3; me.hp = me.maxhp;
      me.atk+=2; me.def+=2; me.spa+=2; me.spd+=2; me.spe+=1;
      me.moves.forEach(m => { m.ppMax = (m.ppMax||m.pp||20) + 1; m.pp = Math.min(m.ppMax, (m.pp||m.ppMax)); });
      Log.write(`${me.displayName} grew to Lv.${me.level}!`);
      await Battle.maybeEvolve(this.state, idx);
    }
    renderParty(this.state.party); updateMetaUI(this.state); Storage.save(this.state);
  },

  async step(dt){
    if (this.state.mode !== 'home' && this.state.mode !== 'dungeon') return;

    const speed = 2.1, rot = 2.5, p = World.player;
    const forward = (this.keys['w']?1:0) - (this.keys['s']?1:0);
    const strafe  = (this.keys['d']?1:0) - (this.keys['a']?1:0);
    const turn    = (this.keys['arrowright']?1:0) - (this.keys['arrowleft']?1:0);
    p.dir += turn * rot * dt;
    const dx = Math.cos(p.dir)*forward - Math.sin(p.dir)*strafe;
    const dy = Math.sin(p.dir)*forward + Math.cos(p.dir)*strafe;
    const nx = p.x + dx * speed * dt;
    const ny = p.y + dy * speed * dt;
    if(!World.isWall(nx, p.y)) p.x = nx;
    if(!World.isWall(p.x, ny)) p.y = ny;
    World.discover(Math.floor(p.x), Math.floor(p.y));

    if (this.state.mode === 'dungeon'){
      if (!this.state.battleActive && Math.random() < BASE_ENCOUNTER_RATE * dt) {
        await this.encounter();
      }

      if (this.keys[' ']){
        this.keys[' '] = false;
        if (!this.state.battleActive){
          const target = World.entities.find(e=>Math.hypot(e.x-p.x, e.y-p.y)<1);
          if(target){
            if(target.type==='ladder'){
              this.state.floor++;
              this.state.maxFloorReached = Math.max(this.state.maxFloorReached, this.state.floor);
              World.gen(this.state.floor);
              const BALL_PRICE = 200;
              const afford = Math.floor(this.state.money / BALL_PRICE);
              const buy    = Math.min(afford, 2);
              this.state.money         -= buy * BALL_PRICE;
              this.state.items.pokeball += buy;
              Log.write(`Descended to Floor ${this.state.floor}. Auto-bought ${buy} Poké Ball(s).`);
              updateMetaUI(this.state);
            }else if(target.type==='chest' && !target.opened){
              target.opened=true;
              target.sprite=`assets/sprites/gif/${['Chest3.gif','Chest3.gif','Chest2.gif','BigChest.gif'][target.level]}`;
              target._img=null;
              this.state.money += target.loot.money||0;
              this.state.items.pokeball += target.loot.pokeball||0;
              this.state.items.potion += target.loot.potion||0;
              Log.write('You opened a chest and found loot!');
              updateMetaUI(this.state); Storage.save(this.state);
            }else if(target.requires){
              const has=this.state.party.some(pk=>pk.types.includes(target.requires));
              if(has){
                Log.write(`Your Pokémon cleared the ${target.kind}.`);
                World.grid[Math.floor(target.y)][Math.floor(target.x)] = 0;
                World.entities = World.entities.filter(e=>e!==target);
              }else{
                Log.write(`A ${target.kind} blocks the way. A ${target.requires}-type Pokémon could clear it.`);
              }
            }
          }else{
            const wild = await API.getRandomEncounter(this.state.floor, this.state.playerLevel);
            await Battle.startWild(this.state, wild);
            renderParty(this.state.party);
          }
        }
      }

      const trap = World.entities.find(e=>e.type==='trap' && !e.triggered && Math.floor(e.x)===Math.floor(p.x) && Math.floor(e.y)===Math.floor(p.y));
      if(trap){
        trap.triggered=true;
        World.player.hp = Math.max(0, World.player.hp - (trap.damage||5));
        Log.write('A trap was triggered!');
      }
    }
  },

  async encounter(){
    const wild = await API.getRandomEncounter(this.state.floor, this.state.playerLevel);
    await Battle.startWild(this.state, wild);
    renderParty(this.state.party);
  },

  loop(t){
    const dt = Math.min(0.05, (t - this.lastStep)/1000);
    this.lastStep = t;

    this.step(dt);

    if (this.state.mode === 'dungeon' || this.state.mode === 'home') {
      Ray.render(this.ctx, this.canvas, World);
    }

    requestAnimationFrame(this.loop.bind(this));
  }
};

window.addEventListener('load', () => Game.init());
