import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const stage = document.querySelector(".scene");
const loading = document.getElementById("loading");
const overlay = document.querySelector(".intro");
const keysHeld = new Set();
const ui = {
  health: document.getElementById("health-text"),
  healthBar: document.getElementById("health-bar"),
  enemyHud: document.getElementById("enemy-hud"),
  enemyText: document.getElementById("enemy-text"),
  enemyBar: document.getElementById("enemy-bar"),
  objective: document.getElementById("objective"),
  key: document.getElementById("key-status"),
  runToggle: document.getElementById("run-toggle"),
  runLabel: document.getElementById("run-label"),
  runBar: document.getElementById("run-bar"),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color("#a8a59b");
scene.fog = new THREE.Fog("#a8a59b", 22, 90);
const camera = new THREE.PerspectiveCamera(52, 1, .1, 150);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
stage.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight("#dce4df", "#35332a", 2.0));
const sun = new THREE.DirectionalLight("#ffe2b1", 3.4);
sun.position.set(-12, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -25; sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25;
scene.add(sun);

const mat = (color, roughness = .78, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const mats = {
  ground: mat("#3e4a3e"), stone: mat("#68675d"), darkStone: mat("#3d403b"),
  wood: mat("#4a392c"), warmWood: mat("#66503a"), metal: mat("#777b79", .36, .72),
  darkMetal: mat("#32383a", .47, .55), gold: mat("#bd9c5e", .36, .6),
  cloth: mat("#272b2b"), red: mat("#602e2d"), skin: mat("#bd9576"),
  guardCloth: mat("#57453b"), leaf: mat("#39463a"), water: mat("#687d79", .24, .1),
};

function box(parent, material, x, y, z, sx, sy, sz, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}
function sphere(parent, material, x, y, z, sx, sy = sx, sz = sx) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), material);
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}

const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), mats.ground);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function addWall(x, y, z, sx, sy, sz, color = mats.stone) {
  return box(scene, color, x, y, z, sx, sy, sz);
}
// A simple playable courtyard: gatehouse, flanking walls, yard clutter and watch fires.
addWall(0, 3.3, -23, 25, 6.6, 2.5, mats.darkStone);
addWall(-17, 3.2, -3, 2.2, 6.4, 42);
addWall(17, 3.2, -3, 2.2, 6.4, 42);
addWall(-9, 2.5, 8, 2, 5, 23, mats.darkStone);
addWall(9, 2.5, 8, 2, 5, 23, mats.darkStone);
for (let i = 0; i < 7; i++) {
  const x = -12 + i * 4;
  box(scene, i % 2 ? mats.stone : mats.darkStone, x, 1.6, -23, 3.7, 3.2 + (i % 3), 3);
}
for (let i = 0; i < 12; i++) {
  const x = (i * 7.31 % 26) - 13, z = (i * 9.7 % 30) - 12;
  if (Math.abs(x) < 3 && z > -12) continue;
  if (i % 3 === 0) {
    box(scene, mats.wood, x, .7, z, 1.9, 1.2, 1.25);
    box(scene, mats.warmWood, x, 1.35, z, 1.8, .12, 1.2);
  } else if (i % 3 === 1) {
    const trunk = box(scene, mats.wood, x, .75, z, .35, 1.5, .35);
    sphere(scene, mats.leaf, x, 2, z, 1.35, 1.3, 1.25);
  } else {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.36, .58, .22, 16), mats.stone);
    p.position.set(x, .11, z); p.castShadow = true; p.receiveShadow = true; scene.add(p);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(.28, .33, .09, 16), mats.water);
    basin.position.set(x, .25, z); scene.add(basin);
  }
}

function makePerson({ player = false, elite = false } = {}) {
  const group = new THREE.Group();
  const bodyMat = player ? mats.cloth : elite ? mats.darkMetal : mats.guardCloth;
  const armorMat = player ? mats.darkMetal : elite ? mats.gold : mats.metal;
  const skinMat = player ? mat("#9c775e") : mats.skin;
  box(group, bodyMat, 0, 1.15, 0, .66, .9, .42);
  box(group, armorMat, 0, 1.38, -.02, .7, .4, .46);
  box(group, player ? mats.red : armorMat, -.37, 1.36, .02, .28, .25, .52);
  box(group, player ? mats.red : armorMat, .37, 1.36, .02, .28, .25, .52);
  sphere(group, skinMat, 0, 1.92, 0, .27, .32, .27);
  if (player) {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(.31, 18, 14, 0, Math.PI * 2, 0, Math.PI * .58), mats.cloth);
    hood.position.set(0, 2.04, -.015); hood.castShadow = true; group.add(hood);
    box(group, mats.red, 0, .94, -.25, .12, .46, .035);
  } else {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(.29, 16, 12, 0, Math.PI * 2, 0, Math.PI * .56), armorMat);
    helmet.position.set(0, 2.06, 0); helmet.castShadow = true; group.add(helmet);
    box(group, mats.darkMetal, 0, 1.87, .19, .33, .09, .08);
    if (elite) {
      box(group, mats.gold, -.2, 2.32, 0, .07, .25, .07);
      box(group, mats.gold, .2, 2.32, 0, .07, .25, .07);
    }
  }
  box(group, bodyMat, -.19, .46, 0, .22, .73, .26);
  box(group, bodyMat, .19, .46, 0, .22, .73, .26);
  box(group, armorMat, -.19, .08, .06, .26, .16, .4);
  box(group, armorMat, .19, .08, .06, .26, .16, .4);

  const sword = new THREE.Group();
  const blade = box(sword, mats.metal, 0, .63, 0, .075, .88, .045);
  blade.rotation.z = -.1;
  box(sword, mats.gold, 0, .2, 0, .3, .08, .1);
  box(sword, mats.wood, 0, .04, 0, .08, .28, .08);
  sword.position.set(.52, 1.35, .05);
  group.add(sword);

  const shield = new THREE.Group();
  box(shield, player ? mats.darkMetal : mats.wood, 0, 0, 0, .12, .76, .58);
  box(shield, mats.gold, .07, 0, 0, .04, .56, .035);
  box(shield, mats.gold, .07, 0, 0, .04, .035, .43);
  shield.position.set(-.55, 1.2, .1);
  group.add(shield);
  group.userData = { sword, shield, elite, player, hit: 0, phase: Math.random() * 5 };
  scene.add(group);
  return group;
}

const hero = makePerson({ player: true });
hero.position.set(0, 0, 7);
const guard = makePerson();
guard.position.set(4, 0, -7);
const guardWarning = new THREE.Mesh(
  new THREE.TorusGeometry(1.35, .035, 8, 40),
  new THREE.MeshBasicMaterial({ color: "#e4a45f", transparent: true, opacity: .85 }),
);
guardWarning.rotation.x = -Math.PI / 2;
guardWarning.position.y = .045;
guardWarning.visible = false;
scene.add(guardWarning);
const enemyHealthCanvas = document.createElement("canvas");
enemyHealthCanvas.width = 256;
enemyHealthCanvas.height = 64;
const enemyHealthContext = enemyHealthCanvas.getContext("2d");
const enemyHealthTexture = new THREE.CanvasTexture(enemyHealthCanvas);
enemyHealthTexture.colorSpace = THREE.SRGBColorSpace;
const enemyHealthSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: enemyHealthTexture,
  transparent: true,
  depthTest: false,
}));
enemyHealthSprite.scale.set(2.35, .58, 1);
scene.add(enemyHealthSprite);
let drawnEnemyHealth = -1;
const civilian = makePerson();
civilian.position.set(-8, 0, -16);
civilian.scale.setScalar(.84);

const keyMesh = new THREE.Group();
const keyRing = new THREE.Mesh(new THREE.TorusGeometry(.16, .045, 8, 20), mats.gold);
keyMesh.add(keyRing);
const keyShaft = box(keyMesh, mats.gold, .28, 0, 0, .36, .07, .07);
box(keyMesh, mats.gold, .39, -.08, 0, .07, .15, .07);
keyMesh.position.set(4.15, .65, -6.8);
keyMesh.rotation.z = -.6;
scene.add(keyMesh);

const bars = new THREE.Group();
for (let i = 0; i < 7; i++) box(bars, mats.metal, -1.15 + i * .38, 1.35, 0, .065, 2.7, .065);
box(bars, mats.darkStone, 0, 0, 0, 3, .2, .55);
bars.position.set(-8, 0, -17);
scene.add(bars);

const fireLight = new THREE.PointLight("#ffb366", 25, 16, 2);
fireLight.position.set(-11, 2.3, -3);
scene.add(fireLight);
const torch = new THREE.Mesh(new THREE.SphereGeometry(.17, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffb76b" }));
torch.position.copy(fireLight.position);
scene.add(torch);

const powerLight = new THREE.PointLight("#a78bd4", 0, 9, 2);
scene.add(powerLight);
let power = 0, health = 250, hasKey = false, started = false, defeated = false, shield = false, runMode = false, runStamina = 100, dodging = 0, dodgeCooldown = 0, attackTime = 0;
let guardHealth = 100, guardAttack = 0, guardAttackHit = false, guardCooldown = .8, guardAttackNumber = 0, guardAttackStyle = null, civilianFreed = false;
const guardAttacks = [
  { name: "QUICK SLASH", duration: .62, windup: .44, hitAt: .51, damage: 16, color: "#e3a35c" },
  { name: "OVERHEAD STRIKE", duration: .9, windup: .58, hitAt: .66, damage: 23, color: "#db735e" },
  { name: "FORWARD THRUST", duration: .68, windup: .48, hitAt: .55, damage: 19, color: "#d4c17c" },
];
let moveAngle = 0;
const cursorNdc = new THREE.Vector2(0, .25);
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const cursorTarget = new THREE.Vector3();
const runDirection = new THREE.Vector3();
let cursorHeld = false;
const clock = new THREE.Clock();

function resize() {
  const rect = stage.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function updateHud() {
  ui.health.textContent = `${Math.ceil(health)} / 250`;
  ui.healthBar.style.width = `${health / 250 * 100}%`;
  ui.enemyHud.classList.toggle("visible", !civilianFreed);
  ui.enemyText.textContent = `${Math.ceil(guardHealth)} / 100`;
  ui.enemyBar.style.width = `${guardHealth}%`;
  ui.key.textContent = hasKey ? "KEY RECOVERED" : "NO KEY";
  ui.key.classList.toggle("has-key", hasKey);
  ui.runLabel.textContent = runMode ? "RUN MODE: ON · CURSOR STEERS" : "RUN MODE: OFF";
  ui.runToggle.classList.toggle("active", runMode);
  ui.runToggle.setAttribute("aria-pressed", String(runMode));
  ui.runBar.style.width = `${runStamina}%`;
  ui.runBar.style.background = runStamina < 25 ? "#c47761" : "";
  if (drawnEnemyHealth !== guardHealth) {
    drawnEnemyHealth = guardHealth;
    enemyHealthContext.clearRect(0, 0, enemyHealthCanvas.width, enemyHealthCanvas.height);
    enemyHealthContext.fillStyle = "rgba(12, 15, 14, .9)";
    enemyHealthContext.fillRect(5, 4, 246, 56);
    enemyHealthContext.textAlign = "left";
    enemyHealthContext.font = "bold 17px Segoe UI, Arial, sans-serif";
    enemyHealthContext.fillStyle = "#eee9de";
    enemyHealthContext.fillText("PALACE GUARD", 14, 25);
    enemyHealthContext.textAlign = "right";
    enemyHealthContext.font = "bold 16px Segoe UI, Arial, sans-serif";
    enemyHealthContext.fillText(`${Math.ceil(guardHealth)} / 100 HP`, 242, 25);
    enemyHealthContext.fillStyle = "rgba(255, 255, 255, .2)";
    enemyHealthContext.fillRect(14, 36, 228, 10);
    enemyHealthContext.fillStyle = "#bf705a";
    enemyHealthContext.fillRect(14, 36, 228 * Math.max(0, guardHealth) / 100, 10);
    enemyHealthTexture.needsUpdate = true;
  }
  enemyHealthSprite.visible = started && guardHealth > 0 && guard.visible;
}

function startPreview() {
  health = 250;
  guardHealth = 100;
  hasKey = false;
  civilianFreed = false;
  defeated = false;
  started = true;
  shield = false;
  runMode = false;
  cursorHeld = false;
  runStamina = 100;
  dodging = 0;
  dodgeCooldown = 0;
  attackTime = 0;
  guardAttack = 0;
  guardAttackHit = false;
  guardAttackNumber = 0;
  guardAttackStyle = null;
  guardCooldown = .8;
  drawnEnemyHealth = -1;
  hero.position.set(0, 0, 7);
  hero.rotation.set(0, 0, 0);
  hero.scale.setScalar(1);
  guard.position.set(4, 0, -7);
  guard.visible = true;
  keyMesh.visible = false;
  civilian.position.set(-8, 0, -16);
  civilian.visible = true;
  bars.visible = true;
  ui.objective.textContent = "Find the guard and recover the key.";
  ui.key.textContent = "NO KEY";
  ui.key.classList.remove("has-key");
  stage.classList.add("started");
  overlay.classList.add("hidden");
  updateHud();
}

function finishPreview() {
  if (defeated) return;
  defeated = true;
  started = false;
  runMode = false;
  cursorHeld = false;
  shield = false;
  hero.rotation.x = -Math.PI / 2;
  overlay.innerHTML = `
    <p class="eyebrow">JAMES HAS FALLEN</p>
    <h1>MISSION<br /><span>FAILED</span></h1>
    <p>Your health reached zero. The captives still need your help.</p>
    <button id="retry">Try again <span>→</span></button>
    <small>Tip: hold right-click to block. Hold Shift to dodge.</small>`;
  overlay.querySelector("#retry").addEventListener("click", startPreview);
  overlay.classList.remove("hidden");
}

function attack() {
  if (!started || defeated || attackTime > 0) return;
  attackTime = .34;
  if (!civilianFreed && hero.position.distanceTo(guard.position) < 3.2) {
    guardHealth = Math.max(0, guardHealth - 35);
    guard.userData.hit = .17;
    if (guardHealth === 0) {
      guard.visible = false;
      keyMesh.visible = true;
      ui.objective.textContent = "Recover the key, then unlock the prison cell.";
    }
    updateHud();
  }
}

function interact() {
  if (!started || defeated) return;
  if (!hasKey && guardHealth <= 0 && hero.position.distanceTo(keyMesh.position) < 2.3) {
    hasKey = true; keyMesh.visible = false;
    ui.objective.textContent = "Unlock the cell and free the captive.";
  } else if (hasKey && !civilianFreed && hero.position.distanceTo(civilian.position) < 3.4) {
    hasKey = false; civilianFreed = true; bars.visible = false;
    ui.objective.textContent = "The captive is free. Find the route beyond the gate.";
    ui.key.textContent = "CAPTIVE RESCUED";
    ui.key.classList.add("has-key");
  } else if (civilianFreed && hero.position.z < -19 && Math.abs(hero.position.x) < 4) {
    ui.objective.textContent = "This is a visual prototype of the escape route.";
  } else {
    ui.objective.textContent = "Move closer to the guard, key, or cell to interact.";
  }
}

function handleAttackInput() {
  if (keysHeld.has(" ")) attack();
}
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
  keysHeld.add(key);
  if (!event.repeat && key === " ") attack();
  if (!event.repeat && key === "e") interact();
  if (!event.repeat && key === "q" && started && runStamina > 0) runMode = !runMode;
  if (!event.repeat && key === "shift" && dodgeCooldown <= 0) { dodging = .3; dodgeCooldown = .9; }
});
window.addEventListener("keyup", (event) => { keysHeld.delete(event.key.toLowerCase()); });
window.addEventListener("blur", () => { keysHeld.clear(); shield = false; cursorHeld = false; });
renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
renderer.domElement.addEventListener("pointermove", (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const nextX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const nextY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  cursorNdc.set(nextX, nextY);
});
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button === 0 && runMode && started) {
    cursorHeld = true;
    renderer.domElement.setPointerCapture(event.pointerId);
  } else if (event.button === 0) attack();
  if (event.button === 2) shield = true;
});
window.addEventListener("pointerup", (event) => {
  if (event.button === 0) cursorHeld = false;
  if (event.button === 2) shield = false;
});
ui.runToggle.addEventListener("click", () => {
  if (!started) return;
  if (!runMode && runStamina <= 0) return;
  runMode = !runMode;
  if (!runMode) cursorHeld = false;
});
document.getElementById("begin").addEventListener("click", () => {
  startPreview();
});

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .04);
  const t = clock.elapsedTime;
  const up = keysHeld.has("w") || keysHeld.has("arrowup");
  const down = keysHeld.has("s") || keysHeld.has("arrowdown");
  const left = keysHeld.has("a") || keysHeld.has("arrowleft");
  const right = keysHeld.has("d") || keysHeld.has("arrowright");
  let x = Number(right) - Number(left), z = Number(down) - Number(up);
  let moving = up || down || left || right;
  if (runMode && started && cursorHeld) {
    moving = false;
    raycaster.setFromCamera(cursorNdc, camera);
    if (raycaster.ray.intersectPlane(groundPlane, cursorTarget)) {
      runDirection.set(cursorTarget.x - hero.position.x, 0, cursorTarget.z - hero.position.z);
      if (runDirection.lengthSq() > .5) {
        runDirection.normalize();
        x = runDirection.x;
        z = runDirection.z;
        moving = true;
      }
    }
  }
  if (started && moving) {
    const len = Math.hypot(x, z) || 1;
    moveAngle = Math.atan2(x, z);
    const speed = dodging > 0 ? 9 : shield ? 2.4 : runMode ? 6.1 : 4.3;
    hero.position.x = THREE.MathUtils.clamp(hero.position.x + x / len * speed * dt, -14.5, 14.5);
    hero.position.z = THREE.MathUtils.clamp(hero.position.z + z / len * speed * dt, -19, 17);
  }
  if (started && runMode && cursorHeld && moving) {
    runStamina = Math.max(0, runStamina - dt * 13);
    if (runStamina === 0) runMode = false;
  } else {
    runStamina = Math.min(100, runStamina + dt * 20);
  }
  hero.rotation.y = moveAngle;
  hero.userData.phase += moving ? dt * 9 : dt * 2;
  hero.children[0].rotation.x = moving ? Math.sin(hero.userData.phase) * .06 : 0;
  const attackProgress = 1 - attackTime / .34;
  const easeOut = (value) => 1 - (1 - value) * (1 - value);
  let swordAngle = 2.2;
  if (attackTime > 0) {
    if (attackProgress < .24) {
      swordAngle = THREE.MathUtils.lerp(2.2, -.95, easeOut(attackProgress / .24));
    } else if (attackProgress < .62) {
      swordAngle = THREE.MathUtils.lerp(-.95, 1.35, easeOut((attackProgress - .24) / .38));
    } else {
      swordAngle = THREE.MathUtils.lerp(1.35, 2.2, (attackProgress - .62) / .38);
    }
  }
  hero.userData.sword.rotation.z = swordAngle;
  hero.userData.shield.rotation.y = shield ? -.58 : 0;
  hero.userData.shield.position.z = shield ? .42 : .1;
  hero.scale.y = dodging > 0 ? .72 : 1;
  hero.userData.sword.rotation.x = 0;
  if (health <= 0 && !defeated) finishPreview();
  attackTime = Math.max(0, attackTime - dt);
  dodging = Math.max(0, dodging - dt);
  dodgeCooldown = Math.max(0, dodgeCooldown - dt);
  guardCooldown -= dt;
  if (guardHealth > 0 && started) {
    const dx = hero.position.x - guard.position.x, dz = hero.position.z - guard.position.z;
    const d = Math.hypot(dx, dz) || 1;
    guard.rotation.y = Math.atan2(dx, dz);
    if (d > 1.65 && d < 18) {
      guard.position.x += dx / d * 1.45 * dt;
      guard.position.z += dz / d * 1.45 * dt;
    } else if (d <= 1.9 && guardCooldown <= 0 && guardAttack <= 0) {
      guardAttackStyle = guardAttacks[guardAttackNumber % guardAttacks.length];
      guardAttackNumber++;
      guardAttack = guardAttackStyle.duration;
      guardAttackHit = false;
      guardCooldown = guardAttackStyle.duration + .65;
    }
    if (guardAttack > 0) {
      guardAttack = Math.max(0, guardAttack - dt);
      const attackProgress = 1 - guardAttack / guardAttackStyle.duration;
      const style = guardAttackStyle;
      if (style.name === "QUICK SLASH") {
        if (attackProgress < style.windup) {
          guard.userData.sword.rotation.z = THREE.MathUtils.lerp(.2, -1.25, attackProgress / style.windup);
        } else if (attackProgress < .76) {
          guard.userData.sword.rotation.z = THREE.MathUtils.lerp(-1.25, 1.55, (attackProgress - style.windup) / (.76 - style.windup));
        } else {
          guard.userData.sword.rotation.z = THREE.MathUtils.lerp(1.55, .2, (attackProgress - .76) / .24);
        }
        guard.userData.sword.rotation.x = 0;
        guard.userData.sword.position.z = .05;
      } else if (style.name === "OVERHEAD STRIKE") {
        if (attackProgress < style.windup) {
          guard.userData.sword.rotation.z = THREE.MathUtils.lerp(.2, -2.15, attackProgress / style.windup);
        } else if (attackProgress < .78) {
          guard.userData.sword.rotation.z = THREE.MathUtils.lerp(-2.15, 2.05, (attackProgress - style.windup) / (.78 - style.windup));
        } else {
          guard.userData.sword.rotation.z = THREE.MathUtils.lerp(2.05, .2, (attackProgress - .78) / .22);
        }
        guard.userData.sword.rotation.x = 0;
        guard.userData.sword.position.z = .05;
      } else {
        const thrust = attackProgress < style.windup
          ? attackProgress / style.windup
          : attackProgress < .76
            ? 1 - (attackProgress - style.windup) / (.76 - style.windup)
            : 0;
        guard.userData.sword.rotation.z = THREE.MathUtils.lerp(.2, -.16, thrust);
        guard.userData.sword.rotation.x = -.55 * thrust;
        guard.userData.sword.position.z = .05 + .72 * thrust;
      }
      guardWarning.visible = attackProgress < style.windup;
      guardWarning.material.color.set(style.color);
      const warningPulse = .92 + Math.sin(t * 20) * .12;
      guardWarning.scale.setScalar(warningPulse);
      if (attackProgress >= style.hitAt && !guardAttackHit) {
        guardAttackHit = true;
        if (d < 2.6 && started) {
          health = Math.max(0, health - (dodging > 0 ? 0 : shield ? Math.ceil(style.damage * .12) : style.damage));
          if (health === 0) finishPreview();
        }
      }
    } else {
      guardWarning.visible = false;
      guard.userData.sword.rotation.set(0, 0, .2);
      guard.userData.sword.position.z = .05;
    }
  }
  guard.userData.hit = Math.max(0, guard.userData.hit - dt);
  guard.position.y = Math.sin(t * 2 + 1) * .025;
  guardWarning.position.set(guard.position.x, .045, guard.position.z);
  enemyHealthSprite.position.set(guard.position.x, guard.position.y + 2.75, guard.position.z);
  civilian.position.y = Math.sin(t * 1.4) * .018;
  fireLight.intensity = 23 + Math.sin(t * 8) * 4;
  torch.scale.setScalar(.9 + Math.sin(t * 10) * .14);
  powerLight.position.copy(hero.position).add(new THREE.Vector3(0, 1.6, 0));
  camera.position.lerp(new THREE.Vector3(hero.position.x, hero.position.y + 7.2, hero.position.z + 11.5), 1 - Math.exp(-dt * 3));
  camera.lookAt(hero.position.x, hero.position.y + .9, hero.position.z - 2.1);
  updateHud();
  renderer.render(scene, camera);
  loading.classList.add("hidden");
}
updateHud();
animate();
