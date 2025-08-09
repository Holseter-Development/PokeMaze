
const Ray = {
  fov: Math.PI/3, depth: 20,
  render(ctx, canvas, world){
    const W=canvas.width, H=canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,W,H);
    // ceiling
    const sky = ctx.createLinearGradient(0,0,0,H/2);
    sky.addColorStop(0,'#0c1528'); sky.addColorStop(1,'#0a1020');
    ctx.fillStyle = sky; ctx.fillRect(0,0,W,H/2);
    // floor
    const floor = ctx.createLinearGradient(0,H/2,0,H);
    floor.addColorStop(0,'#0a0f1b'); floor.addColorStop(1,'#0a0e16');
    ctx.fillStyle = floor; ctx.fillRect(0,H/2,W,H/2);

    const step = this.fov/W;
    for(let col=0; col<W; col++){
      const angle = world.player.dir - this.fov/2 + step*col;
      let dist=0, hit=false;
      let x=world.player.x, y=world.player.y;
      const dx=Math.cos(angle)*0.05, dy=Math.sin(angle)*0.05;
      while(dist<this.depth){
        x+=dx; y+=dy; dist+=0.05;
        if(world.isWall(x,y)){ hit=true; break; }
      }
      if(!hit) continue;
      const height = Math.min(H, H/(dist*0.5));
      const y0 = (H-height)/2;
      const fog = Math.max(0, Math.min(1, dist/this.depth));
      const r = Math.floor(40*(1-fog)+10);
      const g = Math.floor(90*(1-fog)+10);
      const b = Math.floor(160*(1-fog)+25);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(col, y0, 1, height);
    }
    const sprites = (world.entities||[]).map(e=>{
      const dx = e.x - world.player.x;
      const dy = e.y - world.player.y;
      const dist = Math.hypot(dx,dy);
      let ang = Math.atan2(dy,dx) - world.player.dir;
      while(ang<-Math.PI) ang+=Math.PI*2; while(ang>Math.PI) ang-=Math.PI*2;
      return Object.assign({dist,ang}, e);
    }).sort((a,b)=>b.dist-a.dist);
    function hasLoS(s){
      let x=world.player.x, y=world.player.y;
      const ang = Math.atan2(s.y-world.player.y, s.x-world.player.x);
      const dx=Math.cos(ang)*0.05, dy=Math.sin(ang)*0.05;
      let d=0; while(d<s.dist){ x+=dx; y+=dy; d+=0.05; if(world.isWall(x,y)) return false; }
      return true;
    }
    sprites.forEach(s=>{
      if(Math.abs(s.ang) > this.fov/2) return;
      if(!hasLoS(s)) return;
      const size = Math.min(H, H/(s.dist*0.5));
      const x = (s.ang + this.fov/2)/this.fov * W - size/2;
      const y = H - size;
      if(!s._img || s._img.src !== s.sprite){ const i=new Image(); i.src=s.sprite; s._img=i; }
      ctx.drawImage(s._img, x, y, size, size);
    });
    const fogGrad = ctx.createLinearGradient(0,0,0,H);
    fogGrad.addColorStop(0,'rgba(0,0,0,0.0)');
    fogGrad.addColorStop(0.6,'rgba(0,0,0,0.15)');
    fogGrad.addColorStop(1,'rgba(0,0,0,0.35)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0,0,W,H);

    // minimap
    const m = document.getElementById('minimapCanvas').getContext('2d');
    m.clearRect(0,0,120,120);
    const sx = 120/world.width, sy = 120/world.height;
    m.fillStyle='#000'; m.fillRect(0,0,120,120);
    if(world.discovered){
      for(let y=0;y<world.height;y++){
        for(let x=0;x<world.width;x++){
          if(!world.discovered[y][x]) continue;
          if(world.grid[y][x]===1){ m.fillStyle='#243a62'; }
          else{ m.fillStyle='#0a1526'; }
          m.fillRect(x*sx,y*sy,sx,sy);
        }
      }
    }
    m.fillStyle='#7bf';
    m.beginPath(); m.arc(world.player.x*sx, world.player.y*sy, 2.5, 0, Math.PI*2); m.fill();
    m.strokeStyle='#7bf';
    m.beginPath(); m.moveTo(world.player.x*sx, world.player.y*sy);
    m.lineTo((world.player.x+Math.cos(world.player.dir)*2)*sx, (world.player.y+Math.sin(world.player.dir)*2)*sy);
    m.stroke();
  }
};
