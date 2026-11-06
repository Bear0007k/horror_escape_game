import * as THREE from 'three';
import './style.css';

const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), footer: $('footer-mark'), crosshair: $('crosshair'), title: $('title-screen'), pause: $('pause-screen'), ending: $('ending-screen'),
  start: $('start-button'), resume: $('resume-button'), restart: $('restart-button'), quit: $('pause-quit'), prompt: $('interact-prompt'), promptText: $('prompt-text'), objective: $('objective'), objectiveText: $('objective-text'),
  floor: $('floor-label'), floorSub: $('floor-subtitle'), attempts: $('attempt-icons'), tries: $('tries-label'), dialogue: $('dialogue'), speaker: $('speaker'), dialogueText: $('dialogue-text'), toast: $('toast'), blackout: $('blackout'), damage: $('damage-flash'), whisper: $('whisper'), whisperText: $('whisper-text'), status: $('status-label'), endingTitle: $('ending-title'), endingCopy: $('ending-copy')
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c211e);
scene.fog = new THREE.FogExp2(0x1c211e, 0.024);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 90);
camera.rotation.order = 'YXZ';
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.24;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const keys = new Set();
const interactables = [];
const enemies = [];
const lights = [];
const roomDoors = [];
const rooms = [];
const map = { width: 9.5, length: 66, startZ: 28, exitZ: -32.8, roomZs: [19, 5, -9, -23], roomDepth: 8.6, roomInnerX: 4.75, roomOuterX: 14.15 };
const state = { active: false, paused: false, floor: 5, catches: 0, hasCard: false, card: null, exit: null, lookX: 0, lookY: 0, elapsed: 0, caught: false, whisperAt: 0, spoken: new Set(), toastTimer: null, audio: null, audioOn: false, theme: null };
const player = { x: 0, z: map.startZ, y: 1.65, speed: 4.15, runSpeed: 6.2 };

const mat = (color, roughness = 0.86, extra = {}) => {
  if (typeof roughness === 'object') { extra = roughness; roughness = extra.roughness ?? 0.86; }
  return new THREE.MeshStandardMaterial({ color, roughness, ...extra });
};
const materials = {
  wall: mat(0x59605a), lower: mat(0x343a35), floor: mat(0x343938), ceiling: mat(0x303633), trim: mat(0x77766a), dark: mat(0x171d1b), metal: mat(0x69706a, .48, { metalness: .5 }), rust: mat(0x6f3a30), glass: new THREE.MeshStandardMaterial({ color: 0x75857b, roughness: .12, metalness: .35, transparent: true, opacity: .42 }), light: new THREE.MeshStandardMaterial({ color: 0xc4c4a0, emissive: 0xb3bd96, emissiveIntensity: 1.5 }), card: mat(0xa44037, .48, { emissive: 0x571812, emissiveIntensity: .35 })
};
const floors = ['05', '04', '03', '02', '01'];
const floorThemes = [
  { name: 'TRIAGE & GENERAL WARD', fog: 0x24291f, fogDensity: .022, wall: 0x78806f, lower: 0x444c3b, floor: 0x55584b, ceiling: 0x41483e, light: 0xffe7b7, corridorPower: 1.2, rooms: ['WARD 5A', 'NURSE STATION', 'INTAKE ROOM', 'RECOVERY'] },
  { name: 'SURGICAL THEATRE', fog: 0x1c292a, fogDensity: .023, wall: 0x657878, lower: 0x344747, floor: 0x455556, ceiling: 0x354343, light: 0xc8fff1, corridorPower: 1.35, rooms: ['PREP ROOM', 'OPERATING 4', 'SCRUB ROOM', 'ANAESTHESIA'] },
  { name: 'MEDICAL RECORDS', fog: 0x2b2117, fogDensity: .021, wall: 0x78654b, lower: 0x453524, floor: 0x524332, ceiling: 0x41311f, light: 0xffc878, corridorPower: 1.18, rooms: ['ARCHIVE A', 'CHART ROOM', 'PHARMACY', 'RECORDS VAULT'] },
  { name: 'ISOLATION WING', fog: 0x29191d, fogDensity: .024, wall: 0x755b62, lower: 0x49373b, floor: 0x493b40, ceiling: 0x382a30, light: 0xff8790, corridorPower: 1.35, rooms: ['NEGATIVE PRESSURE', 'ISOLATION 2B', 'DECONTAMINATION', 'OBSERVATION'] },
  { name: 'LOWER MORGUE', fog: 0x1c252d, fogDensity: .021, wall: 0x66727b, lower: 0x35424c, floor: 0x455159, ceiling: 0x303d47, light: 0xb7d9ff, corridorPower: 1.5, rooms: ['COLD STORAGE', 'AUTOPSY', 'SPECIMEN ROOM', 'MORTUARY OFFICE'] }
];
const rand = (a, b) => a + Math.random() * (b - a);
const box = (w, h, d, material, x, y, z, parent = scene, cast = true) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
};

const hemi = new THREE.HemisphereLight(0xd9dfd0, 0x27221c, 0.82); scene.add(hemi);
const ambient = new THREE.AmbientLight(0x9a9b89, .48); scene.add(ambient);
const flashlight = new THREE.SpotLight(0xfff0cf, 92, 24, Math.PI / 6, .46, 1.05);
flashlight.position.set(0, 1.56, 0); flashlight.castShadow = false; flashlight.target.position.set(0, 1.2, -1); camera.add(flashlight, flashlight.target); scene.add(camera);

function addTextPlate(parent, text, x, y, z, scale = 1, color = '#c6beaa') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(12,16,15,.92)'; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#857c65'; ctx.lineWidth = 3; ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = color; ctx.font = '500 38px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 65, 465);
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.35 * scale, .59 * scale), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  plate.position.set(x, y, z); parent.add(plate); return plate;
}

function hospitalBed(x, z) {
  const g = new THREE.Group(); scene.add(g);
  box(2.3, .12, 4, materials.metal, x, .83, z, g); box(2.22, .15, 1.15, mat(0xb5b4a8), x, .98, z - 1.2, g);
  box(2.42, .12, 4.12, materials.dark, x, .68, z, g);
  for (const dx of [-1, 1]) for (const dz of [-1.72, 1.72]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,.7,8), materials.metal); leg.position.set(x+dx,.34,z+dz); g.add(leg); }
  box(.12, 1.1, .08, materials.metal, x-1.13, 1.35, z-1.9, g); box(.12, 1.1, .08, materials.metal, x+1.13, 1.35, z-1.9, g); box(2.4,.08,.1,materials.metal,x,1.82,z-1.9,g);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(.14,.035,7,12), materials.metal); wheel.rotation.y = Math.PI/2; wheel.position.set(x-1,.14,z-1.7); g.add(wheel);
  return g;
}

function cabinet(x, z, side = 1) {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = side < 0 ? Math.PI : 0; scene.add(group);
  box(1.6, 3.5, .18, materials.dark, 0, 1.75, 0, group);
  box(1.3, 2.95, .15, materials.wall, 0, 1.8, -.1, group);
  box(1.3, .12, .2, materials.trim, 0, 3.25, .02, group);
  box(.08, 2.82, .15, materials.trim, -.65, 1.78, .02, group); box(.08, 2.82, .15, materials.trim, .65, 1.78, .02, group);
  const window = box(.82, .78, .03, materials.glass, 0, 2.27, .08, group);
  box(.12, .12, .06, materials.rust, .46, .7, .11, group);
  box(1.43, .08, .13, materials.trim, 0, .08, .02, group);
  return group;
}

function ceilingLight(z, intensityScale = 1) {
  box(1.7, .1, .68, materials.dark, 0, 3.93, z, scene, false);
  const panel = box(1.48, .06, .48, materials.light, 0, 3.86, z, scene, false);
  const p = new THREE.PointLight(state.theme.light, 14 * intensityScale, 18, 1.6); p.position.set(0, 3.4, z); scene.add(p);
  lights.push({ light: p, panel, base: p.intensity, phase: Math.random() * 6.28 });
}

const roomTypes = [
  ['ward','nurse','intake','recovery'], ['prep','surgery','scrub','anaesthesia'], ['archive','charts','pharmacy','vault'],
  ['isolation','quarantine','decon','observation'], ['cold','autopsy','specimen','office']
];

function makeBed(parent, x, z, color = 0xc0bfb2) {
  box(2.15,.12,3.35,materials.metal,x,.8,z,parent);
  box(2.03,.17,2.95,mat(color),x,.94,z+.02,parent);
  box(1.96,.14,.84,mat(0xd4d0c3),x,.99,z-1.05,parent);
  box(2.3,.1,3.5,materials.dark,x,.62,z,parent);
  for(const dx of [-.93,.93]) for(const dz of [-1.45,1.45]) {
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,.62,8),materials.metal); leg.position.set(x+dx,.3,z+dz); parent.add(leg);
  }
  box(.1,1.04,.08,materials.metal,x-1.1,1.3,z-1.68,parent);
  box(.1,1.04,.08,materials.metal,x+1.1,1.3,z-1.68,parent);
}

function createRoomFurniture(room, index) {
  const g=room.group, type=room.type, accent=room.accent;
  const desk=(x,z)=>{
    box(2.45,.14,1.15,materials.dark,x,.88,z,g); box(2.3,.12,1.04,materials.trim,x,.99,z,g);
    for(const dx of [-1,1])for(const dz of [-.42,.42])box(.09,.83,.09,materials.metal,x+dx,.43,z+dz,g);
    box(.7,.07,.56,mat(0xb8aa88),x-.48,1.12,z+.03,g);
    box(.46,.045,.32,materials.rust,x+.55,1.1,z-.13,g);
  };
  const shelf=(x,z)=>{
    box(.22,2.75,3.3,materials.dark,x,1.38,z,g);
    for(const y of [.25,.9,1.58,2.25,2.82]) {
      box(.45,.08,3.2,materials.trim,x+(x>0?-.18:.18),y,z,g);
      for(let i=0;i<5;i++) box(.23,.35,.38,mat([0x6c4938,0x78654a,0x394e4e,0x69423c,0x897253][(i+index)%5]),x+(x>0?-.18:.18),y+.21,z-1.25+i*.58,g);
    }
  };
  const workTable=(x,z)=>{
    box(2.65,.15,1.2,materials.metal,x,.82,z,g); box(2.38,.12,1.02,mat(0xb9b6a9),x,.96,z,g);
    for(const dx of [-1.12,1.12])for(const dz of [-.43,.43])box(.08,.78,.08,materials.metal,x+dx,.38,z+dz,g);
    const lamp=new THREE.Mesh(new THREE.CylinderGeometry(.5,.82,.14,16),mat(0xc5d4c9,{emissive:state.theme.light,emissiveIntensity:.42})); lamp.position.set(x,3.08,z); g.add(lamp);
    const beam=new THREE.PointLight(state.theme.light,8,6,2); beam.position.set(x,2.82,z); g.add(beam);
  };
  const cabinet=(x,z)=>{
    box(1.25,2.6,.72,materials.dark,x,1.3,z,g);
    for(const y of [.35,.85,1.35,1.85,2.35]) { box(1.12,.34,.05,materials.trim,x,y,z+.39,g); box(.1,.07,.05,materials.metal,x+.43,y,z+.44,g); }
  };
  if(['ward','recovery','quarantine','observation','isolation'].includes(type)) {
    makeBed(g,-1.4,.2,type==='isolation'?0xb3b1a7:0xd0ccc0);
    box(.86,.68,.78,materials.dark,.2,.4,1.95,g); box(.9,.05,.8,materials.trim,.2,.76,1.95,g);
    box(.12,2.65,.09,materials.metal,2.5,1.34,.1,g); box(.12,2.65,.09,materials.metal,2.5,1.34,2.3,g);
    box(.05,2.55,2.15,materials.glass,2.5,1.35,1.2,g);
    room.cardLocal.set(.2,.83,1.95);
  } else if(['surgery','prep','scrub','decon','autopsy','specimen'].includes(type)) {
    workTable(-.2,-.4); cabinet(3.55,-1.6);
    box(.6,.92,.6,materials.metal,2.4,.48,1.8,g);
    const basin=new THREE.Mesh(new THREE.CylinderGeometry(.32,.4,.12,12),materials.glass); basin.position.set(2.4,1,1.8); g.add(basin);
    room.cardLocal.set(2.4,1.12,1.8);
  } else if(['archive','charts','pharmacy','vault'].includes(type)) {
    shelf(-3.55,-1.8); shelf(3.55,-1.8); desk(0,1.35);
    box(.42,.06,.32,mat(0xb8aa88),.45,1.12,1.35,g);
    room.cardLocal.set(.45,1.19,1.35);
  } else {
    desk(.3,-.7); cabinet(-3.55,-1.8); box(.4,.56,.42,materials.rust,-1,1.34,-.68,g);
    room.cardLocal.set(.3,1.14,-.7);
  }
  // Floor specific dressing: curtains, warning glass, or specimen canisters.
  if(type==='isolation'||type==='decon') {
    const curtain=box(.05,3.1,2.7,mat(0x8a6e70,{transparent:true,opacity:.7}),-2.5,1.55,-1.5,g); curtain.material.side=THREE.DoubleSide;
  }
  if(type==='cold'||type==='autopsy'||type==='specimen') {
    for(let i=0;i<3;i++) { box(.95,.72,.62,materials.metal,3.45, .55+i*.78,-2+i*.02,g); box(.73,.06,.48,materials.trim,3.45,.85+i*.78,-1.65,g); }
  }
  if(type==='nurse'||type==='office'||type==='charts'||type==='intake') {
    for(let i=0;i<3;i++) box(.42,.55,.34,mat([0x6d5f45,0x7d443a,0x485f5b][i]),-1.3+i*.5,1.3,-.72,g);
  }
}

function createRoomDoor(side,z,label) {
  const x=side*(map.roomInnerX-.08), hinge=new THREE.Group();
  hinge.position.set(x,0,z-1.22); scene.add(hinge);
  box(.16,3.02,2.42,mat(0x5b332d),0,1.51,1.22,hinge);
  box(.055,2.75,.06,materials.trim,side*.11,1.51,1.22,hinge);
  box(.14,.12,.12,materials.metal,side*.13,1.35,2.1,hinge);
  for(const dz of [-1.38,1.38]) box(.23,3.28,.2,materials.trim,x,1.64,z+dz,scene);
  box(.24,.17,2.95,materials.trim,x,3.28,z,scene);
  const sign=addTextPlate(scene,label,x-side*.18,3.55,z, .58, '#ded4b9'); sign.rotation.y=-side*Math.PI/2;
  const proxy=new THREE.Object3D(); proxy.position.set(side*4.2,1.25,z); proxy.userData.type='roomdoor'; proxy.userData.label=label; scene.add(proxy); interactables.push(proxy);
  const door={side,z,label,hinge,proxy,open:false}; proxy.userData.door=door; roomDoors.push(door);
}

function createFloorRoom(side,z,index) {
  const floorIndex=5-state.floor, theme=state.theme, type=roomTypes[floorIndex][index], cx=side*(map.roomInnerX+map.roomOuterX)/2;
  const group=new THREE.Group(); group.position.set(cx,0,z); scene.add(group);
  const room={side,z,index,type,label:theme.rooms[index],group,centerX:cx,cardLocal:new THREE.Vector3(),cardLight:null}; rooms.push(room);
  box(map.roomOuterX-map.roomInnerX,.18,map.roomDepth,materials.floor,0,-.16,0,group);
  box(map.roomOuterX-map.roomInnerX,.15,map.roomDepth,materials.ceiling,0,4.05,0,group,false);
  box(.22,4,map.roomDepth,materials.wall,side*(map.roomOuterX-map.roomInnerX)/2,1.9,0,group);
  for(const end of [-1,1]) box(map.roomOuterX-map.roomInnerX,4,.22,materials.wall,0,1.9,end*(map.roomDepth/2),group);
  box(.24,.8,map.roomDepth,materials.lower,side*(map.roomOuterX-map.roomInnerX)/2, .43,0,group,false);
  box(.24,.12,map.roomDepth,materials.trim,side*(map.roomOuterX-map.roomInnerX)/2,.9,0,group,false);
  const intensity=[10,15,7,12][(index+floorIndex)%4];
  const roomLight=new THREE.PointLight(theme.light,intensity,15,1.45); roomLight.position.set(0,3.4,0); group.add(roomLight);
  lights.push({light:roomLight,base:intensity,phase:Math.random()*6.28});
  createRoomFurniture(room,index);
  createRoomDoor(side,z,room.label);
  room.cardWorld=group.localToWorld(room.cardLocal.clone());
  return room;
}

function createRoom() {
  const floorIndex=5-state.floor; state.theme=floorThemes[floorIndex];
  scene.background.set(state.theme.fog); scene.fog.color.set(state.theme.fog); scene.fog.density=state.theme.fogDensity;
  materials.wall.color.set(state.theme.wall); materials.lower.color.set(state.theme.lower); materials.floor.color.set(state.theme.floor); materials.ceiling.color.set(state.theme.ceiling);
  materials.light.color.set(state.theme.light); materials.light.emissive.set(state.theme.light); materials.light.emissiveIntensity=1.8;
  hemi.color.set(0xe6e3d2); hemi.groundColor.set(state.theme.fog); hemi.intensity=.9;
  ambient.color.set(state.theme.light); ambient.intensity=.38;
  box(map.width,.3,map.length,materials.floor,0,-.16,0);
  box(map.width,.15,map.length,materials.ceiling,0,4.05,0,scene,false);
  const segment=(side,from,to)=>{
    const length=Math.abs(from-to); if(length<.1)return; const z=(from+to)/2,x=side*(map.width/2);
    box(.24,4,length,materials.wall,x,1.9,z); box(.3,.76,length,materials.lower,x-side*.06,.47,z,scene,false);
    box(.34,.12,length,materials.trim,x-side*.05,.9,z,scene,false); box(.28,.2,length,materials.trim,x-side*.04,3.55,z,scene,false);
  };
  for(const side of [-1,1]) {
    let cursor=33;
    for(const z of map.roomZs) { segment(side,cursor,z+1.52); cursor=z-1.52; }
    segment(side,cursor,-33);
  }
  for(let i=0;i<5;i++) { const z=26-i*13; box(map.width,.14,.45,materials.dark,0,.005,z,scene,false); box(map.width,.12,.3,mat(0x77786f),0,3.88,z,scene,false); }
  for(let i=0;i<5;i++) ceilingLight(25-i*12.5,[1.3,.72,1.08,.65,1.45][(i+floorIndex)%5]*state.theme.corridorPower);
  // Leave a real doorway in the far wall; the stair door sits inside the opening.
  const opening=3.06, wallSide=(map.width-opening)/2;
  box(wallSide,3.95,.45,materials.wall,-(opening+wallSide)/2,1.9,-33.25);
  box(wallSide,3.95,.45,materials.wall,(opening+wallSide)/2,1.9,-33.25);
  box(opening,.78,.45,materials.wall,0,3.56,-33.25);
  addTextPlate(scene,`WARD ${floors[floorIndex]}  ·  ${state.theme.name}`,0,3.36,29.2,.64);
  rooms.length=0; roomDoors.length=0;
  for(let i=0;i<map.roomZs.length;i++) for(const side of [-1,1]) createFloorRoom(side,map.roomZs[i],i);
}

function createCard() {
  const room=rooms[Math.floor(Math.random()*rooms.length)];
  const card = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.6,.08,.42), materials.card); body.castShadow = true; card.add(body);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(.18,.009,.4), mat(0xe1d5b8,{metalness:.6,roughness:.3})); strip.position.y=.046; card.add(strip);
  const glow = new THREE.PointLight(0xd24535, .72, 2.2); glow.position.y=.25; card.add(glow);
  card.position.copy(room.cardWorld); card.rotation.y=room.side<0?Math.PI:0; card.userData.type='card'; card.userData.prompt='TAKE THE WARD KEYCARD';
  scene.add(card); interactables.push(card); state.card=card; room.card=card;
}

const doctorTextures=[
  new THREE.TextureLoader().load('/assets/plague-doctor-male.png'),
  new THREE.TextureLoader().load('/assets/plague-doctor-female.png')
];
for(const texture of doctorTextures) texture.colorSpace=THREE.SRGBColorSpace;

function roomAt(x,z) {
  if(Math.abs(x)<=4.15) return null;
  return rooms.find(room=>room.side===Math.sign(x)&&Math.abs(z-room.z)<map.roomDepth/2);
}

function roomDoorFor(room) {
  return roomDoors.find(door=>door.side===room.side&&door.z===room.z);
}

function roomApproach(room) {
  const door=roomDoorFor(room); if(door) door.open=true;
  return {x:room.side*3.5,z:room.z};
}

function moveEnemyToward(enemy,target,dt,speedScale=1) {
  const dx=target.x-enemy.position.x, dz=target.z-enemy.position.z, distance=Math.hypot(dx,dz);
  if(distance>.05) {
    const travel=Math.min(distance,enemy.userData.speed*speedScale*dt);
    enemy.position.x+=dx/distance*travel; enemy.position.z+=dz/distance*travel;
    enemy.rotation.y=Math.atan2(dx,dz);
  }
  return distance;
}

function chooseWanderTarget(enemy) {
  const room=roomAt(enemy.position.x,enemy.position.z);
  if(room) {
    enemy.userData.wanderTarget={
      x:room.centerX+rand(-3.3,3.3),
      z:room.z+rand(-3.15,3.15)
    };
  } else {
    enemy.userData.wanderTarget={x:rand(-3.35,3.35),z:rand(map.exitZ+3,map.startZ-2)};
  }
  enemy.userData.nextWanderAt=state.elapsed+rand(3.5,8);
}

function spawnEnemyInRandomRoom() {
  const candidates=[];
  for(const room of rooms) {
    for(let attempt=0;attempt<4;attempt++) {
      const x=room.centerX+rand(-3.25,3.25), z=room.z+rand(-3.05,3.05);
      if(Math.hypot(player.x-x,player.z-z)>12) candidates.push({room,x,z});
    }
  }
  if(!candidates.length) return false;
  const spawn=candidates[Math.floor(Math.random()*candidates.length)];
  const kind=Math.random()<.68?'doctor':'patient';
  const enemy=createEnemy(kind,spawn.x,spawn.z,enemies.length);
  enemy.userData.spawnRoom=spawn.room;
  return true;
}

function updateEnemySpawner(dt) {
  state.enemySpawnTimer-=dt;
  if(state.enemySpawnTimer>0) return;
  if(enemies.length>=3) { state.enemySpawnTimer=rand(8,13); return; }
  const spawned=spawnEnemyInRandomRoom();
  state.enemySpawnTimer=spawned?rand(11,20):rand(3,6);
}

function createEnemy(kind, x, z, index = 0) {
  const root = new THREE.Group(); root.position.set(x,0,z); root.rotation.y=rand(0,Math.PI*2);
  root.userData.kind=kind; root.userData.alert=0; root.userData.talked=false; root.userData.chasing=false; root.userData.wanderTarget=null; root.userData.nextWanderAt=0; scene.add(root);
  const skin=mat(0x988b7a), uniform=mat(0x626a60), darkCloth=mat(0x292f2c), eye=mat(0x190f0e,{emissive:0x270806,emissiveIntensity:.6});
  if(kind==='doctor') {
    const texture=doctorTextures[Math.floor(Math.random()*doctorTextures.length)], width=texture===doctorTextures[0]?2.8:3.05;
    const silhouette=new THREE.Mesh(new THREE.PlaneGeometry(width,3.95),new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.08,side:THREE.DoubleSide,depthWrite:false}));
    silhouette.position.y=1.95; root.add(silhouette);
    const omen=new THREE.PointLight(0xa61f20,2.2,5,2); omen.position.set(0,1.55,.5); root.add(omen);
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.32,.48,1.35,9), uniform); body.position.y=1.05; body.castShadow=true; root.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,.16,8), skin); neck.position.y=1.78; root.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.29,12,10), skin); head.position.y=2.05; head.scale.set(.88,1.12,.9); head.castShadow=true; root.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.3,12,7,0,Math.PI*2,0,.45), mat(0x272927)); hair.position.y=2.14; root.add(hair);
    for(const ex of [-.105,.105]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.035,6,6),eye); e.position.set(ex,2.07,.251); root.add(e); }
    box(.48,.12,.38,materials.rust,0,1.75,0,root);
    for(const dx of [-.43,.43]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,.78,7),uniform); arm.position.set(dx,.98,0); arm.rotation.z=dx*.7; root.add(arm); }
    for(const dx of [-.18,.18]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.13,.17,.8,7),darkCloth); leg.position.set(dx,.4,0); leg.castShadow=true; root.add(leg); }
  }
  const shadow = new THREE.PointLight(kind==='doctor'?0xa22320:0x8b9b6b,1.3,4.8); shadow.position.set(0,1,0); root.add(shadow);
  const descentProgress=(5-state.floor)/4;
  const floorPace=.65+descentProgress*.35;
  root.userData.speed=(kind==='doctor'?4.0:1.1)*floorPace;
  root.userData.spawnRoom=roomAt(x,z);
  root.userData.lines=kind==='doctor' ? ['You missed your appointment.','Back to your room. Now.','The elevator is for staff only.'] : ['The stairs go down. They always go down.','It knows when you run.','Don’t look in the windows.','I was here before the lights went out.'];
  enemies.push(root);
  return root;
}

function makeFloor({ carryCard = false } = {}) {
  // Clear the last ward before creating the next one.
  while(scene.children.length) scene.remove(scene.children[0]);
  scene.add(camera); scene.add(hemi); scene.add(ambient);
  flashlight.target.position.set(0,1.2,-1); camera.add(flashlight,flashlight.target);
  enemies.length=0; lights.length=0; interactables.length=0; roomDoors.length=0; rooms.length=0; state.card=null; state.hasCard=carryCard; state.exit=null;
  createRoom(); if(!carryCard) createCard();
  state.enemySpawnTimer=rand(4.5,8.5);
  ui.floor.textContent=`FLOOR ${floors[5-state.floor]}`;
  ui.floorSub.textContent=state.theme.name;
  ui.objectiveText.textContent=state.hasCard?'Reach the stairwell':'Find the ward keycard';
  ui.status.textContent=state.hasCard?'KEYCARD FOUND':'NO SIGNAL';
  player.x=0; player.z=map.startZ; player.y=1.65;
  camera.position.set(player.x,player.y,player.z); camera.rotation.set(0,0,0); state.lookX=0; state.lookY=0;
  state.spoken.clear(); state.elapsed=0;
}

function showToast(message, duration=2400) {
  ui.toast.textContent=message; ui.toast.classList.remove('hidden');
  clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>ui.toast.classList.add('hidden'),duration);
}
function say(speaker, message, duration=4500) {
  ui.speaker.textContent=speaker; ui.dialogueText.textContent=message; ui.dialogue.classList.remove('hidden');
  if(speaker.startsWith('DR.')) speakDoctorDialogue(message);
  else stopDoctorVoice();
  setTimeout(()=>ui.dialogue.classList.add('hidden'),duration);
}
function selectDoctorVoice() {
  if(!('speechSynthesis' in window)) return null;
  const voices=window.speechSynthesis.getVoices();
  const english=voices.filter(voice=>voice.lang.toLowerCase().startsWith('en'));
  return english.find(voice=>/male|david|daniel|alex|mark|james/i.test(voice.name))||english[0]||voices[0]||null;
}
function speakDoctorDialogue(message) {
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)) return;
  const synth=window.speechSynthesis, utterance=new SpeechSynthesisUtterance(message), voice=selectDoctorVoice();
  if(voice) { utterance.voice=voice; utterance.lang=voice.lang; }
  utterance.rate=.82; utterance.pitch=.62; utterance.volume=.86;
  synth.cancel(); synth.speak(utterance);
}
function stopDoctorVoice() {
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
}
function updateAttempts() {
  ui.attempts.innerHTML='';
  for(let i=0;i<5;i++) { const bead=document.createElement('i'); bead.className=`attempt${i<state.catches?' lost':''}`; ui.attempts.append(bead); }
  const left=5-state.catches; ui.tries.textContent=`${left} ${left===1?'chance':'chances'} remain`;
}
function playSound(freq=54, duration=.32, type='sine', volume=.045) {
  if(!state.audioOn) return;
  const now=state.audio.currentTime, osc=state.audio.createOscillator(), gain=state.audio.createGain();
  osc.type=type; osc.frequency.setValueAtTime(freq,now); osc.frequency.exponentialRampToValueAtTime(Math.max(22,freq*.56),now+duration);
  gain.gain.setValueAtTime(volume,now); gain.gain.exponentialRampToValueAtTime(.001,now+duration);
  osc.connect(gain); gain.connect(state.audio.destination); osc.start(now); osc.stop(now+duration);
}
function startAudio() {
  if(state.audioOn) return;
  const Audio = window.AudioContext || window.webkitAudioContext; if(!Audio) return;
  state.audio=new Audio(); state.audioOn=true;
  const osc=state.audio.createOscillator(), gain=state.audio.createGain(), filter=state.audio.createBiquadFilter();
  osc.type='sawtooth'; osc.frequency.value=48; filter.type='lowpass'; filter.frequency.value=130; gain.gain.value=.012;
  osc.connect(filter);filter.connect(gain);gain.connect(state.audio.destination);osc.start();
}

function begin() {
  state.active=true; state.paused=false; state.catches=0; state.floor=5; state.caught=false;
  startAudio(); makeFloor(); updateAttempts();
  ui.title.classList.add('hidden'); ui.ending.classList.add('hidden'); ui.pause.classList.add('hidden');
  ui.hud.classList.remove('hidden'); ui.footer.classList.remove('hidden'); ui.crosshair.classList.remove('hidden'); ui.objective.classList.remove('hidden');
  document.body.requestPointerLock?.(); showToast('Search the side rooms. Press E to open doors and take the keycard.');
}
function resume() { state.paused=false; ui.pause.classList.add('hidden'); document.body.requestPointerLock?.(); }
function showEnding(escaped) {
  state.active=false; state.paused=false; stopDoctorVoice(); document.exitPointerLock?.(); ui.dialogue.classList.add('hidden'); ui.prompt.classList.add('hidden');
  ui.endingTitle.textContent=escaped?'YOU MADE IT OUT.':'THE WARD KEEPS YOU.';
  const descent = state.catches===0 ? 'a clean descent' : `${state.catches} ${state.catches===1?'reset':'resets'}`;
  ui.endingCopy.textContent=escaped?`You reached the ground floor after ${descent}. The morning staff will find the door open.`:`Five times they brought you back upstairs. The sixth time, you didn’t wake up.`;
  ui.ending.classList.remove('hidden');
}
function caught() {
  if(state.caught || !state.active) return;
  state.caught=true; state.catches++; stopDoctorVoice(); playSound(36,.8,'sawtooth',.12); ui.damage.classList.add('active'); ui.blackout.classList.add('active');
  ui.dialogue.classList.add('hidden'); ui.prompt.classList.add('hidden'); state.active=false;
  setTimeout(()=>{
    ui.damage.classList.remove('active'); ui.blackout.classList.remove('active');
    if(state.catches>=5) { updateAttempts(); showEnding(false); return; }
    const carryCard=state.hasCard;
    state.floor=5; makeFloor({carryCard}); updateAttempts(); state.active=true;
    ui.floor.textContent='FLOOR 05'; ui.floorSub.textContent=state.theme.name;
    ui.objectiveText.textContent=carryCard?'Reach the stairwell':'Find the ward keycard'; ui.status.textContent=carryCard?'KEYCARD FOUND':'NO SIGNAL';
    ui.whisperText.textContent='You are back where you started.'; ui.whisper.classList.remove('hidden'); setTimeout(()=>ui.whisper.classList.add('hidden'),3100);
    showToast(`They dragged you back to Floor 05${carryCard?' · your keycard survived':''}. ${5-state.catches} chances left.`,3000); document.body.requestPointerLock?.(); state.caught=false;
  },1250);
}

function closestInteractable() {
  let closest=null, min=Infinity;
  for(const item of interactables) {
    if(!item.visible) continue;
    const d=camera.position.distanceTo(item.position), range=item.userData.type==='roomdoor'?3.4:2.7;
    if(d<min && d<range) { min=d; closest=item; }
  }
  return closest;
}
function interact() {
  const target=closestInteractable();
  if(target) {
    if(target.userData.type==='roomdoor') {
      const door=target.userData.door;
      if(!door.open) { door.open=true; showToast(`${door.label} · DOOR UNLATCHED`); playSound(118,.2,'triangle',.035); }
      else showToast(`${door.label} · ALREADY OPEN`);
      return;
    }
    if(target.userData.type==='card') {
      scene.remove(target); target.visible=false; state.hasCard=true; ui.objectiveText.textContent='Reach the stairwell'; ui.status.textContent='KEYCARD FOUND'; showToast(`Keycard found in ${rooms.find(r=>r.card===target)?.label||'the ward'}. Head to the stairwell.`); playSound(530,.12,'triangle',.04); return;
    }
    if(target.userData.type==='exit') {
      if(!state.hasCard) { showToast('ACCESS DENIED · KEYCARD REQUIRED'); playSound(87,.2,'square',.04); return; }
      if(state.floor===1) { playSound(250,.8,'sine',.08); showEnding(true); return; }
      state.active=false; playSound(94,.4,'sine',.08); ui.blackout.classList.add('active');
      stopDoctorVoice(); setTimeout(()=>{ state.floor--; makeFloor(); ui.blackout.classList.remove('active'); state.active=true; ui.status.textContent='NO SIGNAL'; showToast(`STAIRWELL · FLOOR ${floors[5-state.floor]}`); say('UNSIGNED NOTE','The lights are warmer downstairs. Something else is, too.',4000); document.body.requestPointerLock?.(); },600); return;
    }
  }
  const nearby = enemies.find((e)=>camera.position.distanceTo(e.position)<3.5);
  if(nearby) {
    const line=nearby.userData.lines[Math.floor(Math.random()*nearby.userData.lines.length)];
    say(nearby.userData.kind==='doctor'?'DR. HALDEN':'PATIENT 04',line,4200); nearby.userData.chasing=true; return;
  }
  showToast('Nothing within reach.');
}

function checkForPrompt() {
  const target=closestInteractable();
  if(target) {
    ui.promptText.textContent=target.userData.type==='card'?'TAKE THE WARD KEYCARD':target.userData.type==='roomdoor'?`${target.userData.door.open?'ENTER':'OPEN'} · ${target.userData.label}`:(state.hasCard?'USE STAIRWELL':'STAIRWELL · LOCKED');
    ui.prompt.classList.remove('hidden'); return;
  }
  const nearby = enemies.find((e)=>camera.position.distanceTo(e.position)<3.5);
  if(nearby) { ui.promptText.textContent='SPEAK'; ui.prompt.classList.remove('hidden'); return; }
  ui.prompt.classList.add('hidden');
}

function updatePlayer(dt) {
  const forward = new THREE.Vector3(-Math.sin(state.lookX),0,-Math.cos(state.lookX));
  const right = new THREE.Vector3(Math.cos(state.lookX),0,-Math.sin(state.lookX));
  const move=new THREE.Vector3();
  if(keys.has('KeyW')||keys.has('ArrowUp'))move.add(forward);
  if(keys.has('KeyS')||keys.has('ArrowDown'))move.sub(forward);
  if(keys.has('KeyD')||keys.has('ArrowRight'))move.add(right);
  if(keys.has('KeyA')||keys.has('ArrowLeft'))move.sub(right);
  if(move.lengthSq()) move.normalize();
  const running=keys.has('ShiftLeft')||keys.has('ShiftRight'), speed=running?player.runSpeed:player.speed;
  const nx=player.x+move.x*speed*dt; let nz=THREE.MathUtils.clamp(player.z+move.z*speed*dt,map.exitZ+1.4,map.startZ);
  let minX=-4.15,maxX=4.15;
  const inside=rooms.find(r=>Math.abs(player.x)>4.15&&r.side===Math.sign(player.x)&&Math.abs(player.z-r.z)<map.roomDepth/2);
  if(inside) {
    nz=THREE.MathUtils.clamp(nz,inside.z-map.roomDepth/2+.4,inside.z+map.roomDepth/2-.4);
    minX=inside.side>0?4.12:-13.45; maxX=inside.side>0?13.45:-4.12;
  } else {
    // Left and right rooms share the same corridor station; only an open door
    // on the side the player is moving toward may extend that side's boundary.
    const enteringSide=Math.sign(nx)||Math.sign(player.x);
    const passage=roomDoors.find(d=>d.open&&d.side===enteringSide&&Math.abs(nz-d.z)<1.72);
    if(passage) { if(passage.side>0)maxX=13.45; else minX=-13.45; }
  }
  player.x=THREE.MathUtils.clamp(nx,minX,maxX); player.z=nz;
  player.y=1.65+Math.sin(state.elapsed*(running?15:8))*(move.lengthSq()?running?.045:.018:0);
  camera.position.set(player.x,player.y,player.z); camera.rotation.set(state.lookY,state.lookX,0);
  if(running && move.lengthSq() && state.elapsed%2<dt) playSound(68,.08,'triangle',.012);
  // A quiet breath pulses in the darkness; it gets faster when a pursuer closes in.
  const danger=enemies.reduce((m,e)=>Math.min(m,camera.position.distanceTo(e.position)),20);
  if(danger<9) { ui.damage.style.opacity=String(THREE.MathUtils.clamp((9-danger)*.018,0,.12)); }
}

function updateEnemies(dt) {
  for(const e of enemies) {
    const dx=player.x-e.position.x, dz=player.z-e.position.z, d=Math.hypot(dx,dz);
    const playerRoom=roomAt(player.x,player.z), enemyRoom=roomAt(e.position.x,e.position.z);
    if(d<9.5) e.userData.chasing=true;
    if(e.userData.chasing&&d>13.5) { e.userData.chasing=false; e.userData.wanderTarget=null; e.userData.nextWanderAt=0; }

    if(e.userData.chasing) {
      let target={x:player.x,z:player.z};
      if(enemyRoom&&enemyRoom!==playerRoom) target=roomApproach(enemyRoom);
      else if(playerRoom&&enemyRoom!==playerRoom) {
        const approach=roomApproach(playerRoom);
        if(Math.hypot(e.position.x-approach.x,e.position.z-approach.z)>1.05) target=approach;
      }
      moveEnemyToward(e,target,dt,e.userData.kind==='doctor'?1.18:1.0);
    } else {
      if(!e.userData.wanderTarget||state.elapsed>e.userData.nextWanderAt||Math.hypot(e.userData.wanderTarget.x-e.position.x,e.userData.wanderTarget.z-e.position.z)<.6) chooseWanderTarget(e);
      moveEnemyToward(e,e.userData.wanderTarget,dt,e.userData.kind==='doctor'?.34:.52);
      const currentRoom=roomAt(e.position.x,e.position.z);
      if(currentRoom) {
        const lo=currentRoom.side>0?4.28:-13.38, hi=currentRoom.side>0?13.38:-4.28;
        e.position.x=THREE.MathUtils.clamp(e.position.x,lo,hi);
        e.position.z=THREE.MathUtils.clamp(e.position.z,currentRoom.z-map.roomDepth/2+.35,currentRoom.z+map.roomDepth/2-.35);
      } else {
        e.position.x=THREE.MathUtils.clamp(e.position.x,-3.8,3.8);
        e.position.z=THREE.MathUtils.clamp(e.position.z,map.exitZ+1,map.startZ-1);
      }
    }
    if(d<1.12) { caught(); return; }
    if(d<7 && !e.userData.talked) {
      e.userData.talked=true; const line=e.userData.lines[Math.floor(Math.random()*e.userData.lines.length)]; say(e.userData.kind==='doctor'?'DR. HALDEN':'PATIENT 04',line,3600);
    }
    if(d>10)e.userData.talked=false;
  }
}

function updateExit(dt) {
  // The stairwell door is set into the end wall and hinged along its left edge.
  const nearExit=Math.abs(player.z-map.exitZ)<3;
  if(nearExit && !state.exit) {
    const door=new THREE.Group(); door.position.set(-1.42,0,map.exitZ); scene.add(door);
    box(2.84,3.14,.16,materials.dark,1.42,1.57,0,door); box(2.62,2.94,.08,mat(0x575950),1.42,1.57,.1,door);
    box(.13,.13,.1,materials.metal,2.48,1.23,.16,door);
    const panel=box(.33,.5,.1,state.hasCard?materials.light:materials.rust,2.55,1.45,.05,door);
    addTextPlate(door,state.hasCard?'ACCESS GRANTED':'ACCESS DENIED',1.42,3.2,.12,.65,state.hasCard?'#c9d7b6':'#cf7a69');
    state.exit=door; const proxy=new THREE.Object3D(); proxy.position.set(0,1.3,map.exitZ+1.3); proxy.userData.type='exit'; proxy.userData.prompt='USE STAIRWELL'; scene.add(proxy); interactables.push(proxy); state.exit.userData.proxy=proxy; state.exit.userData.panel=panel;
  }
  if(state.exit) {
    const panel=state.exit.userData.panel; panel.material=state.hasCard?materials.light:materials.rust;
    if(state.hasCard && player.z<map.exitZ+5) {
      state.exit.rotation.y=THREE.MathUtils.damp(state.exit.rotation.y,-1.24,2,dt);
      if(state.exit.userData.proxy) { state.exit.userData.proxy.position.set(0,1.3,map.exitZ+1.3); }
    }
  }
}

function updateAtmosphere(dt) {
  for(const l of lights) {
    const flicker=Math.random()>.994?rand(.04,.22):1;
    l.light.intensity=THREE.MathUtils.damp(l.light.intensity,l.base*flicker,12,dt);
    if(l.panel) l.panel.material.emissiveIntensity=THREE.MathUtils.clamp(l.light.intensity/l.base,0,1.8);
  }
  const danger=enemies.reduce((m,e)=>Math.min(m,camera.position.distanceTo(e.position)),20);
  if(danger<5 && state.elapsed>state.whisperAt) {
    state.whisperAt=state.elapsed+rand(5,9);
    const phrases=['Don’t let it see you.','The walls are too thin.','Keep going down.','It heard that.','Not your room. Not your bed.'];
    ui.whisperText.textContent=phrases[Math.floor(Math.random()*phrases.length)]; ui.whisper.classList.remove('hidden'); setTimeout(()=>ui.whisper.classList.add('hidden'),2400);
  }
}

function updateRoomDoors(dt) {
  for(const door of roomDoors) {
    const target=door.open?door.side*1.42:0;
    door.hinge.rotation.y=THREE.MathUtils.damp(door.hinge.rotation.y,target,5.5,dt);
  }
}

function frame() {
  requestAnimationFrame(frame); const dt=Math.min(clock.getDelta(),.05); state.elapsed+=dt;
  if(state.active && !state.paused) { updateRoomDoors(dt); updatePlayer(dt); updateEnemySpawner(dt); updateEnemies(dt); updateExit(dt); updateAtmosphere(dt); checkForPrompt(); }
  renderer.render(scene,camera);
}
frame();

addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.setSize(innerWidth,innerHeight); });
addEventListener('keydown',(event)=>{
  keys.add(event.code);
  if(event.code==='KeyE' && state.active && !state.paused) interact();
  if(event.code==='Escape' && state.active && document.pointerLockElement===document.body) { state.paused=true; stopDoctorVoice(); ui.pause.classList.remove('hidden'); }
  if(event.code==='KeyM' && state.audio) { state.audioOn=!state.audioOn; if(state.audioOn) state.audio.resume(); else state.audio.suspend(); showToast(state.audioOn?'WARD HUM ON':'WARD HUM OFF'); }
});
addEventListener('keyup',(event)=>keys.delete(event.code));
document.addEventListener('mousemove',(event)=>{ if(document.pointerLockElement===document.body&&state.active&&!state.paused) { state.lookX-=event.movementX*.0023; state.lookY=THREE.MathUtils.clamp(state.lookY-event.movementY*.0023,-1.34,1.34); } });
document.addEventListener('pointerlockchange',()=>{
  if(state.active && !state.paused && document.pointerLockElement!==document.body) { state.paused=true; ui.pause.classList.remove('hidden'); }
});
ui.start.addEventListener('click',begin); ui.resume.addEventListener('click',resume); ui.restart.addEventListener('click',begin);
ui.quit.addEventListener('click',()=>{ state.active=false; state.paused=false; document.exitPointerLock?.(); ui.pause.classList.add('hidden'); ui.hud.classList.add('hidden'); ui.footer.classList.add('hidden'); ui.crosshair.classList.add('hidden'); ui.title.classList.remove('hidden'); });
