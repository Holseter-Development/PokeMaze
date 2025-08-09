// Simple audio manager with browser unlock and cries
const AudioMgr = {
  tracks: {
    amb:  new Audio('assets/sfx/music/ambience.ogg'),
    wild: new Audio('assets/sfx/music/wild-battle.ogg'),
    win:  new Audio('assets/sfx/music/victory.ogg'),
  },
  unlocked: false,
  current: null,
  muted: false,

  _unlockOnce(){
    if (this.unlocked) return;
    const tryPlay = a => { try { a.volume = 0; a.play().then(()=>{ a.pause(); a.currentTime=0; }).catch(()=>{}); } catch(e){} };
    Object.values(this.tracks).forEach(tryPlay);
    this.unlocked = true;
  },

  init(){
    const onFirstInteract = () => {
      this._unlockOnce();
      window.removeEventListener('click', onFirstInteract);
      window.removeEventListener('keydown', onFirstInteract);
      window.removeEventListener('pointerdown', onFirstInteract);
    };
    window.addEventListener('click', onFirstInteract);
    window.addEventListener('keydown', onFirstInteract);
    window.addEventListener('pointerdown', onFirstInteract);
  },

  play(name, {loop=false, volume=0.45}={}){
    const a = this.tracks[name];
    if (!a) return;
    if (this.current && this.current !== a){
      try { this.current.pause(); } catch(e){}
    }
    a.loop = loop;
    a.volume = volume;
    a.muted = this.muted;
    try { a.currentTime = 0; a.play().catch(()=>{}); } catch(e){}
    this.current = a;
  },

  stop(){
    if (!this.current) return;
    try { this.current.pause(); } catch(e){}
    this.current = null;
  },

  toggleMute(){
    this.muted = !this.muted;
    Object.values(this.tracks).forEach(t=>{ t.muted = this.muted; });
    return this.muted;
  },

  async playCry(url){
    if (!url) return;
    try {
      const s = new Audio(url);
      s.volume = 0.7;
      await s.play().catch(()=>{});
    } catch(e){}
  }
};

window.AudioMgr = AudioMgr;
