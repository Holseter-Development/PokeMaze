const Game = {
  state: {
    mode: 'home',
    floor: 1,
    party: [],
    items: { pokeball: 5, potion: 2 }, // simple bag for now
    money: 0,
    meta: { perks: [] },
    lock: false,
    battleActive: false,   // <— prevents overlapping encounters
    activeIndex: 0,

    // Trainer XP/level for difficulty scaling
    playerXp: 0,
    playerLevel: 1,
  },

  canvas: null, ctx: null,
  keys: {}, lastStep: 0,

  init(){
    Log.init();

    // Canvas
    this.canvas = document.getElementById('view');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;

    // Make sure a world exists BEFORE any render starts
    World.gen(this.state.floor);

    // Controls & UI
    this.bindControls();
    document.getElementById('btnEnter').onclick = ()=> this.enterDungeon();
    document.getElementById('btnHome').onclick  = ()=> this.showHome();
    document.getElementById('btnSave').onclick  = ()=> Storage.save(this.state);
    document.getElementById('btnLoad').onclick  = ()=>{
      const s = Storage.load();
      if (s) this.state = Object.assign(this.state, s);
      updateMetaUI(this.state);
      renderParty(this.state.party);
      // if we loaded into dungeon, ensure grid is ready
      if (this.state.mode === 'dungeon') World.gen(this.state.floor);
    };
    document.getElementById('btnHelp').onclick  = showHelp;

    updateMetaUI(this.state);
    renderParty(this.state.party);

    // Home first, then start main loop
    this.showHome(true);
    this.loop(0);
  },

  showHome(initial=false){
    this.state.mode = 'home';
    updateMetaUI(this.state);

    // start ambience on home
    if (window.AudioMgr) AudioMgr.play('amb', {loop:true, volume:0.25});

    homeScreen(async (maybeStarter) => {
      if (maybeStarter) {
        // Build starter (Lv5), register in Pokédex
        const moves   = await API.chooseLevelUpMoves(maybeStarter, 5);
        const starter = Battle.createBattlerFromAPI(maybeStarter, 5, moves);
        this.state.party       = [starter];
        this.state.activeIndex = 0;
        addDexEntry(starter);
        renderParty(this.state.party);
        Storage.save(this.state);
      }
      this.enterDungeon();
    });
  },

  enterDungeon(){
    if (!this.state.party.length) {
      // Safety: force starter if none exists
      pickStarter(async (p)=>{
        const moves = await API.chooseLevelUpMoves(p, 5);
        const starter = Battle.createBattlerFromAPI(p, 5, moves);
        this.state.party = [starter];
        this.state.activeIndex = 0;
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
    World.gen(this.state.floor);
    this.state.items.pokeball = Math.max(this.state.items.pokeball, 5);
    updateMetaUI(this.state);
    Log.write('Entered the dungeon.');
    if (window.AudioMgr) AudioMgr.play('amb', {loop:true, volume:0.25});
  },

  bindControls(){
    window.addEventListener('keydown', e => { this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup',   e => { this.keys[e.key.toLowerCase()] = false; });

    // Mouse look
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
    // Non-dungeon: draw a calm background and stop here
    if (this.state.mode !== 'dungeon') {
      const ctx=this.ctx, W=this.canvas.width, H=this.canvas.height;
      ctx.clearRect(0,0,W,H);
      const grad = ctx.createLinearGradient(0,0,0,H);
      grad.addColorStop(0,'#0d1528'); grad.addColorStop(1,'#0b0f19');
      ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
      return;
    }

    // Movement
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

    // Encounters (trainers disabled for now; only wilds)
    if (!this.state.battleActive && Math.random() < BASE_ENCOUNTER_RATE * dt) {
      await this.encounter();
    }

    // Optional: manual test encounter on Space
    if (this.keys[' ']) {
      this.keys[' '] = false;
      if (!this.state.battleActive) {
        const wild = await API.getRandomEncounter(this.state.floor, this.state.playerLevel);
        await Battle.startWild(this.state, wild);
        renderParty(this.state.party);
      }
    }

    // Exit tile → next floor + light auto-buy
    const atExit = Math.floor(p.x)===World.exit.x && Math.floor(p.y)===World.exit.y;
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
    const wild = await API.getRandomEncounter(this.state.floor, this.state.playerLevel);
    await Battle.startWild(this.state, wild);   // sets/clears battleActive internally
    renderParty(this.state.party);
  },

  loop(t){
    const dt = Math.min(0.05, (t - this.lastStep)/1000);
    this.lastStep = t;

    this.step(dt);

    // Only raycast in active dungeon mode
    if (this.state.mode === 'dungeon') {
      Ray.render(this.ctx, this.canvas, World);
    }

    requestAnimationFrame(this.loop.bind(this));
  }
};

window.addEventListener('load', () => Game.init());
