
const World = {
  width: 24, height: 16,
  grid: [],
  entities: [],
  player: {x:1.5, y:1.5, dir:0, hp:100},
  gen(floor=1){
    // Basic room-and-corridor generator so the dungeon isn't just
    // corridors.  It also spawns decorative objects, traps, a loot
    // chest and a single ladder to the next floor.
    this.width = 32; this.height = 32;
    const w=this.width, h=this.height;
    const grid = Array.from({length:h},()=>Array(w).fill(1));

    const rooms=[];
    const roomCount = 6 + Math.floor(Math.random()*3);
    for(let i=0;i<roomCount;i++){
      const rw=3+Math.floor(Math.random()*4), rh=3+Math.floor(Math.random()*4);
      const rx=1+Math.floor(Math.random()*(w-rw-2)), ry=1+Math.floor(Math.random()*(h-rh-2));
      rooms.push({x:rx,y:ry,w:rw,h:rh,cx:Math.floor(rx+rw/2),cy:Math.floor(ry+rh/2)});
      for(let y=ry;y<ry+rh;y++) for(let x=rx;x<rx+rw;x++) grid[y][x]=0;
    }

    function tunnel(ax,ay,bx,by){
      let x=ax, y=ay;
      while(x!==bx){ grid[y][x]=0; x+=x<bx?1:-1; }
      while(y!==by){ grid[y][x]=0; y+=y<by?1:-1; }
      grid[by][bx]=0;
    }
    rooms.sort((a,b)=>a.cx-b.cx);
    for(let i=1;i<rooms.length;i++){
      tunnel(rooms[i-1].cx, rooms[i-1].cy, rooms[i].cx, rooms[i].cy);
    }

    // place player at first room
    const start=rooms[0];
    this.player = {x:start.cx+0.5, y:start.cy+0.5, dir:0, hp:100};

    const entities=[];

    // decorative rocks and cave features
    const decorSprites=['rock.png','stalactite.png','stalagmite.png'];
    for(let y=1;y<h-1;y++){
      for(let x=1;x<w-1;x++){
        if(grid[y][x]===0 && Math.random()<0.05){
          const spr=decorSprites[Math.floor(Math.random()*decorSprites.length)];
          entities.push({x:x+0.5,y:y+0.5,sprite:`assets/sprites/static/${spr}`,type:'decor'});
        }
      }
    }

    // random obstacle that requires a pokemon type to clear
    if(Math.random()<0.3){
      const r=rooms[Math.floor(Math.random()*rooms.length)];
      const ox=r.x+Math.floor(Math.random()*r.w);
      const oy=r.y+Math.floor(Math.random()*r.h);
      grid[oy][ox]=1;
      entities.push({x:ox+0.5,y:oy+0.5,type:'obstacle',kind:'vines',requires:'fire',sprite:'assets/sprites/static/vines.png'});
    }

    // traps
    for(let i=0;i<3;i++){
      const r=rooms[Math.floor(Math.random()*rooms.length)];
      const tx=r.x+1+Math.floor(Math.random()*(r.w-2));
      const ty=r.y+1+Math.floor(Math.random()*(r.h-2));
      entities.push({x:tx+0.5,y:ty+0.5,type:'trap',damage:10,triggered:false});
    }

    // loot room and chest
    const lootRoom = rooms[Math.floor(Math.random()*(rooms.length-1))+1];
    const chestLevels=['Chest3.png','Chest3.png','Chest2.png','BigChest.png'];
    const level=Math.min(3,Math.floor(floor/5));
    const chestSprite = chestLevels[level];
    const loot={money:50*(level+1), pokeball:1+level, potion:level>1?1:0};
    entities.push({x:lootRoom.cx+0.5,y:lootRoom.cy+0.5,type:'chest',level,loot,opened:false,sprite:`assets/sprites/static/${chestSprite}`});

    // ladder to next floor placed at last room
    const end=rooms[rooms.length-1];
    entities.push({x:end.cx+0.5,y:end.cy+0.5,type:'ladder',sprite:'assets/sprites/static/ladder.png'});

    this.grid = grid;
    this.entities = entities;
  },

  genHome(){
    this.width = 12; this.height = 12;
    const grid = Array.from({length:this.height},()=>Array(this.width).fill(1));
    for(let y=1;y<this.height-1;y++) for(let x=1;x<this.width-1;x++) grid[y][x]=0;
    this.grid = grid;
    this.entities = [
      {x:4.5, y:3.5, sprite:'assets/sprites/professor-oak.png', type:'oak'},
      {x:7.5, y:3.5, sprite:'assets/sprites/professor-oak.png', type:'shop'}
    ];
    this.player = {x:6, y:8, dir:0, hp:100};
  },
  isWall(x,y){
    const xi = Math.floor(x), yi = Math.floor(y);
    if(yi<0||yi>=this.height||xi<0||xi>=this.width) return true;
    return this.grid[yi][xi]===1;
  }
};
