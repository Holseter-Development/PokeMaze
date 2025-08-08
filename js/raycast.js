
const Ray = {
  fov: Math.PI/3, depth: 20,
  render(ctx, canvas, world){
    const W=canvas.width, H=canvas.height;
    ctx.imageSmoothingEnabled = true;
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
    m.fillStyle='#0a1526'; m.fillRect(0,0,120,120);
    m.fillStyle='#243a62';
    for(let y=0;y<world.height;y++){
      for(let x=0;x<world.width;x++){
        if(world.grid[y][x]===1) m.fillRect(x*sx,y*sy,sx,sy);
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
