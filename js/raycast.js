// raycast.js — textured raycaster using a 384x768 (48x48 tiles) atlas.
// Ground: rows 4–5 (all cols). Walls: row 8 col 5 only. Roof: row 1 cols 2–5.

const Ray = {
  // View + physics
  fov: Math.PI / 3,
  depth: 24,

  // Atlas config
  TILE: 48,
  ATLAS_COLS: 8,
  atlas: null,
  atlasLoaded: false,
  atlasPath: 'assets/atlas.png',

  // Tile rules
  TEX: {
    GROUND_ROWS: [4, 5],          // all columns allowed (1..8)
    ROOF_ROW: 1,                  // only columns 2..5
    ROOF_COLS: [2, 3, 4, 5],
    WALL_ROW: 8,                  // only column 5
    WALL_COL: 5
  },

  // --- setup ---
  ensureAtlas(){
    if (this.atlas) return;
    this.atlas = new Image();
    this.atlas.src = this.atlasPath;
    this.atlas.onload = () => { this.atlasLoaded = true; };
    this.atlas.onerror = () => { console.warn('Failed to load', this.atlasPath); };
  },

  // --- helpers ---
  // fast, stable hash per integer cell
  h(x,y){ const n = (x*73856093) ^ (y*19349663); return (n >>> 0); },

  // pick 1..8 column by hashing cell
  pickAnyCol(xi, yi){ return (this.h(xi, yi) % this.ATLAS_COLS) + 1; },

  // pick from a constrained set (e.g., [2,3,4,5])
  pickFromSet(xi, yi, cols){ return cols[this.h(xi, yi) % cols.length]; },

  // 1-indexed row/col -> source rect
  tileRect(row, col){
    const sx = (col - 1) * this.TILE;
    const sy = (row - 1) * this.TILE;
    return { sx, sy, sw: this.TILE, sh: this.TILE };
  },

  // --- core raycast (DDA) ---
  cast(world, ox, oy, dir){
    const mapW = world.width, mapH = world.height;

    let mapX = Math.floor(ox);
    let mapY = Math.floor(oy);

    const rayDirX = Math.cos(dir);
    const rayDirY = Math.sin(dir);

    const invX = (rayDirX !== 0) ? 1 / rayDirX : 1e9;
    const invY = (rayDirY !== 0) ? 1 / rayDirY : 1e9;

    const deltaDistX = Math.abs(invX);
    const deltaDistY = Math.abs(invY);

    let stepX, stepY, sideDistX, sideDistY;

    if (rayDirX < 0){ stepX = -1; sideDistX = (ox - mapX) * deltaDistX; }
    else { stepX = 1; sideDistX = (mapX + 1 - ox) * deltaDistX; }

    if (rayDirY < 0){ stepY = -1; sideDistY = (oy - mapY) * deltaDistY; }
    else { stepY = 1; sideDistY = (mapY + 1 - oy) * deltaDistY; }

    let hit = false, side = 0;
    for (let i=0; i<128; i++){ // safety cap
      if (sideDistX < sideDistY){ sideDistX += deltaDistX; mapX += stepX; side = 0; }
      else { sideDistY += deltaDistY; mapY += stepY; side = 1; }

      if (mapX<0 || mapY<0 || mapX>=mapW || mapY>=mapH) break;
      if (world.grid[mapY][mapX] === 1){ hit = true; break; }
    }

    if (!hit){
      return { hit:false, dist:this.depth, mapX, mapY, side, hitX:ox, hitY:oy };
    }

    const perpWallDist = (side===0)
      ? (mapX - ox + (1 - stepX)/2) / (rayDirX || 1e-9)
      : (mapY - oy + (1 - stepY)/2) / (rayDirY || 1e-9);

    const hitX = ox + rayDirX * perpWallDist;
    const hitY = oy + rayDirY * perpWallDist;

    return { hit:true, dist: Math.min(perpWallDist, this.depth), mapX, mapY, side, hitX, hitY };
  },

  // draw a 1px vertical slice of a tile column scaled to slice height
  drawWallColumn(ctx, canvasH, colX, sliceH, u, row, col, fog){
    if (!this.atlasLoaded) return;
    const {sx, sy, sw, sh} = this.tileRect(row, col);
    const srcX = sx + Math.max(0, Math.min(sw - 1, (u * sw) | 0));
    const y0 = (canvasH - sliceH) / 2;

    ctx.drawImage(this.atlas, srcX, sy, 1, sh, colX, y0, 1, sliceH);

    if (fog > 0){
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.6, fog*0.9)})`;
      ctx.fillRect(colX, y0, 1, sliceH);
    }
  },

  // floor + ceiling sampler (2x2 blocks for speed)
drawFloorAndCeiling(ctx, canvas, world){
  if (!this.atlasLoaded) return;

  const W = canvas.width, H = canvas.height;
  const half = H >> 1;

  const px = world.player.x, py = world.player.y, dir = world.player.dir;
  const dirX = Math.cos(dir), dirY = Math.sin(dir);
  const planeX = Math.cos(dir + Math.PI/2) * Math.tan(this.fov/2);
  const planeY = Math.sin(dir + Math.PI/2) * Math.tan(this.fov/2);

  const ray0x = dirX - planeX, ray0y = dirY - planeY;
  const ray1x = dirX + planeX, ray1y = dirY + planeY;

  const scale = 4; // higher = faster, lower = sharper
  const stepY = scale;
  const stepX = scale;

  for (let y = half; y < H; y += stepY){
    const p = (y - half);
    const rowDist = (half) / (p || 1);

    let floorX = px + rowDist * ray0x;
    let floorY = py + rowDist * ray0y;

    const floorStepX = rowDist * (ray1x - ray0x) / (W / stepX);
    const floorStepY = rowDist * (ray1y - ray0y) / (W / stepX);

    for (let x = 0; x < W; x += stepX){
      const wx = floorX, wy = floorY;
      const gx = Math.floor(wx), gy = Math.floor(wy);
      const gu = wx - gx, gv = wy - gy;

      // Ground tile
      const gRow = this.TEX.GROUND_ROWS[(this.h(gx, gy) >> 2) % this.TEX.GROUND_ROWS.length];
      const gCol = this.pickAnyCol(gx, gy);
      const gRect = this.tileRect(gRow, gCol);
      const gsrcX = gRect.sx + ((gu*this.TILE)|0);
      const gsrcY = gRect.sy + ((gv*this.TILE)|0);
      ctx.drawImage(this.atlas, gsrcX, gsrcY, 1, 1, x, y, stepX, stepY);

      // Roof tile
      const cRow = this.TEX.ROOF_ROW;
      const cCol = this.pickFromSet(gx, gy, this.TEX.ROOF_COLS);
      const cRect = this.tileRect(cRow, cCol);
      const cu = gu, cv = 1 - gv;
      const csrcX = cRect.sx + ((cu*this.TILE)|0);
      const csrcY = cRect.sy + ((cv*this.TILE)|0);
      ctx.drawImage(this.atlas, csrcX, csrcY, 1, 1, x, (half - (y - half) - stepY), stepX, stepY);

      floorX += floorStepX;
      floorY += floorStepY;
    }
  }
},


  // --- main render ---
  render(ctx, canvas, world){
    this.ensureAtlas();

    const W = canvas.width, H = canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,W,H);

    // Draw floor & ceiling first (or a simple gradient until the atlas loads)
    if (this.atlasLoaded){
      this.drawFloorAndCeiling(ctx, canvas, world);
    }else{
      const sky = ctx.createLinearGradient(0,0,0,H/2);
      sky.addColorStop(0,'#0c1528'); sky.addColorStop(1,'#0a1020');
      ctx.fillStyle = sky; ctx.fillRect(0,0,W,H/2);
      const floor = ctx.createLinearGradient(0,H/2,0,H);
      floor.addColorStop(0,'#0a0f1b'); floor.addColorStop(1,'#0a0e16');
      ctx.fillStyle = floor; ctx.fillRect(0,H/2,W,H/2);
    }

    // Walls
    const stepAng = this.fov / W;
    for(let col=0; col<W; col++){
      const ang = world.player.dir - this.fov/2 + stepAng*col;
      const ray = this.cast(world, world.player.x, world.player.y, ang);
      if (!ray.hit) continue;

      const dist = Math.max(0.0001, ray.dist);
      const sliceH = Math.min(H, (H / (dist*0.5)));

      let u = (ray.side === 0)
        ? (ray.hitY - Math.floor(ray.hitY))
        : (ray.hitX - Math.floor(ray.hitX));

      // flip to reduce seam differences
      if ((ray.side === 0 && Math.cos(ang) > 0) || (ray.side === 1 && Math.sin(ang) < 0)) u = 1 - u;

      // WALL: fixed to row 8, col 5
      const fog = Math.max(0, Math.min(1, dist / this.depth));
      this.drawWallColumn(ctx, H, col, sliceH, u, this.TEX.WALL_ROW, this.TEX.WALL_COL, fog);
    }

    // --- Sprites/entities (kept lightweight) ---
    const sprites = (world.entities||[]).map(e=>{
      const dx = e.x - world.player.x, dy = e.y - world.player.y;
      const dist = Math.hypot(dx,dy);
      let ang = Math.atan2(dy,dx) - world.player.dir;
      while(ang<-Math.PI) ang+=Math.PI*2;
      while(ang> Math.PI) ang-=Math.PI*2;
      return Object.assign({dist,ang}, e);
    }).sort((a,b)=>b.dist-a.dist);

    const hasLoS = (s)=>{
      let x=world.player.x, y=world.player.y;
      const ang = Math.atan2(s.y-world.player.y, s.x-world.player.x);
      const dx=Math.cos(ang)*0.05, dy=Math.sin(ang)*0.05;
      let d=0, limit = Math.hypot(s.x-world.player.x, s.y-world.player.y);
      while(d<limit){ x+=dx; y+=dy; d+=0.05; if(world.isWall(x,y)) return false; }
      return true;
    };

    for(const s of sprites){
      if(Math.abs(s.ang) > this.fov/2) continue;
      if(!hasLoS(s)) continue;
      const size = Math.min(H, H/(s.dist*0.5));
      const x = (s.ang + this.fov/2)/this.fov * W - size/2;
      const y = H - size;
      if(!s._img || s._img.src !== s.sprite){ const i=new Image(); i.src=s.sprite; s._img=i; }
      if (s._img.complete) ctx.drawImage(s._img, x, y, size, size);
    }

    // --- Minimap ---
    const mm = document.getElementById('minimapCanvas');
    if (mm){
      const m = mm.getContext('2d');
      m.clearRect(0,0,120,120);
      const sx = 120/world.width, sy = 120/world.height;
      m.fillStyle='#000'; m.fillRect(0,0,120,120);
      if(world.discovered){
        for(let y=0;y<world.height;y++){
          for(let x=0;x<world.width;x++){
            if(!world.discovered[y][x]) continue;
            m.fillStyle = (world.grid[y][x]===1) ? '#243a62' : '#0a1526';
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
  }
};
