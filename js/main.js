const Game = {
  state: {
    mode: 'home',
    floor: 1,
    party: [],
    items: { pokeball: 5, potion: 2 },
    money: 0,
    meta: { perks: [] },
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

    this.canvas = document.getElementById('view');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;

    World.gen(this.state.floor);

    this.bindControls();
    document.getElementById('btnEnter').onclick = ()=> this.enterDungeon();
    document.getElementById('btnHome').onclick  = ()=> this.showHome();
    document.getElementById('btnSave').onclick  = ()=> Storage.save(this.state);
    document.getElementById('btnLoad').onclick  = ()=>{
      const s = Storage.load();
      if (s) this.state = Object.assign(this.state, s);
      updateMetaUI(this.state);
      renderParty(this.state.party);
      if (this.state.mode === 'dungeon') World.gen(this.state.floor);
    };
    document.getElementById('btnHelp').onclick  = showHelp;

    updateMetaUI(this.state);
    renderParty(this.state.party);

    this.showHome(true);
    this.loop(0);
  },

  showHome(initial=false){
    this.state.mode = 'home';
    updateMetaUI(this.state);
    if (window.AudioMgr) AudioMgr.play('amb', {loop:true, volume:0.25});

    homeScreen(async (maybeStarter) => {
      if (maybeStarter) {
        const moves   = await API.chooseLevelUpMoves(maybeStarter, 1);
        const starter = Battle.createBattlerFromAPI(maybeStarter, 1, moves);
        this.state.party = [starter];
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
      pickStarter(async (p)=>{
        const moves = await API.chooseLevelUpMoves(p, 1);
        const starter = Battle.createBattlerFromAPI(p, 1, moves);
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
    if (this.state.mode !== 'dungeon') {
      const ctx=this.ctx, W=this.canvas.width, H=this.canvas.height;
      ctx.clearRect(0,0,W,H);
      const grad = ctx.createLinearGradient(0,0,0,H);
      grad.addColorStop(0,'#0d1528'); grad.addColorStop(1,'#0b0f19');
      ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
      return;
    }

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

    if (!this.state.battleActive && Math.random() < BASE_ENCOUNTER_RATE * dt) {
      await this.encounter();
    }

    if (this.keys[' ']){
      this.keys[' '] = false;
      if (!this.state.battleActive){
        const wild = await API.getRandomEncounter(this.state.floor, this.state.playerLevel);
        await Battle.startWild(this.state, wild);
        renderParty(this.state.party);
      }
    }

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
    const wild = await API.getRandomEncounter(this.state.floor, this.state.playerLevel);
    await Battle.startWild(this.state, wild);
    renderParty(this.state.party);
  },

  loop(t){
    const dt = Math.min(0.05, (t - this.lastStep)/1000);
    this.lastStep = t;

    this.step(dt);

    if (this.state.mode === 'dungeon') {
      Ray.render(this.ctx, this.canvas, World);
    }

    requestAnimationFrame(this.loop.bind(this));
  }
};

window.addEventListener('load', () => Game.init());
