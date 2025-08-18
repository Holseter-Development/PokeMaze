// gl_renderer.js — WebGL world renderer using global THREE.
// Atlas 384x768 (48x48 tiles).
// Ground: rows 4–5 (all 8 cols). Roof: row 1 cols 2–5. Walls: row 8 col 5.

(function(){
  class GLRenderer {
    constructor({ canvas, atlasPath='assets/atlas.png' }){
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({
        canvas, antialias:false, alpha:false, powerPreference:'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
      this.renderer.setClearColor(0x000000, 1);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1000);
      this.eyeHeight = 0.45;

      const amb = new THREE.AmbientLight(0xffffff, 0.6);
      const dir = new THREE.DirectionalLight(0xffffff, 0.4);
      dir.position.set(1,2,1);
      this.scene.add(amb, dir);

      new THREE.TextureLoader().load(atlasPath, (tex)=>{
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        this.atlasTex = tex;
        if (this._pendingWorld){ this.buildLevel(this._pendingWorld); this._pendingWorld = null; }
      });

      window.addEventListener('resize', ()=>this.resize());
      this.resize();
    }

    resize(){
      const w = this.canvas.clientWidth || this.canvas.width || 1;
      const h = this.canvas.clientHeight || this.canvas.height || 1;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    h(x,y){ return ((x*73856093) ^ (y*19349663)) >>> 0; }

    uvFor(row, col){
      const TILE=48, AW=384, AH=768;
      const u0=((col-1)*TILE)/AW, v0=((row-1)*TILE)/AH;
      const u1=u0+TILE/AW, v1=v0+TILE/AH;
      const padU=0.5/AW, padV=0.5/AH;
      return {u0:u0+padU, v0:v0+padV, u1:u1-padU, v1:v1-padV};
    }

    material(){
      if (!this._mat && this.atlasTex){
        this._mat = new THREE.MeshBasicMaterial({
          map:this.atlasTex,
          side: THREE.DoubleSide   // <- important
        });
      }
      return this._mat;
    }

    makeQuad(orientation, uv){
      const g = new THREE.BufferGeometry();
      let pos, uvs;

      if (orientation === 'floor'){ // XZ plane, +Y
        pos = new Float32Array([ 0,0,0, 1,0,0, 1,0,1,  0,0,0, 1,0,1, 0,0,1 ]);
        uvs = new Float32Array([ uv.u0,uv.v1, uv.u1,uv.v1, uv.u1,uv.v0,  uv.u0,uv.v1, uv.u1,uv.v0, uv.u0,uv.v0 ]);
      } else if (orientation === 'ceiling'){ // XZ plane, -Y
        pos = new Float32Array([ 0,0,0, 1,0,1, 1,0,0,  0,0,0, 0,0,1, 1,0,1 ]);
        uvs = new Float32Array([ uv.u0,uv.v0, uv.u1,uv.v1, uv.u1,uv.v0,  uv.u0,uv.v0, uv.u0,uv.v1, uv.u1,uv.v1 ]);
      } else { // wall: XY plane facing +Z at local z=0
        pos = new Float32Array([ 0,0,0, 1,1,0, 1,0,0,  0,0,0, 0,1,0, 1,1,0 ]);
        uvs = new Float32Array([ uv.u0,uv.v1, uv.u1,uv.v0, uv.u1,uv.v1,  uv.u0,uv.v1, uv.u0,uv.v0, uv.u1,uv.v0 ]);
      }

      g.setAttribute('position', new THREE.BufferAttribute(pos,3));
      g.setAttribute('uv',       new THREE.BufferAttribute(uvs,2));
      return g;
    }

    clearLevel(){
      if (!this.levelRoot) return;
      this.scene.remove(this.levelRoot);
      this.levelRoot.traverse(o=>{ if (o.isMesh) o.geometry.dispose(); });
      this.levelRoot = null;
    }

    buildLevel(world){
      if (!this.atlasTex){ this._pendingWorld = world; return; }
      this.clearLevel();
      const root = this.levelRoot = new THREE.Group();
      this.scene.add(root);

      const mat = this.material();
      const wallUV = this.uvFor(8,5);
      const wallGeom = this.makeQuad('wall', wallUV);
      const roofCols = [2,3,4,5];

      for (let y=0; y<world.height; y++){
        for (let x=0; x<world.width; x++){
          // Floor
          {
            const row = 4 + ((this.h(x,y)>>2) & 1);
            const col = (this.h(x*7,y*11) % 8) + 1;
            const uv  = this.uvFor(row, col);
            const g   = this.makeQuad('floor', uv);
            const m   = new THREE.Mesh(g, mat);
            m.position.set(x, 0, y);
            root.add(m);
          }
          // Ceiling
          {
            const col = roofCols[this.h(x*13,y*5) % roofCols.length];
            const uv  = this.uvFor(1, col);
            const g   = this.makeQuad('ceiling', uv);
            const m   = new THREE.Mesh(g, mat);
            m.position.set(x, 1.5, y);
            root.add(m);
          }

          if (world.grid[y][x] !== 1) continue;

          // Place a wall quad on each open side of the solid cell.
          const N = (y-1<0) || world.grid[y-1][x]!==1;
          const S = (y+1>=world.height) || world.grid[y+1][x]!==1;
          const W = (x-1<0) || world.grid[y][x-1]!==1;
          const E = (x+1>=world.width) || world.grid[y][x+1]!==1;

          const addWall = (px, pz, rotY)=>{
            const m = new THREE.Mesh(wallGeom, mat);
            m.position.set(px, 0, pz);
            m.scale.set(1, 1.5, 1);     // wall height 1.5
            m.rotation.y = rotY;
            root.add(m);
          };

          // Correct positions (aligned to cell edges)
          if (N) addWall(x,   y,   0);             // north edge at z = y
          if (S) addWall(x,   y+1, Math.PI);       // south edge at z = y+1
          if (W) addWall(x,   y,   -Math.PI/2);    // west  edge at x = x
          if (E) addWall(x+1, y,    Math.PI/2);    // east  edge at x = x+1
        }
      }
    }

    render(world){
      if (!this.levelRoot) this.buildLevel(world);
      const p = world.player;
      this.camera.position.set(p.x, this.eyeHeight, p.y);
      this.camera.lookAt(p.x + Math.cos(p.dir), this.eyeHeight, p.y + Math.sin(p.dir));
      this.resize();
      this.renderer.render(this.scene, this.camera);
    }
  }

  window.GLRenderer = GLRenderer;
})();
