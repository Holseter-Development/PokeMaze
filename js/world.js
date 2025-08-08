
const World = {
  width: 24, height: 16,
  grid: [],
  player: {x:1.5, y:1.5, dir:0, hp:100},
  gen(floor=1){
    const w=this.width, h=this.height;
    const grid = Array.from({length:h},()=>Array(w).fill(1));
    function carve(x,y){
      const dirs=[[1,0],[-1,0],[0,1],[0,-1]].sort(()=>Math.random()-0.5);
      for(const [dx,dy] of dirs){
        const nx=x+dx*2, ny=y+dy*2;
        if(nx>0&&ny>0&&nx<w-1&&ny<h-1&&grid[ny][nx]===1){
          grid[y+dy][x+dx]=0; grid[ny][nx]=0; carve(nx,ny);
        }
      }
    }
    grid[1][1]=0; carve(1,1);
    for(let i=0;i<4;i++){
      const rw=3+Math.floor(Math.random()*3), rh=3+Math.floor(Math.random()*3);
      const rx=2+Math.floor(Math.random()*(w-rw-2)), ry=2+Math.floor(Math.random()*(h-rh-2));
      for(let y=ry;y<ry+rh;y++) for(let x=rx;x<rx+rw;x++) grid[y][x]=0;
    }
    grid[h-2][w-2]=0;
    this.grid = grid;
    this.player = {x:1.5, y:1.5, dir:0, hp:100};
  },
  isWall(x,y){
    const xi = Math.floor(x), yi = Math.floor(y);
    if(yi<0||yi>=this.height||xi<0||xi>=this.width) return true;
    return this.grid[yi][xi]===1;
  }
};
