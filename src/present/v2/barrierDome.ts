import * as THREE from 'three';
import { voxModel } from '../ui3d/vox';
import type { BattleActor } from '../bestiary/battle';

// 贴地的体素半球，避免方盒冰封语义；流动光点沿罩面掠过。
export class BarrierDome {
  root = new THREE.Group(); private mat: THREE.MeshBasicMaterial; private rim: THREE.MeshBasicMaterial;
  private flow: THREE.InstancedMesh; private flowMat: THREE.MeshBasicMaterial; private t = 0;
  constructor() {
    this.mat = new THREE.MeshBasicMaterial({ color: 0x45dacb, transparent: true, opacity: 0, depthWrite: false, side: THREE.FrontSide, toneMapped: false });
    const shell = voxModel(0.1, set => {
      for (let y=0;y<11;y++) for (let x=-10;x<=10;x++) for (let z=-10;z<=10;z++) {
        const r = Math.hypot(x+0.5,y+0.5,z+0.5); if (r>=9.2 && r<=10.1) set(x,y,z,0xffffff);
      }
    }, { centre: [0,0,0] });
    shell.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).material = this.mat; o.renderOrder = 4; } }); this.root.add(shell);
    this.rim = new THREE.MeshBasicMaterial({ color: 0x67e5df, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.96,1.015,24),this.rim); ring.rotation.x=-Math.PI/2; ring.position.y=0.025; this.root.add(ring);
    this.flowMat = new THREE.MeshBasicMaterial({ color: 0x9af4e8, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false });
    this.flow = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035,0.025,0.035),this.flowMat,32); this.root.add(this.flow);
    this.root.visible=false;
  }
  /** a poison / burn tick went through: the dome thins out for a moment instead of flashing like a block (DoT ignores the barrier) */
  pierce() { this.thin = 0.7; }
  private thin = 0;
  update(dt: number, hero: BattleActor, barrier: number, dice: number) {
    this.t+=dt; this.thin=Math.max(0,this.thin-dt); this.root.visible=barrier>0; if (!this.root.visible) return;
    const n=Math.max(1,Math.min(6,dice)), r=Math.max(hero.top+0.18,hero.width*0.7), see=1-0.8*Math.min(1,this.thin/0.25);
    this.root.position.copy(hero.root.position); this.root.position.y=hero.home.y+0.02; this.root.scale.setScalar(r);
    this.mat.opacity=(0.025+n*0.012)*(0.95+0.05*Math.sin(this.t*2))*see; this.rim.opacity=(0.18+n*0.045)*see;
    this.flowMat.opacity=(0.2+n*0.055)*see;
    const m=new THREE.Matrix4(), p=new THREE.Vector3();
    for(let i=0;i<32;i++) { const h=((i*0.618+this.t*0.06)%1)*0.96, a=i*2.4+this.t*0.16, rad=Math.sqrt(1-h*h); p.set(Math.cos(a)*rad,h,Math.sin(a)*rad); m.makeTranslation(p.x,p.y,p.z); this.flow.setMatrixAt(i,m); }
    this.flow.instanceMatrix.needsUpdate=true;
  }
}
