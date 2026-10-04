(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const ui = {
    location: document.getElementById("location"),
    rescued: document.getElementById("rescued"),
    keys: document.getElementById("keys"),
    weapon: document.getElementById("weapon"),
    healthText: document.getElementById("health-text"),
    healthBar: document.getElementById("health-bar"),
    healthCard: document.querySelector(".health-card"),
    enemyCard: document.getElementById("enemy-card"),
    enemyName: document.getElementById("enemy-name"),
    enemyHealthText: document.getElementById("enemy-health-text"),
    enemyHealthBar: document.getElementById("enemy-health-bar"),
    objective: document.getElementById("objective"),
    prompt: document.getElementById("prompt"),
    message: document.getElementById("message"),
    intro: document.getElementById("intro"),
    pauseOverlay: document.getElementById("pause-overlay"),
    musicTrack: document.getElementById("music-track"),
    soundStatus: document.getElementById("sound-status"),
    soundToggle: document.getElementById("sound-toggle"),
  };
  const initialIntroMarkup = ui.intro.querySelector(".intro-card").innerHTML;
  const W = canvas.width;
  const H = canvas.height;
  const WORLD_W = 1800;
  const WORLD_H = 1200;
  const TOTAL_RESCUES = 16;
  const MUSIC_TRACKS = ["click.mp3"];
  const GUARD_ATTACKS = [
    { name: "QUICK SLASH", duration: 0.62, windup: 0.38, hitAt: 0.43, damage: 16, color: "rgba(235, 174, 95, .9)" },
    { name: "OVERHEAD STRIKE", duration: 0.9, windup: 0.58, hitAt: 0.66, damage: 23, color: "rgba(211, 105, 83, .9)" },
    { name: "FORWARD THRUST", duration: 0.7, windup: 0.47, hitAt: 0.55, damage: 19, color: "rgba(220, 199, 124, .9)" },
  ];
  const areas = [
    { name: "Outer Road", color: "#475044", accent: "#6f7155", guards: 5, start: "The road is quiet. Find the guards and take their keys." },
    { name: "Moonlit Gardens", color: "#344339", accent: "#60745b", guards: 5, start: "The garden paths lead to the palace courtyard. Watch the patrols." },
    { name: "Royal Palace", color: "#52463b", accent: "#947653", guards: 5, start: "You are inside the palace. The prisoners are held below." },
    { name: "Undercroft", color: "#373735", accent: "#766c5d", guards: 5, start: "The cells are close. Find the remaining captives, then escape." },
  ];
  const input = { up: false, down: false, left: false, right: false, shield: false };
  const game = {
    running: false, paused: false, finished: false, area: 0, rescued: 0, keyCount: 0, keysTaken: 0,
    player: { x: 900, y: 830, r: 17, hp: 250, maxHp: 250, dirX: 0, dirY: -1, attacking: 0, attackCooldown: 0, combo: 0, blocking: false, dodge: 0, dodgeCooldown: 0, invuln: 0, walk: 0 },
    guards: [], keys: [], cells: [], gate: null, particles: [], camera: { x: 0, y: 0 }, time: 0, noteTimer: 0, promptTarget: null,
  };
  let lastTime = 0;
  let audioContext = null;
  let masterGain = null;
  let musicEnabled = true;
  let currentMusicIndex = 0;
  const musicAudio = new Audio(MUSIC_TRACKS[currentMusicIndex]);
  musicAudio.loop = true;
  musicAudio.volume = .28;
  musicAudio.preload = "none";

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function playTone(frequency, start, duration, volume, type = "sine", attack = .04, release = .2, endFrequency = frequency) {
    if (!audioContext || !masterGain || !musicEnabled) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.linearRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.setValueAtTime(volume, start + Math.max(attack, duration - release));
    gain.gain.linearRampToValueAtTime(0, start + duration);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }

  function startBackgroundMusic() {
    if (!musicEnabled || game.paused) return;
    if (!audioContext) {
      if (!window.AudioContext) {
        notify("This browser does not support game sound effects.", 3);
        return;
      }
      audioContext = new window.AudioContext();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(audioContext.destination);
    }
    audioContext.resume().then(() => {
      if (!musicEnabled || game.paused) return;
      masterGain.gain.setTargetAtTime(.72, audioContext.currentTime, .12);
    }).catch((error) => {
      console.error("Unable to start game sound effects.", error);
      notify("Game sound effects could not be started. Check your browser's sound settings.", 3);
    });
    if (musicAudio.paused) {
      musicAudio.play().catch((error) => {
        console.error(`Unable to play background music "${MUSIC_TRACKS[currentMusicIndex]}".`, error);
        notify(`Couldn't play ${MUSIC_TRACKS[currentMusicIndex]}. Check that it is a valid MP3 in the game folder.`, 4);
      });
    }
  }

  function selectMusicTrack(index) {
    currentMusicIndex = (index + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    musicAudio.pause();
    musicAudio.src = MUSIC_TRACKS[currentMusicIndex];
    musicAudio.currentTime = 0;
    ui.musicTrack.textContent = `Track: ${MUSIC_TRACKS[currentMusicIndex]}`;
    document.getElementById("next-track").disabled = MUSIC_TRACKS.length < 2;
    if (game.running && !game.paused && musicEnabled) {
      startBackgroundMusic();
    }
  }

  function nextMusicTrack() {
    if (MUSIC_TRACKS.length > 1) {
      selectMusicTrack(currentMusicIndex + 1);
    }
  }

  musicAudio.addEventListener("error", () => {
    console.error(`Background music file could not be loaded: "${MUSIC_TRACKS[currentMusicIndex]}".`);
    notify(`Couldn't load ${MUSIC_TRACKS[currentMusicIndex]}. Replace it with a valid MP3, then reload the game.`, 4);
  });

  function playAttackSound() {
    if (!audioContext || !musicEnabled) return;
    const now = audioContext.currentTime;
    playTone(580, now, .2, .045, "sawtooth", .015, .15, 150);
  }

  function playKeySound() {
    if (!audioContext || !musicEnabled) return;
    const now = audioContext.currentTime;
    playTone(880, now, .32, .06, "sine", .01, .23);
    playTone(1320, now + .09, .38, .045, "sine", .01, .28);
  }

  function toggleSound() {
    musicEnabled = !musicEnabled;
    ui.soundStatus.textContent = `Sound: ${musicEnabled ? "On" : "Off"}`;
    ui.soundToggle.textContent = musicEnabled ? "Mute sound" : "Enable sound";
    ui.soundToggle.setAttribute("aria-pressed", String(musicEnabled));
    ui.soundToggle.setAttribute("aria-label", musicEnabled ? "Mute game sound" : "Enable game sound");
    if (!musicEnabled) {
      musicAudio.pause();
      if (masterGain && audioContext) masterGain.gain.setTargetAtTime(0, audioContext.currentTime, .05);
    } else if (!game.paused) {
      startBackgroundMusic();
    }
  }

  function notify(text, seconds = 2.3) {
    ui.message.textContent = text;
    game.noteTimer = seconds;
  }

  function personPoint(minDistance = 210) {
    for (let i = 0; i < 40; i++) {
      const p = { x: rand(170, WORLD_W - 170), y: rand(150, WORLD_H - 150) };
      if (dist(p, game.player) > minDistance) return p;
    }
    return { x: 230, y: 210 };
  }

  function createGuard(index) {
    const p = personPoint(250);
    const types = ["PALACE GUARD", "ROYAL SENTINEL", "WATCHMAN", "GATE KEEPER", "PALACE SOLDIER"];
    return {
      ...p, id: `${game.area}-${index}`, hp: 100, maxHp: 100,
      r: 17 + (index % 3), speed: rand(48, 64), state: "patrol",
      patrol: { x: p.x + rand(-110, 110), y: p.y + rand(-80, 80) },
      windup: 0, attackTime: 0, attackStyle: null, attackIndex: Math.floor(Math.random() * 3), attackHit: false,
      cooldown: rand(.3, 1.3), flash: 0, facing: rand(-Math.PI, Math.PI),
      armor: index % 3, skin: ["#b99174", "#d1ac8c", "#875e4b", "#c39473", "#e0b28d"][index],
      cloth: ["#604b3e", "#4b5550", "#6a3e35", "#343a39", "#695b42"][index],
      label: types[index % types.length], dead: false,
    };
  }

  function setupArea(index) {
    game.area = index;
    game.guards = Array.from({ length: areas[index].guards }, (_, i) => createGuard(i));
    game.keys = [];
    const cellCount = 4;
    game.cells = Array.from({ length: cellCount }, (_, i) => ({
      x: 265 + (i % 2) * 1270,
      y: 275 + Math.floor(i / 2) * 610,
      index: game.rescued + i + 1,
      locked: true,
      rescued: false,
      person: i % 4,
    }));
    game.gate = index < areas.length - 1
      ? { x: WORLD_W / 2, y: 80, locked: true, label: "PALACE GATE" }
      : { x: WORLD_W / 2, y: 80, locked: true, label: "ESCAPE GATE" };
    game.player.x = WORLD_W / 2;
    game.player.y = WORLD_H - 125;
    game.player.dirX = 0;
    game.player.dirY = -1;
    notify(areas[index].start, 4);
    updateUI();
  }

  function startGame() {
    startBackgroundMusic();
    game.running = true;
    game.paused = false;
    game.finished = false;
    game.area = 0;
    game.rescued = 0;
    game.keyCount = 0;
    game.keysTaken = 0;
    game.player.hp = game.player.maxHp;
    game.player.combo = 0;
    game.player.attacking = 0;
    game.particles = [];
    ui.pauseOverlay.classList.add("hidden");
    ui.intro.classList.add("hidden");
    updateMenuState();
    setupArea(0);
  }

  function updateMenuState() {
    document.getElementById("pause-game").disabled = !game.running || game.paused;
    document.getElementById("resume-game").disabled = !game.paused;
    document.getElementById("quit-game").disabled = !game.running && !game.paused && !game.finished;
  }

  function closeMenu() {
    document.getElementById("game-menu").hidden = true;
    document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
  }

  function pauseGame() {
    if (!game.running || game.paused) return;
    game.paused = true;
    musicAudio.pause();
    ui.pauseOverlay.classList.remove("hidden");
    closeMenu();
    updateMenuState();
  }

  function resumeGame() {
    if (!game.paused) return;
    game.paused = false;
    startBackgroundMusic();
    ui.pauseOverlay.classList.add("hidden");
    closeMenu();
    updateMenuState();
  }

  function stopBackgroundMusic() {
    musicAudio.pause();
    musicAudio.currentTime = 0;
    if (masterGain && audioContext) masterGain.gain.setTargetAtTime(0, audioContext.currentTime, .05);
  }

  function quitGame() {
    game.running = false;
    game.paused = false;
    game.finished = false;
    ui.pauseOverlay.classList.add("hidden");
    ui.intro.querySelector(".intro-card").innerHTML = initialIntroMarkup;
    ui.intro.classList.remove("hidden");
    document.getElementById("start").addEventListener("click", startGame);
    stopBackgroundMusic();
    closeMenu();
    updateMenuState();
  }

  function endGame(won) {
    if (game.finished) return;
    game.running = false;
    game.paused = false;
    game.finished = true;
    ui.pauseOverlay.classList.add("hidden");
    stopBackgroundMusic();
    ui.intro.classList.remove("hidden");
    const card = ui.intro.querySelector(".intro-card");
    card.innerHTML = won
      ? '<p class="kicker">THE MOUNTAIN KINGDOM IS FREE</p><h1>JAMES<br /><span>HUNTER</span></h1><p class="intro-copy">All sixteen captives are safe. You led them through the palace gates and home. The story is only just beginning.</p><button id="start" type="button">Play again <span>→</span></button>'
      : '<p class="kicker">THE PALACE STILL HOLDS ITS CAPTIVES</p><h1>FALLEN,<br />HUNTER</h1><p class="intro-copy">The guards overwhelmed you, but the villagers still need help. Regroup and try another route.</p><button id="start" type="button">Try again <span>→</span></button>';
    card.querySelector("#start").addEventListener("click", startGame);
    updateMenuState();
  }

  function updateUI() {
    ui.location.textContent = areas[game.area].name;
    ui.rescued.textContent = `${game.rescued} / ${TOTAL_RESCUES}`;
    ui.keys.textContent = String(game.keyCount);
    ui.weapon.textContent = game.player.blocking ? "Shield raised" : "Sword ready";
    ui.healthText.textContent = `${Math.ceil(game.player.hp)} / ${game.player.maxHp}`;
    ui.healthBar.style.width = `${(game.player.hp / game.player.maxHp) * 100}%`;
    ui.healthCard.classList.toggle("low", game.player.hp <= 75);
    const target = nearestGuard();
    if (target && dist(target, game.player) < 520) {
      ui.enemyCard.style.visibility = "visible";
      ui.enemyName.textContent = target.label;
      ui.enemyHealthText.textContent = `${Math.ceil(target.hp)} / 100`;
      ui.enemyHealthBar.style.width = `${Math.max(0, target.hp)}%`;
    } else {
      ui.enemyCard.style.visibility = "hidden";
    }
    ui.objective.textContent = game.area < areas.length - 1
      ? `Rescue ${game.rescued} of ${TOTAL_RESCUES}. Find keys to free captives and unlock the next gate.`
      : game.rescued < TOTAL_RESCUES
        ? `Free the remaining ${TOTAL_RESCUES - game.rescued} captives, then unlock the escape gate.`
        : "All captives rescued. Find the escape gate and lead them to safety.";
  }

  function nearestGuard() {
    let nearest = null;
    let best = Infinity;
    for (const guard of game.guards) {
      if (guard.dead) continue;
      const d = dist(guard, game.player);
      if (d < best) { best = d; nearest = guard; }
    }
    return nearest;
  }

  function dropKey(guard) {
    game.keys.push({ x: guard.x + rand(-12, 12), y: guard.y + rand(-8, 12), r: 10, bob: rand(0, Math.PI * 2), picked: false });
    notify("Guard defeated. Take the key they carried.", 3);
  }

  function attack() {
    const p = game.player;
    if (!game.running || p.blocking || p.attackCooldown > 0) return;
    playAttackSound();
    p.combo = (p.combo % 3) + 1;
    p.attacking = .24;
    p.attackCooldown = p.combo === 3 ? .48 : .34;
    let target = null;
    let best = 90;
    for (const guard of game.guards) {
      if (guard.dead) continue;
      const dx = guard.x - p.x, dy = guard.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const forward = (dx / d) * p.dirX + (dy / d) * p.dirY;
      if (d < best + guard.r && forward > -.05) { target = guard; best = d; }
    }
    if (!target) {
      notify("Your blade cuts through empty air. Close the distance.", 1);
      return;
    }
    const damage = [0, 34, 31, 47][p.combo];
    target.hp = Math.max(0, target.hp - damage);
    target.flash = .18;
    target.facing = Math.atan2(p.y - target.y, p.x - target.x);
    burst(target.x, target.y, "#d8b987", 6);
    if (target.hp <= 0) {
      target.dead = true;
      dropKey(target);
    } else {
      target.state = "alert";
    }
    updateUI();
  }

  function damagePlayer(amount, attacker) {
    const p = game.player;
    if (p.invuln > 0 || p.dodge > 0) return;
    const angle = Math.atan2(attacker.y - p.y, attacker.x - p.x);
    const facing = Math.atan2(p.dirY, p.dirX);
    const angleDiff = Math.atan2(Math.sin(angle - facing), Math.cos(angle - facing));
    const front = Math.abs(angleDiff) < 1.35;
    if (input.shield && front) {
      amount = amount <= 19 ? 0 : Math.ceil(amount * .12);
      notify(amount ? "Your shield absorbs most of the blow." : "Perfect block. The strike glances off your shield.", .9);
      burst(p.x + Math.cos(angle) * 18, p.y + Math.sin(angle) * 18, "#dbd4c5", 5);
    } else {
      p.hp = Math.max(0, p.hp - amount);
      p.invuln = .55;
      notify("You were hit. Raise your shield or dodge the next strike.", 1.5);
      burst(p.x, p.y, "#bb755e", 7);
      if (p.hp <= 0) endGame(false);
    }
    updateUI();
  }

  function dodge() {
    const p = game.player;
    if (!game.running || p.dodgeCooldown > 0) return;
    p.dodge = .28;
    p.dodgeCooldown = .95;
    p.invuln = .32;
    const moving = input.up || input.down || input.left || input.right;
    if (!moving) { input.left = p.dirX >= 0; input.right = p.dirX < 0; }
  }

  function useAction() {
    if (!game.running) return;
    const p = game.player;
    const possibilities = [];
    for (const key of game.keys) if (!key.picked) possibilities.push({ type: "key", item: key, d: dist(p, key) });
    for (const cell of game.cells) if (!cell.rescued) possibilities.push({ type: "cell", item: cell, d: dist(p, cell) });
    if (game.gate && game.area < areas.length - 1 || game.gate && game.rescued === TOTAL_RESCUES) {
      possibilities.push({ type: "gate", item: game.gate, d: dist(p, game.gate) });
    }
    possibilities.sort((a, b) => a.d - b.d);
    const target = possibilities[0];
    if (!target || target.d > 68) {
      notify("Nothing to use nearby. Search the area for guards and prisoners.", 1.3);
      return;
    }
    if (target.type === "key") {
      target.item.picked = true;
      game.keyCount++;
      game.keysTaken++;
      playKeySound();
      notify(`Key collected. ${game.keyCount} ${game.keyCount === 1 ? "key" : "keys"} in your ring.`);
    } else if (target.type === "cell") {
      if (target.item.locked) {
        if (game.keyCount < 1) {
          notify("This cell is locked. Find and collect a guard's key.", 2);
          return;
        }
        game.keyCount--;
        target.item.locked = false;
        notify("The cell unlocks. The captive is free.", 2);
      } else {
        target.item.rescued = true;
        game.rescued++;
        burst(target.item.x, target.item.y, "#94c5a3", 12);
        notify("Captive rescued. Stay close and keep them safe.", 2);
        updateUI();
        if (game.rescued === TOTAL_RESCUES) notify("All 16 captives are free. Find the escape gate!", 4);
      }
    } else {
      if (game.area < areas.length - 1 && game.keyCount > 0) {
        game.keyCount--;
        setupArea(game.area + 1);
      } else if (game.area < areas.length - 1) {
        notify("The palace gate is locked. Take a key from a guard.", 2);
      } else if (game.rescued < TOTAL_RESCUES) {
        notify("The escape route is blocked. Free all 16 captives first.", 2);
      } else if (game.keyCount > 0) {
        endGame(true);
      } else {
        notify("The escape gate is locked. Find one last guard key.", 2);
      }
    }
    updateUI();
  }

  function burst(x, y, color, amount) {
    for (let i = 0; i < amount; i++) {
      const angle = rand(0, Math.PI * 2), speed = rand(28, 115);
      game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: rand(.22, .55), color });
    }
  }

  function updateGuard(guard, dt) {
    guard.flash = Math.max(0, guard.flash - dt);
    guard.cooldown -= dt;
    const d = dist(guard, game.player);
    if (d < 340) guard.state = "alert";
    if (guard.state === "alert" || guard.state === "attack") {
      const dx = game.player.x - guard.x, dy = game.player.y - guard.y;
      const len = Math.hypot(dx, dy) || 1;
      guard.facing = Math.atan2(dy, dx);
      if (d > guard.r + game.player.r + 24) {
        guard.x += (dx / len) * guard.speed * dt;
        guard.y += (dy / len) * guard.speed * dt;
      } else if (guard.cooldown <= 0 && guard.attackTime <= 0) {
        guard.attackStyle = GUARD_ATTACKS[guard.attackIndex % GUARD_ATTACKS.length];
        guard.attackIndex++;
        guard.attackTime = guard.attackStyle.duration;
        guard.attackHit = false;
        guard.state = "attack";
        guard.cooldown = guard.attackStyle.duration + rand(.55, .8);
      }
      if (guard.attackTime > 0) {
        const style = guard.attackStyle;
        guard.attackTime = Math.max(0, guard.attackTime - dt);
        const progress = 1 - guard.attackTime / style.duration;
        guard.windup = Math.max(0, style.windup - progress);
        if (progress >= style.hitAt && !guard.attackHit) {
          guard.attackHit = true;
          if (d < guard.r + game.player.r + 36) damagePlayer(style.damage, guard);
        }
        if (guard.attackTime <= 0) {
          guard.state = "alert";
        }
      } else {
        guard.windup = 0;
      }
    } else {
      const dx = guard.patrol.x - guard.x, dy = guard.patrol.y - guard.y;
      const len = Math.hypot(dx, dy);
      if (len > 8) {
        guard.x += dx / len * guard.speed * .38 * dt;
        guard.y += dy / len * guard.speed * .38 * dt;
        guard.facing = Math.atan2(dy, dx);
      } else {
        guard.patrol = { x: clamp(guard.x + rand(-140, 140), 120, WORLD_W - 120), y: clamp(guard.y + rand(-130, 130), 120, WORLD_H - 120) };
      }
    }
  }

  function update(dt) {
    if (!game.running || game.paused) return;
    game.time += dt;
    if (game.noteTimer > 0 && (game.noteTimer -= dt) <= 0) ui.message.textContent = areas[game.area].start;
    const p = game.player;
    p.attacking = Math.max(0, p.attacking - dt);
    p.attackCooldown = Math.max(0, p.attackCooldown - dt);
    p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
    p.dodge = Math.max(0, p.dodge - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.blocking = input.shield && p.dodge <= 0;

    let dx = Number(input.right) - Number(input.left);
    let dy = Number(input.down) - Number(input.up);
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      p.dirX = dx; p.dirY = dy;
      p.walk += dt * (p.blocking ? 5 : 9);
      let speed = p.blocking ? 102 : 192;
      if (p.dodge > 0) speed = 465;
      p.x = clamp(p.x + dx * speed * dt, 30, WORLD_W - 30);
      p.y = clamp(p.y + dy * speed * dt, 80, WORLD_H - 30);
    }
    if (game.keys.some((key) => !key.picked && dist(key, p) < 32)) {
      ui.prompt.textContent = "E  ·  TAKE GUARD'S KEY";
      ui.prompt.classList.add("visible");
    } else {
      const nearbyCell = game.cells.find((cell) => !cell.rescued && dist(cell, p) < 67);
      const nearGate = game.gate && dist(game.gate, p) < 80 && (game.area < areas.length - 1 || game.rescued === TOTAL_RESCUES);
      if (nearbyCell) {
        ui.prompt.textContent = nearbyCell.locked ? "E  ·  UNLOCK CELL (1 KEY)" : "E  ·  RESCUE CAPTIVE";
        ui.prompt.classList.add("visible");
      } else if (nearGate) {
        ui.prompt.textContent = game.area === areas.length - 1 ? "E  ·  ESCAPE WITH THE CAPTIVES" : "E  ·  UNLOCK PALACE GATE (1 KEY)";
        ui.prompt.classList.add("visible");
      } else ui.prompt.classList.remove("visible");
    }
    for (const guard of game.guards) if (!guard.dead) updateGuard(guard, dt);
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const particle = game.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.life <= 0) game.particles.splice(i, 1);
    }
    game.camera.x = clamp(p.x - W / 2, 0, WORLD_W - W);
    game.camera.y = clamp(p.y - H / 2, 0, WORLD_H - H);
    if (Math.floor(game.time * 2) !== Math.floor((game.time - dt) * 2)) updateUI();
  }

  function worldToScreen(x, y) {
    return { x: x - game.camera.x, y: y - game.camera.y };
  }

  function building(x, y, w, h, name, color = "#3d3b32") {
    const p = worldToScreen(x, y);
    ctx.fillStyle = "rgba(12, 14, 12, .3)";
    ctx.fillRect(p.x + 10, p.y + 12, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(p.x, p.y, w, h);
    ctx.fillStyle = "rgba(230, 212, 177, .12)";
    ctx.fillRect(p.x + 7, p.y + 8, w - 14, 7);
    ctx.strokeStyle = "rgba(227, 207, 169, .19)";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x + 1, p.y + 1, w - 2, h - 2);
    ctx.fillStyle = "rgba(17, 20, 18, .55)";
    ctx.font = "bold 10px Segoe UI";
    ctx.fillText(name, p.x + 12, p.y + 24);
  }

  function drawWorld() {
    const area = areas[game.area];
    ctx.fillStyle = area.color;
    ctx.fillRect(0, 0, W, H);
    const camera = game.camera;
    for (let y = -((camera.y % 80)); y < H; y += 80) {
      for (let x = -((camera.x % 80)); x < W; x += 80) {
        const gx = Math.floor((x + camera.x) / 80), gy = Math.floor((y + camera.y) / 80);
        const variation = ((gx * 17 + gy * 31) % 7 + 7) % 7;
        ctx.fillStyle = variation < 2 ? "rgba(14, 19, 15, .08)" : "rgba(225, 212, 177, .025)";
        ctx.fillRect(x, y, 80, 80);
      }
    }
    ctx.strokeStyle = "rgba(204, 190, 151, .13)";
    ctx.lineWidth = 2;
    for (let x = -camera.x % 280; x < W; x += 280) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 160, H); ctx.stroke();
    }
    if (game.area === 0) {
      building(110, 120, 270, 190, "ABANDONED WATCH POST");
      building(1390, 150, 280, 210, "OLD STABLES", "#45382e");
      building(720, 530, 330, 170, "TRADER'S HOUSE", "#4a4033");
      drawTrees();
    } else if (game.area === 1) {
      building(110, 120, 320, 200, "GARDEN HOUSE", "#384137");
      building(1370, 120, 310, 200, "ROYAL ORCHARD", "#394139");
      building(690, 550, 420, 210, "FOUNTAIN COURT", "#4a5147");
      drawTrees();
      drawFountain();
    } else if (game.area === 2) {
      building(130, 120, 410, 240, "WEST WING", "#4c4238");
      building(1260, 120, 410, 240, "EAST WING", "#4c4238");
      building(590, 570, 620, 330, "GREAT HALL", "#534639");
      drawColumns();
    } else {
      building(100, 120, 300, 250, "DUNGEON CELLS", "#302f2d");
      building(1400, 120, 300, 250, "OLD CRYPT", "#302f2d");
      building(630, 560, 540, 280, "GUARD ROOM", "#383431");
      drawBars();
    }
    drawGate();
    drawCells();
    drawKeys();
    drawGuards();
    drawPlayer();
    drawParticles();
    drawVignette();
  }

  function drawTrees() {
    for (let i = 0; i < 18; i++) {
      const x = (i * 263 + 115) % WORLD_W, y = (i * 179 + 80) % WORLD_H;
      const p = worldToScreen(x, y);
      if (p.x < -55 || p.x > W + 55 || p.y < -60 || p.y > H + 65) continue;
      ctx.fillStyle = "rgba(13, 19, 15, .4)";
      ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 13, 25, 10, 0, 0, Math.PI * 2); ctx.fill();
      const grad = ctx.createRadialGradient(p.x - 8, p.y - 9, 2, p.x, p.y, 29);
      grad.addColorStop(0, "#718066"); grad.addColorStop(1, "#304136");
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x, p.y, 25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#584b37"; ctx.fillRect(p.x - 3, p.y + 10, 6, 15);
    }
  }

  function drawFountain() {
    const p = worldToScreen(WORLD_W / 2, 650);
    ctx.fillStyle = "#55564e"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 88, 40, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#555e57"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 3, 74, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#637a79"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 5, 59, 22, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawColumns() {
    for (let i = 0; i < 8; i++) {
      const p = worldToScreen(130 + i * 220, 430);
      ctx.fillStyle = "#756650"; ctx.fillRect(p.x, p.y, 18, 190);
      ctx.fillStyle = "rgba(235, 218, 184, .17)"; ctx.fillRect(p.x + 3, p.y + 2, 4, 185);
      ctx.fillStyle = "#5d5141"; ctx.fillRect(p.x - 5, p.y - 5, 28, 9);
    }
  }

  function drawBars() {
    ctx.strokeStyle = "rgba(180, 174, 157, .55)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const p = worldToScreen(430 + i * 135, 145);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 175); ctx.stroke();
    }
  }

  function drawGate() {
    const p = worldToScreen(game.gate.x, game.gate.y);
    ctx.fillStyle = "#252724"; ctx.fillRect(p.x - 69, p.y - 14, 138, 62);
    ctx.strokeStyle = "#a28c68"; ctx.lineWidth = 5; ctx.strokeRect(p.x - 69, p.y - 14, 138, 62);
    for (let i = -2; i <= 2; i++) { ctx.fillStyle = "#8f7958"; ctx.fillRect(p.x + i * 22 - 2, p.y - 10, 4, 54); }
    ctx.fillStyle = "#dfc184"; ctx.beginPath(); ctx.arc(p.x, p.y + 15, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e7ddc8"; ctx.font = "bold 10px Segoe UI"; ctx.textAlign = "center"; ctx.fillText(game.gate.label, p.x, p.y - 24); ctx.textAlign = "left";
  }

  function drawCells() {
    const faces = ["#bb967c", "#8b6857", "#d1ad8e", "#a17d65"];
    for (const cell of game.cells) {
      if (cell.rescued) continue;
      const p = worldToScreen(cell.x, cell.y);
      if (p.x < -70 || p.x > W + 70 || p.y < -70 || p.y > H + 70) continue;
      ctx.fillStyle = "rgba(13, 16, 14, .5)"; ctx.fillRect(p.x - 31, p.y + 6, 62, 33);
      ctx.fillStyle = "#4c4b41"; ctx.fillRect(p.x - 29, p.y - 25, 58, 58);
      ctx.strokeStyle = "#8b7a5c"; ctx.lineWidth = 3; ctx.strokeRect(p.x - 29, p.y - 25, 58, 58);
      ctx.strokeStyle = "rgba(197, 189, 167, .55)"; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(p.x + i * 15, p.y - 24); ctx.lineTo(p.x + i * 15, p.y + 31); ctx.stroke(); }
      ctx.fillStyle = faces[cell.person]; ctx.beginPath(); ctx.arc(p.x, p.y - 3, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#cdb790"; ctx.fillRect(p.x - 9, p.y + 5, 18, 15);
      if (cell.locked) {
        ctx.fillStyle = "#d8b86f"; ctx.beginPath(); ctx.arc(p.x + 20, p.y + 17, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(p.x + 18, p.y + 17, 4, 10);
      } else {
        ctx.strokeStyle = "#8cbd9a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x + 13, p.y - 20); ctx.lineTo(p.x + 36, p.y - 7); ctx.stroke();
      }
      ctx.fillStyle = "#e4d7bf"; ctx.font = "bold 9px Segoe UI"; ctx.textAlign = "center";
      ctx.fillText(cell.locked ? "CAPTIVE · LOCKED" : "E · RESCUE", p.x, p.y - 39); ctx.textAlign = "left";
    }
  }

  function drawKeys() {
    for (const key of game.keys) {
      if (key.picked) continue;
      const p = worldToScreen(key.x, key.y);
      if (p.x < -25 || p.x > W + 25 || p.y < -25 || p.y > H + 25) continue;
      const bob = Math.sin(game.time * 3 + key.bob) * 3;
      ctx.fillStyle = "rgba(228, 193, 117, .16)"; ctx.beginPath(); ctx.arc(p.x, p.y + bob, 17, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#e4c175"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x - 4, p.y + bob - 3, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x + 1, p.y + bob + 1); ctx.lineTo(p.x + 9, p.y + bob + 9); ctx.lineTo(p.x + 13, p.y + bob + 5); ctx.stroke();
      ctx.fillStyle = "#f0dfb6"; ctx.font = "bold 8px Segoe UI"; ctx.textAlign = "center"; ctx.fillText("KEY", p.x, p.y + bob - 15); ctx.textAlign = "left";
    }
  }

  function drawPerson(entity, kind) {
    const p = worldToScreen(entity.x, entity.y);
    if (p.x < -65 || p.x > W + 65 || p.y < -65 || p.y > H + 65) return;
    const guard = kind === "guard", player = kind === "player";
    const r = guard ? entity.r : player ? 16 : 15;
    ctx.save();
    ctx.fillStyle = "rgba(11, 14, 12, .34)";
    ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 11, r * 1.12, r * .54, 0, 0, Math.PI * 2); ctx.fill();
    if (guard) {
      ctx.fillStyle = entity.flash > 0 ? "#f1debd" : entity.cloth;
      ctx.beginPath(); ctx.moveTo(p.x - r * .7, p.y - 1); ctx.lineTo(p.x + r * .7, p.y - 1); ctx.lineTo(p.x + r, p.y + r); ctx.lineTo(p.x - r, p.y + r); ctx.closePath(); ctx.fill();
      ctx.fillStyle = entity.armor === 0 ? "#77756c" : entity.armor === 1 ? "#74634d" : "#65594f";
      ctx.fillRect(p.x - r * .75, p.y - 1, r * 1.5, 8);
      ctx.fillStyle = entity.skin; ctx.beginPath(); ctx.arc(p.x, p.y - r * .56, r * .48, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#514a40"; ctx.beginPath(); ctx.arc(p.x, p.y - r * .72, r * .52, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#77766e"; ctx.fillRect(p.x - r - 3, p.y - 3, 5, 15);
      ctx.strokeStyle = "#c6c0ae"; ctx.lineWidth = 3; ctx.lineCap = "round";
      let swordAngle = entity.facing + .85;
      if (entity.attackTime > 0 && entity.attackStyle) {
        const progress = 1 - entity.attackTime / entity.attackStyle.duration;
        const style = entity.attackStyle;
        if (style.name === "QUICK SLASH") {
          swordAngle = progress < style.windup
            ? entity.facing + 1.8 - progress / style.windup * 2.9
            : progress < .76
              ? entity.facing - 1.1 + (progress - style.windup) / (.76 - style.windup) * 3.1
              : entity.facing + 2 - (progress - .76) / .24 * 1.15;
        } else if (style.name === "OVERHEAD STRIKE") {
          swordAngle = progress < style.windup
            ? entity.facing + 2.5 - progress / style.windup * 1.4
            : progress < .78
              ? entity.facing + 1.1 + (progress - style.windup) / (.78 - style.windup) * 2.4
              : entity.facing + 3.5 - (progress - .78) / .22 * 2.65;
        } else {
          const extension = progress < style.windup
            ? progress / style.windup
            : progress < .76
              ? 1 - (progress - style.windup) / (.76 - style.windup)
              : 0;
          swordAngle = entity.facing + .3 + extension * .2;
        }
      }
      ctx.beginPath(); ctx.moveTo(p.x + Math.cos(swordAngle) * 8, p.y + Math.sin(swordAngle) * 8); ctx.lineTo(p.x + Math.cos(swordAngle) * 24, p.y + Math.sin(swordAngle) * 24); ctx.stroke();
      if (entity.attackTime > 0 && entity.attackStyle) {
        const progress = 1 - entity.attackTime / entity.attackStyle.duration;
        ctx.strokeStyle = entity.attackStyle.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress / entity.attackStyle.windup));
        ctx.stroke();
      }
      if (entity.hp < entity.maxHp) {
        ctx.fillStyle = "rgba(8, 10, 9, .8)"; ctx.fillRect(p.x - 20, p.y - r - 16, 40, 4);
        ctx.fillStyle = "#bb765f"; ctx.fillRect(p.x - 20, p.y - r - 16, 40 * entity.hp / 100, 4);
      }
    } else {
      const p1 = player && input.left || player && input.right ? Math.sin(entity.walk) * 3 : 0;
      ctx.fillStyle = player ? "#292b2a" : "#6c5144";
      ctx.fillRect(p.x - 9, p.y + 6, 7, 10 + p1); ctx.fillRect(p.x + 2, p.y + 6, 7, 10 - p1);
      ctx.fillStyle = player ? "#373a38" : "#988069";
      ctx.beginPath(); ctx.moveTo(p.x - 12, p.y - 7); ctx.lineTo(p.x + 12, p.y - 7); ctx.lineTo(p.x + 10, p.y + 9); ctx.lineTo(p.x - 10, p.y + 9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = player ? "#262a29" : "#bb967c"; ctx.beginPath(); ctx.arc(p.x, p.y - 12, 7, 0, Math.PI * 2); ctx.fill();
      if (player) {
        ctx.fillStyle = "#242726"; ctx.beginPath(); ctx.moveTo(p.x - 8, p.y - 13); ctx.lineTo(p.x - 1, p.y - 22); ctx.lineTo(p.x + 7, p.y - 14); ctx.lineTo(p.x + 5, p.y - 7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#b8aa91"; ctx.fillRect(p.x - 9, p.y - 4, 18, 3);
        if (input.shield) {
          const sx = p.x + entity.dirX * 15 - entity.dirY * 8, sy = p.y + entity.dirY * 15 + entity.dirX * 8;
          ctx.fillStyle = "#737365"; ctx.beginPath(); ctx.moveTo(sx - 8, sy - 12); ctx.lineTo(sx + 8, sy - 10); ctx.lineTo(sx + 7, sy + 9); ctx.lineTo(sx, sy + 15); ctx.lineTo(sx - 7, sy + 9); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "#c3ac7e"; ctx.lineWidth = 2; ctx.stroke();
        }
        const a = Math.atan2(entity.dirY, entity.dirX);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
        ctx.strokeStyle = "#cbd0c7"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(5, 3); ctx.lineTo(entity.attacking ? 35 : 23, entity.attacking ? -13 : -4); ctx.stroke();
        ctx.strokeStyle = "#a88d60"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(2, -1); ctx.lineTo(10, 6); ctx.stroke();
        if (entity.attacking > 0) {
          ctx.strokeStyle = "rgba(230, 218, 188, .68)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 48, -.9, .9); ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawGuards() {
    for (const guard of game.guards) if (!guard.dead) drawPerson(guard, "guard");
  }
  function drawPlayer() { drawPerson(game.player, "player"); }
  function drawParticles() {
    for (const p of game.particles) {
      const pos = worldToScreen(p.x, p.y);
      ctx.globalAlpha = clamp(p.life * 2.5, 0, 1);
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * .24, W / 2, H / 2, W * .69);
    grad.addColorStop(0, "rgba(9, 12, 10, 0)");
    grad.addColorStop(1, "rgba(8, 11, 10, .43)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  }

  function render() { drawWorld(); }

  function frame(time) {
    const dt = Math.min((time - lastTime) / 1000 || 0, .04);
    lastTime = time;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  function setMove(key, value) { if (key in input) input[key] = value; }
  const keyDirections = { w: "up", arrowup: "up", s: "down", arrowdown: "down", a: "left", arrowleft: "left", d: "right", arrowright: "right" };
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (keyDirections[key]) { event.preventDefault(); setMove(keyDirections[key], true); }
    if (key === " " || key === "j") { event.preventDefault(); if (!event.repeat) attack(); }
    if (key === "q") input.shield = true;
    if (key === "shift" && !event.repeat) dodge();
    if (key === "e" && !event.repeat) useAction();
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (keyDirections[key]) setMove(keyDirections[key], false);
    if (key === "q") input.shield = false;
  });
  window.addEventListener("blur", () => { input.up = input.down = input.left = input.right = input.shield = false; });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 2) input.shield = true;
    else if (event.button === 0) attack();
  });
  window.addEventListener("pointerup", (event) => { if (event.button === 2) input.shield = false; });
  document.getElementById("start").addEventListener("click", startGame);
  document.getElementById("menu-toggle").addEventListener("click", (event) => {
    const menu = document.getElementById("game-menu");
    menu.hidden = !menu.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.getElementById("pause-game").addEventListener("click", pauseGame);
  document.getElementById("resume-game").addEventListener("click", resumeGame);
  document.getElementById("quit-game").addEventListener("click", quitGame);
  document.getElementById("pause-resume").addEventListener("click", resumeGame);
  document.getElementById("next-track").addEventListener("click", nextMusicTrack);
  ui.soundToggle.addEventListener("click", toggleSound);
  document.querySelectorAll("[data-move]").forEach((button) => {
    const key = button.dataset.move;
    button.addEventListener("pointerdown", (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); setMove(key, true); });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => button.addEventListener(name, () => setMove(key, false)));
  });
  document.getElementById("touch-attack").addEventListener("pointerdown", (event) => { event.preventDefault(); attack(); });
  document.getElementById("touch-use").addEventListener("pointerdown", (event) => { event.preventDefault(); useAction(); });
  document.getElementById("touch-shield").addEventListener("pointerdown", (event) => { event.preventDefault(); input.shield = true; });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => document.getElementById("touch-shield").addEventListener(name, () => { input.shield = false; }));
  document.getElementById("touch-dodge").addEventListener("pointerdown", (event) => { event.preventDefault(); dodge(); });

  updateMenuState();
  setupArea(0);
  requestAnimationFrame(frame);
})();
