const Game = {
  state: {
    mode: 'home',
    floor: 1,
    party: [],
    items: { pokeball: 5 },
    money: 0,
    meta: { perks: [] },
    lock: false
  },
  canvas: null, ctx: null,
  keys: {}, lastStep: 0,

  init(){
    Log.init();

    // Canvas + context
    this.canvas = document.getElementById('view');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;

    // Ensure the world is generated BEFORE the loop ever runs
    World.gen(this.state.floor);

    // Controls & UI wiring
    this.bindControls();
    document.getElementById('btnEnter').onclick = ()=> this.enterDungeon();
    document.getElementById('btnHome').onclick  = ()=> this.showHome();
    document.getElementById('btnSave').onclick  = ()=> Storage.save(this.state);
    document.getElementById('btnLoad').onclick  = ()=>{
      const s = Storage.load();
      if (s) { this.state = s; }
      updateMetaUI(this.state);
      renderParty(this.state.party);
      // If we loaded into dungeon, make sure a grid exists for current floor
      if (this.state.mode === 'dungeon') World.gen(this.state.floor);
    };
    document.getElementById('btnHelp').onclick  = showHelp;

    updateMetaUI(this.state);
    renderParty(this.state.party);

    // Show home (starter picker lives here); then start the loop
    this.showHome(true);
    this.loop(0);
  },

  showHome(initial=false){
    this.state.mode = 'home';
    updateMetaUI(this.state);

    homeScreen(async (maybeStarter) => {
      if (maybeStarter) {
        // Build starter + add to Pokédex and HUD
        const moves   = await API.chooseLevelUpMoves(maybeStarter, 5);
        const starter = Battle.createBattlerFromAPI(maybeStarter, 5, moves);
        this.state.party = [starter];
        addDexEntry(starter);
        renderParty(this.state.party);
        Storage.save(this.state);
      }
      this.enterDungeon();
    });
  },

  enterDungeon(){
    if (!this.state.party.length) {
      // Safety: if somehow no party yet, force picking a starter
      pickStarter(async (p)=>{
        const moves = await API.chooseLevelUpMoves(p, 5);
        const starter = Battle.createBattlerFromAPI(p, 5, moves);
        this.state.party = [starter];
        addDexEntry(starter);
        renderParty(this.state.party);
        Storage.save(this.state);
        this.beginRun();
      });
    } else {
      this.beginRun();
    }
  },

  beginRun(){
    this.state.mode = 'dungeon';
    // Re-gen current floor each time you enter (fresh run)
    World.gen(this.state.floor);
    // Starter items, allow future perks to modify this
    this.state.items.pokeball = Math.max(this.state.items.pokeball, 5);
    updateMetaUI(this.state);
    Log.write('Entered the dungeon.');
  },

  bindControls(){
    window.addEventListener('keydown', e => { this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup',   e => { this.keys[e.key.toLowerCase()] = false; });

    // Mouse look (drag on canvas)
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

  async step(dt){
    // Render an idle background if not in dungeon mode
    if (this.state.mode !== 'dungeon') {
      const ctx=this.ctx, W=this.canvas.width, H=this.canvas.height;
      ctx.clearRect(0,0,W,H);
      const grad = ctx.createLinearGradient(0,0,0,H);
      grad.addColorStop(0,'#0d1528'); grad.addColorStop(1,'#0b0f19');
      ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
      return;
    }

    // --- Movement ---
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

    // --- Encounters while moving (restored) ---
    if (!this.state.lock && Math.random() < BASE_ENCOUNTER_RATE * dt) { this.encounter(); }
    if (!this.state.lock && Math.random() < TRAINER_RATE       * dt) { this.trainer();   }

    // Optional: manual test encounter on Space
    if (this.keys[' ']) {
      this.keys[' '] = false;
      const wild = await API.getRandomEncounter(this.state.floor); // correct method
      await Battle.startWild(this.state, wild);
      renderParty(this.state.party);
    }

    // --- Exit tile: next floor + auto-buy a couple balls if affordable ---
    const atExit = Math.floor(p.x)===World.width-2 && Math.floor(p.y)===World.height-2;
    if (atExit) {
      this.state.floor++;
      World.gen(this.state.floor);
      const BALL_PRICE = 200;
      const afford = Math.floor(this.state.money / BALL_PRICE);
      const buy    = Math.min(afford, 2);
      this.state.money         -= buy * BALL_PRICE;
      this.state.items.pokeball += buy;
      Log.write(`Floor cleared! Advanced to Floor ${this.state.floor}. Auto-bought ${buy} Poké Ball(s).`);
      updateMetaUI(this.state);
    }
  },

  async encounter(){
    const wild = await API.getRandomEncounter(this.state.floor);
    await Battle.startWild(this.state, wild);
    renderParty(this.state.party);
  },

  async trainer(){
    const party = await API.getTrainerParty(this.state.floor);
    const res = await Battle.startTrainer(this.state, party);
    if(res==='defeat'){ this.onDefeat(); }
  },

  onDefeat(){
    Log.write('You were defeated. Returning home. Progress persists.');
    this.state.mode = 'home';
    this.state.party.forEach(p=>{ p.hp = p.maxhp; });
    this.state.items.pokeball = Math.max(this.state.items.pokeball, 3);
    updateMetaUI(this.state);
    Storage.save(this.state);
    this.showHome();
  },

  loop(t){
    const dt = Math.min(0.05, (t - this.lastStep) / 1000);
    this.lastStep = t;

    this.step(dt);

    // Only raycast when actively in the dungeon
    if (this.state.mode === 'dungeon') {
      Ray.render(this.ctx, this.canvas, World);
    }

    requestAnimationFrame(this.loop.bind(this));
  }
};

window.addEventListener('load', () => Game.init());
