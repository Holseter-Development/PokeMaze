const AudioMgr = {
  tracks: {
    amb:  new Audio('assets/sfx/music/ambience.ogg'),
    wild: new Audio('assets/sfx/music/wild-battle.ogg'),
    win:  new Audio('assets/sfx/music/victory.ogg'),
  },
  current: null,
  play(name, {loop=false, volume=0.5}={}){
    const a = this.tracks[name]; if(!a) return;
    if(this.current && this.current !== a){ try{ this.current.pause(); this.current.currentTime=0; }catch(e){} }
    a.loop = loop; a.volume = volume;
    try { a.currentTime = 0; a.play().catch(()=>{}); } catch(e){}
    this.current = a;
  },
  stop(){ if(this.current){ try{ this.current.pause(); }catch(e){} this.current=null; } }
};
