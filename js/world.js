
const World = {
  width: 24, height: 16,
  grid: [],
  player: {x:1.5, y:1.5, dir:0, hp:100},
  exit: {x: 0, y: 0},

  tileAt(x, y){
    const xi = Math.floor(x), yi = Math.floor(y);
    if (yi < 0 || yi >= this.height || xi < 0 || xi >= this.width) return 1;
    return this.grid[yi][xi];
  },

  isWall(x, y){
    const t = this.tileAt(x, y);
    return t === 1 || t === 3 || t === 4;
  },

  gen(floor=1){
    const w = this.width, h = this.height;
    let grid = Array.from({length:h}, () => Array(w).fill(0));

    // initial random noise
    for (let y=0; y<h; y++){
      for (let x=0; x<w; x++){
        grid[y][x] = (Math.random() < 0.45) ? 1 : 0;
      }
    }

    // ensure borders are solid
    for (let x=0; x<w; x++){ grid[0][x]=1; grid[h-1][x]=1; }
    for (let y=0; y<h; y++){ grid[y][0]=1; grid[y][w-1]=1; }

    function countWalls(g,x,y){
      let c=0;
      for (let yy=-1; yy<=1; yy++){
        for (let xx=-1; xx<=1; xx++){
          if (xx===0 && yy===0) continue;
          const nx=x+xx, ny=y+yy;
          if (ny<0||ny>=h||nx<0||nx>=w || g[ny][nx]===1) c++;
        }
      }
      return c;
    }

    // smooth using cellular automata
    for (let i=0;i<4;i++){
      const newGrid = grid.map(r=>r.slice());
      for (let y=1; y<h-1; y++){
        for (let x=1; x<w-1; x++){
          const c = countWalls(grid,x,y);
          newGrid[y][x] = c >= 5 ? 1 : 0;
        }
      }
      grid = newGrid;
    }

    // clear starting area
    grid[1][1]=grid[1][2]=grid[2][1]=grid[2][2]=0;

    // find farthest reachable tile for exit
    const visited = Array.from({length:h}, ()=>Array(w).fill(false));
    const q=[[1,1,0]]; visited[1][1]=true;
    let far={x:1,y:1,d:0};
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    while(q.length){
      const [x,y,d]=q.shift();
      if(d>far.d) far={x,y,d};
      for(const [dx,dy] of dirs){
        const nx=x+dx, ny=y+dy;
        if(nx>0&&ny>0&&nx<w-1&&ny<h-1&&!visited[ny][nx]&&grid[ny][nx]===0){
          visited[ny][nx]=true;
          q.push([nx,ny,d+1]);
        }
      }
    }
    grid[far.y][far.x]=2;
    this.exit = {x: far.x, y: far.y};

    // place random boulders
    const bCount = 3 + Math.floor(Math.random()*3);
    for(let i=0;i<bCount;i++){
      const bw = 1 + Math.floor(Math.random()*3);
      const bh = 1 + Math.floor(Math.random()*3);
      const bx = 1 + Math.floor(Math.random()*(w-bw-1));
      const by = 1 + Math.floor(Math.random()*(h-bh-1));
      let ok=true;
      for(let y=by;y<by+bh;y++){
        for(let x=bx;x<bx+bw;x++){
          if(grid[y][x]!==0 || (x===1&&y===1) || (x===far.x&&y===far.y)) { ok=false; break; }
        }
        if(!ok) break;
      }
      if(!ok) continue;
      for(let y=by;y<by+bh;y++) for(let x=bx;x<bx+bw;x++) grid[y][x]=3;
    }

    // place spikes
    const sCount = 8 + Math.floor(Math.random()*5);
    for(let i=0;i<sCount;i++){
      const sx = 1 + Math.floor(Math.random()*(w-2));
      const sy = 1 + Math.floor(Math.random()*(h-2));
      if(grid[sy][sx]===0 && !(sx===1&&sy===1) && !(sx===far.x&&sy===far.y)) grid[sy][sx]=4;
    }

    this.grid = grid;
    this.player = {x:1.5, y:1.5, dir:0, hp:100};
  }
};
