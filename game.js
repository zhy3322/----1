const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNumber = document.getElementById('countdownNumber');
const resultOverlay = document.getElementById('resultOverlay');
const resultTitle = document.getElementById('resultTitle');
const statusText = document.getElementById('statusText');
const roundState = document.getElementById('roundState');
const playerCharge = document.getElementById('playerCharge');
const aiCharge = document.getElementById('aiCharge');
const playerChargeLabel = document.getElementById('playerChargeLabel');
const aiChargeLabel = document.getElementById('aiChargeLabel');
const totemProgress = document.getElementById('totemProgress');

const COLORS = { player: '#3AADFF', ai: '#FF59A1', ink: '#15151A', yellow: '#FFCA3A' };
const AI_SAFE_DISTANCE = 150;
const AI_PREFERRED_DISTANCE = 230;
const AI_MAX_DISTANCE = 330;
const LASER_MAX_LENGTH = 900;
const LASER_AIM_ACCURACY = 1;
const LASER_MAX_AIM_SPREAD = 0.18;
const PLAYER_BULLET_INTERVAL = 180;
const AI_BULLET_INTERVAL = 340;
const TOTEM_BULLET_HIT_THRESHOLD = 10;
const TOTEM_SIZE = 18;
const TOTEM_SPEED = 24;
const TOTEM_PICKUP_LIMIT = 2;
const REVIVE_INVULNERABILITY = 700;
const REVIVE_AI_WEAPON_DELAY = 1200;
const REVIVE_PLAYER_AI_LASER_DELAY = 7000;
const REVIVE_PARTICLE_LIMIT = 180;
const REVIVE_WAIT_DURATION = 3000;
const REVIVE_GATHER_DURATION = 2000;
const AWAKENING_DURATION = 7;
const AWAKENING_TIME_SCALE = .35;
const AWAKENING_COLORS = ['#F04F78', '#F28F3B', '#E7C34A', '#65C466', '#48B9D6', '#6575E8', '#A66AE8'];
const PIXEL_DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
const PIXEL_GLYPHS = {
  A: '010101111101101', B: '110101110101110', C: '111100100100111', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '111100101101111', I: '111010010010111',
  L: '100100100100111', M: '100111111101101', N: '110111111111101', O: '111101101101111',
  P: '110101110100100', R: '110101110101101', S: '111100111001111', V: '101101101101010',
  W: '101101111111101', Y: '101101010010010', ' ': '000000000000000',
  按: '111101111101111', 空: '101101111101101', 白: '111101111101111', 鍵: '101111101111101',
  再: '111001111100111', 來: '101111101111101', 一: '111111111111111', 場: '111101111101111'
};
const WEAPON_LOCK_DURATION = 800;
const BULLET_KNOCKBACK_X = 660;
const BULLET_KNOCKBACK_Y = 390;
const BULLET_SOUND_PATH = './assets/audio/bullet.MP3';
const LASER_SOUND_PATH = './assets/audio/laser.MP3';
const CHARGE_SOUND_PATH = './assets/audio/charge.MP3';
const COUNTDOWN_SOUND_PATH = './assets/audio/reciprocal.MP3';
const COUNTDOWN_COMPLETE_SOUND_PATH = './assets/audio/ding.MP3';
const GAME_OVER_SOUND_PATH = './assets/audio/gameover-final.MP3';
const VICTORY_SOUND_PATH = './assets/audio/victory.MP3';
const FIREWORKS_SOUND_PATH = './assets/audio/fireworks.MP3';
const keys = new Set();
const touchInput = { x: 0, y: 0, fire: false, laser: false };
const arena = { width: 0, height: 0, scale: 1 };
const game = { phase: 'countdown', countdown: 3, lastTime: 0, lastCountdownShown: 3, bullets: [], sparks: [], winner: null, crown: null, victoryPlayed: false, shakeTime: 0, shakeDuration: 0, shakePower: 0, resultTimer: null, bulletHits: 0, bulletHitTotal: 0, totem: null, revive: null, awakening: null, cinematic: null, darkening: null, totemPickups: { player: 0, ai: 0 } };
const bulletSoundPool = [];
const laserSoundPool = [];
const countdownSoundPool = [];
const countdownCompleteSoundPool = [];
const gameOverSoundPool = [];
const victorySoundPool = [];
const fireworksSoundPool = [];
const chargeSoundPool = [];
const fireworksSources = new Set();
let nextBulletSound = 0;
let nextLaserSound = 0;
let nextCountdownSound = 0;
let nextChargeSound = 0;
let nextFireworksSound = 0;
let fireworksAudioContext = null;
let fireworksAudioBuffer = null;
let fireworksAudioLoading = null;
let pendingFireworkLaunches = 0;
let gameOverAudioUnlocked = false;
let player;
let ai;

function createSoundPool(path, size, preload = 'auto') {
  return Array.from({ length: size }, () => {
    const audio = new Audio(path);
    audio.preload = preload;
    audio.addEventListener('error', () => {
      const mediaError = audio.error;
      console.error(`音效載入失敗：${path}`, {
        code: mediaError?.code ?? null,
        message: mediaError?.message ?? '未知媒體錯誤',
        readyState: audio.readyState,
        networkState: audio.networkState
      });
    }, { once: true });
    return audio;
  });
}

function playSound(pool, path, cursor) {
  if (!pool.length) {
    console.error(`音效播放失敗：${path} 沒有可用的音效播放器`);
    return cursor;
  }
  const audio = pool[cursor % pool.length];
  if (audio.muted || audio.volume === 0) {
    console.warn(`音效可能無法聽見：${path}`, { muted: audio.muted, volume: audio.volume });
  }
  audio.currentTime = 0;
  const playback = audio.play();
  if (playback) {
    playback.catch((error) => {
      console.error(`音效播放失敗：${path}`, {
        name: error?.name ?? 'UnknownError',
        message: error?.message ?? '未知播放錯誤',
        readyState: audio.readyState,
        networkState: audio.networkState,
        mediaError: audio.error?.message ?? null
      });
    });
  }
  return (cursor + 1) % pool.length;
}

function playBulletSound() {
  nextBulletSound = playSound(bulletSoundPool, BULLET_SOUND_PATH, nextBulletSound);
}

function playLaserSound() {
  nextLaserSound = playSound(laserSoundPool, LASER_SOUND_PATH, nextLaserSound);
}

function playCountdownSound() {
  nextCountdownSound = playSound(countdownSoundPool, COUNTDOWN_SOUND_PATH, nextCountdownSound);
}

function playCountdownCompleteSound() {
  playSound(countdownCompleteSoundPool, COUNTDOWN_COMPLETE_SOUND_PATH, 0);
}

function playGameOverSound() {
  playSound(gameOverSoundPool, GAME_OVER_SOUND_PATH, 0);
}

function playVictorySound() {
  playSound(victorySoundPool, VICTORY_SOUND_PATH, 0);
}

function playFireworksSound() {
  const playableAudio = fireworksSoundPool.find((audio) => audio.readyState >= 2 && !audio.error);
  if (playableAudio) {
    nextFireworksSound = playSound(fireworksSoundPool, FIREWORKS_SOUND_PATH, nextFireworksSound);
    return;
  }
  if (fireworksAudioBuffer && fireworksAudioContext) {
    startWebAudioFirework();
    return;
  }
  pendingFireworkLaunches += 1;
  prepareFireworksAudio();
}

function stopFireworksSounds() {
  fireworksSoundPool.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
  fireworksSources.forEach((source) => {
    try { source.stop(); } catch (error) { console.debug('煙火音效停止時來源已結束', error); }
  });
  fireworksSources.clear();
  pendingFireworkLaunches = 0;
  nextFireworksSound = 0;
}

function startWebAudioFirework() {
  if (!fireworksAudioContext || !fireworksAudioBuffer) return;
  const source = fireworksAudioContext.createBufferSource();
  source.buffer = fireworksAudioBuffer;
  source.connect(fireworksAudioContext.destination);
  fireworksSources.add(source);
  source.addEventListener('ended', () => fireworksSources.delete(source), { once: true });
  const resume = fireworksAudioContext.state === 'suspended' ? fireworksAudioContext.resume() : Promise.resolve();
  resume.then(() => source.start(0)).catch((error) => {
    fireworksSources.delete(source);
    console.error('Web Audio 煙火音效播放失敗', { name: error.name, message: error.message });
  });
}

function prepareFireworksAudio() {
  if (fireworksAudioLoading || fireworksAudioBuffer) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    console.error('煙火音效無法播放：瀏覽器不支援 Web Audio API');
    return;
  }
  fireworksAudioContext = fireworksAudioContext || new AudioContextClass();
  fireworksAudioLoading = fetch(FIREWORKS_SOUND_PATH)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => fireworksAudioContext.decodeAudioData(data))
    .then((buffer) => {
      fireworksAudioBuffer = buffer;
      console.info('煙火音效已成功解碼', { duration: buffer.duration, source: FIREWORKS_SOUND_PATH });
      const launchCount = pendingFireworkLaunches;
      pendingFireworkLaunches = 0;
      for (let index = 0; index < launchCount; index += 1) startWebAudioFirework();
    })
    .catch((error) => {
      console.error('煙火音效載入或解碼失敗', { name: error.name, message: error.message, source: FIREWORKS_SOUND_PATH });
    })
    .finally(() => {
      fireworksAudioLoading = null;
    });
}

function unlockGameOverSound() {
  if (gameOverAudioUnlocked || !gameOverSoundPool.length) return;
  gameOverAudioUnlocked = true;
  gameOverSoundPool.forEach((audio) => {
    audio.muted = true;
    const playback = audio.play();
    if (playback) playback.then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; }).catch(() => { audio.muted = false; gameOverAudioUnlocked = false; });
  });
}

bulletSoundPool.push(...createSoundPool(BULLET_SOUND_PATH, 6));
laserSoundPool.push(...createSoundPool(LASER_SOUND_PATH, 3));
countdownSoundPool.push(...createSoundPool(COUNTDOWN_SOUND_PATH, 3));
countdownCompleteSoundPool.push(...createSoundPool(COUNTDOWN_COMPLETE_SOUND_PATH, 1));
gameOverSoundPool.push(...createSoundPool(GAME_OVER_SOUND_PATH, 1));
victorySoundPool.push(...createSoundPool(VICTORY_SOUND_PATH, 1));
fireworksSoundPool.push(...createSoundPool(FIREWORKS_SOUND_PATH, 8, 'none'));
chargeSoundPool.push(...createSoundPool(CHARGE_SOUND_PATH, 2));
prepareFireworksAudio();

function playChargeSound(fighter) {
  if (fighter.chargeSound) return;
  const audio = chargeSoundPool[nextChargeSound % chargeSoundPool.length];
  nextChargeSound = (nextChargeSound + 1) % chargeSoundPool.length;
  fighter.chargeSound = audio;
  audio.currentTime = 0;
  const playback = audio.play();
  if (playback) playback.catch(() => console.warn(`音效播放失敗：${CHARGE_SOUND_PATH}`));
}

function stopChargeSound(fighter) {
  if (!fighter || !fighter.chargeSound) return;
  fighter.chargeSound.pause();
  fighter.chargeSound.currentTime = 0;
  fighter.chargeSound = null;
}

function makeFighter(x, y, color, isPlayer) {
  return { x, y, size: 38, color, isPlayer, speed: isPlayer ? 310 : 215, vx: 0, vy: 0, knockbackX: 0, knockbackY: 0, charging: false, chargeStarted: 0, chargeAim: null, chargeSound: null, lastShot: 0, weaponLockedUntil: 0, aiNextAction: 2.8, aiDecisionAt: 0, aiMoveX: 0, aiMoveY: 0, aiStrafe: 1, aiStrafeUntil: 0, aiLaserEvadeUntil: 0, aiLaserEvadeDirection: 1, aiLaserEvadeAngle: 0, aiLaserBlockedUntil: 0, observedX: x, observedY: y, observedVx: 0, observedVy: 0, observedConfidence: 0, observedTurn: 0, defeated: false, totemCharges: 0, invulnerableUntil: 0, reviveFlash: 0, revivePending: false };
}

function resetGame() {
  player = makeFighter(arena.width * 0.22, arena.height * 0.5, COLORS.player, true);
  ai = makeFighter(arena.width * 0.78, arena.height * 0.5, COLORS.ai, false);
  ai.aiNextAction = Infinity;
  if (game.resultTimer) clearTimeout(game.resultTimer);
  stopChargeSound(player); stopChargeSound(ai);
  stopFireworksSounds();
  game.phase = 'countdown'; game.countdown = 3; game.lastCountdownShown = 3; game.lastTime = performance.now(); game.bullets = []; game.sparks = []; game.winner = null; game.crown = null; game.victoryPlayed = false; game.shakeTime = 0; game.shakeDuration = 0; game.shakePower = 0; game.resultTimer = null; game.bulletHits = 0; game.bulletHitTotal = 0; game.totem = null; game.revive = null; game.awakening = null; game.cinematic = null; game.darkening = null; game.totemPickups = { player: 0, ai: 0 };
  countdownOverlay.classList.remove('hidden'); resultOverlay.classList.add('hidden'); resultOverlay.classList.remove('fade-in'); countdownNumber.textContent = '3';
  playCountdownSound();
  statusText.textContent = '準備開始'; roundState.textContent = 'READY';
  updateChargeUi();
  updateTotemUi();
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
  arena.width = rect.width; arena.height = rect.height; arena.scale = dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!player) resetGame();
  else { player.x = Math.min(player.x, arena.width - player.size); ai.x = Math.min(ai.x, arena.width - ai.size); player.y = Math.min(player.y, arena.height - player.size); ai.y = Math.min(ai.y, arena.height - ai.size); }
}

function getAimPoint(attacker, target) {
  return { x: target.x + target.size / 2, y: target.y + target.size / 2 };
}

function getWeaponAimPoint(attacker, target) {
  const origin = getAimPoint(attacker, attacker);
  const directTargetPoint = getAimPoint(attacker, target);
  const distance = Math.hypot(directTargetPoint.x - origin.x, directTargetPoint.y - origin.y);
  const leadTime = Math.min(.2, distance / 560);
  return {
    x: directTargetPoint.x + (target.vx + target.knockbackX) * leadTime,
    y: directTargetPoint.y + (target.vy + target.knockbackY) * leadTime
  };
}

function beginCharge(fighter, now) {
  if (now < fighter.weaponLockedUntil) return;
  if (!fighter.charging) {
    fighter.charging = true; fighter.chargeStarted = now; fighter.chargeAim = getAimPoint(fighter, fighter.isPlayer ? ai : player); fighter.chargeParticlesAt = now;
    playChargeSound(fighter);
  }
}

function moveChargeAim(fighter, dx, dy, dt) {
  if (!fighter.charging || !fighter.chargeAim) return;
  const aimSpeed = 260;
  fighter.chargeAim.x = Math.max(0, Math.min(arena.width, fighter.chargeAim.x + dx * aimSpeed * dt));
  fighter.chargeAim.y = Math.max(0, Math.min(arena.height, fighter.chargeAim.y + dy * aimSpeed * dt));
}

function releaseCharge(fighter, now) {
  if (!fighter.charging) return;
  const charged = now - fighter.chargeStarted >= 1000;
  if (charged && fighter.chargeAim) chargeCompression(fighter);
  stopChargeSound(fighter);
  if (charged && game.phase === 'playing' && now >= fighter.weaponLockedUntil) fireLaser(fighter, now);
  fighter.charging = false; fighter.chargeAim = null;
}

function cancelLaserCharge(fighter) {
  if (!fighter) return;
  stopChargeSound(fighter);
  fighter.charging = false;
  fighter.chargeStarted = 0;
  fighter.chargeAim = null;
  fighter.chargeParticlesAt = 0;
}

function chargeCompression(fighter) {
  const center = { x: fighter.x + fighter.size / 2, y: fighter.y + fighter.size / 2 };
  for (let index = 0; index < 12; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = fighter.size * (1.4 + Math.random() * .9);
    game.sparks.push({ type: 'charge-compress', x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius, targetX: center.x, targetY: center.y, vx: 0, vy: 0, size: 3 + Math.random() * 4, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 16, life: .16 + Math.random() * .08, maxLife: .24, filled: index % 2 === 0 });
  }
}

function fireLaser(fighter, now) {
  if (now < fighter.weaponLockedUntil) return false;
  const target = fighter.isPlayer ? ai : player;
  const origin = { x: fighter.x + fighter.size / 2, y: fighter.y + fighter.size / 2 };
  const aim = fighter.chargeAim || getAimPoint(fighter, target);
  const preciseAngle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  const spread = LASER_MAX_AIM_SPREAD * (1 - LASER_AIM_ACCURACY) / .6;
  const angle = preciseAngle + (Math.random() - .5) * spread * 2;
  const hit = target.invulnerableUntil <= now && rayHitsFighter(origin, angle, target);
  const targetDistance = Math.hypot(aim.x - origin.x, aim.y - origin.y);
  const length = Math.min(LASER_MAX_LENGTH, Math.max(70, targetDistance + target.size * .35));
  playLaserSound();
  game.sparks.push({ type: 'laser', x: origin.x, y: origin.y, angle, length, life: .22, maxLife: .22, color: '#000000' });
  game.sparks.push({ type: 'laser-afterimage', x: origin.x, y: origin.y, angle, length, life: .65, maxLife: .65, color: '#000000' });
  laserPathBurst(origin, angle, length);
  laserWaveBurst(origin, angle, length);
  laserSpeedLines(origin, angle, length);
  const impact = hit ? { x: target.x + target.size / 2, y: target.y + target.size / 2 } : { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
  laserImpactBurst(impact.x, impact.y, angle, hit);
  game.shakeTime = .42; game.shakeDuration = .42; game.shakePower = 17;
  if (hit) {
    const lethal = target.totemCharges <= 0;
    if (lethal && fighter.totemCharges > 0 && !fighter.defeated) {
      beginFatalLaserCinematic(fighter, target, origin, angle, length, impact, now);
    } else if (target.totemCharges > 0) {
      beginFighterRevive(target, now);
    } else {
      endGame(fighter.isPlayer ? 'PLAYER' : 'AI', fighter);
    }
  }
  return true;
}

function beginFatalLaserCinematic(fighter, target, origin, angle, length, impact, now) {
  if (game.phase !== 'playing' || game.cinematic) return;
  game.phase = 'cinematic';
  game.cinematic = { attacker: fighter, target, winner: fighter.isPlayer ? 'PLAYER' : 'AI', startedAt: now, endsAt: now + AWAKENING_DURATION, origin, angle, length, impact };
  stopChargeSound(player); stopChargeSound(ai);
  fighter.charging = false; fighter.chargeAim = null;
  game.bullets = [];
  createAwakeningEffect(fighter, origin, angle, length, impact, now);
  statusText.textContent = '神秘力量覺醒';
  roundState.textContent = 'FINISHER';
  game.shakeTime = .7; game.shakeDuration = .7; game.shakePower = 20;
}

function updateCinematic(now) {
  if (!game.cinematic || game.phase !== 'cinematic' || now < game.cinematic.endsAt) return;
  const { target, winner, attacker } = game.cinematic;
  game.cinematic = null;
  game.awakening = null;
  finisherBurst(target.x + target.size / 2, target.y + target.size / 2, target);
  endGame(winner, attacker);
}

function createAwakeningEffect(fighter, origin, angle, length, impact, now) {
  if (game.awakening) return;
  game.awakening = { fighter, origin, angle, length, impact, startedAt: now, until: now + AWAKENING_DURATION };
  const normalX = -Math.sin(angle);
  const normalY = Math.cos(angle);
  for (let index = 0; index < 76; index += 1) {
    const distance = 18 + Math.random() * Math.max(24, length - 24);
    const phase = Math.random() * Math.PI * 2;
    game.sparks.push({ type: 'awakening-spiral', originX: origin.x, originY: origin.y, angle, normalX, normalY, distance, phase, phaseSpeed: 5 + Math.random() * 7, radius: 8 + Math.random() * 15, size: 2 + Math.random() * 5, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 18, life: AWAKENING_DURATION, maxLife: AWAKENING_DURATION, filled: index % 3 !== 0 });
  }
  for (let side = -1; side <= 1; side += 2) {
    for (let index = 0; index < 36; index += 1) {
      game.sparks.push({ type: 'awakening-rainbow', originX: origin.x, originY: origin.y, angle, normalX, normalY, distance: 12 + index / 35 * length, side, phase: Math.random() * Math.PI * 2, phaseSpeed: 3 + Math.random() * 5, size: 2 + Math.random() * 3, color: AWAKENING_COLORS[index % AWAKENING_COLORS.length], life: AWAKENING_DURATION, maxLife: AWAKENING_DURATION });
    }
  }
  const centerX = fighter.x + fighter.size / 2;
  const centerY = fighter.y + fighter.size / 2;
  for (let layer = 0; layer < 3; layer += 1) {
    for (let index = 0; index < 18; index += 1) {
      const radius = 30 + layer * 18 + Math.random() * 18;
      game.sparks.push({ type: 'awakening-vortex', x: centerX, y: centerY, radius, angle: index / 18 * Math.PI * 2, angularSpeed: (layer % 2 ? -1 : 1) * (2.2 + Math.random() * 2.8), size: 3 + Math.random() * 5, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 16, filled: index % 3 !== 0, life: AWAKENING_DURATION, maxLife: AWAKENING_DURATION });
    }
  }
  for (let index = 0; index < 5; index += 1) {
    game.sparks.push({ type: 'awakening-sigil', x: centerX, y: centerY, radius: 30 + index * 14, rotation: index * .5, spin: (index % 2 ? -1 : 1) * (1.2 + index * .25), lineWidth: 1 + index % 2, life: AWAKENING_DURATION, maxLife: AWAKENING_DURATION });
  }
  for (let index = 0; index < 46; index += 1) {
    game.sparks.push({ type: 'awakening-disk', x: centerX, y: centerY, radiusX: 42 + Math.random() * 46, radiusY: 10 + Math.random() * 18, angle: Math.random() * Math.PI * 2, angularSpeed: (Math.random() > .5 ? 1 : -1) * (1.8 + Math.random() * 3), size: 2 + Math.random() * 4, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 13, filled: index % 4 !== 0, life: AWAKENING_DURATION, maxLife: AWAKENING_DURATION });
  }
  for (let index = 0; index < 34; index += 1) {
    const distance = 18 + Math.random() * Math.max(24, length - 24);
    game.sparks.push({ type: 'awakening-time-shard', originX: origin.x, originY: origin.y, angle, distance, normalX, normalY, offset: (Math.random() - .5) * 34, size: 3 + Math.random() * 6, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 12, phase: Math.random() * Math.PI * 2, life: AWAKENING_DURATION, maxLife: AWAKENING_DURATION, filled: index % 2 === 0 });
  }
  game.sparks.push({ type: 'awakening-wave', x: origin.x, y: origin.y, radius: fighter.size * .7, growth: 160, lineWidth: 3, life: .7, maxLife: .7 });
}

function updateAwakening(now) {
  if (game.awakening && now >= game.awakening.until) game.awakening = null;
}

function laserPathBurst(origin, angle, length) {
  const particleCount = Math.max(8, Math.floor(length / 32));
  for (let index = 0; index < particleCount; index += 1) {
    const distance = index * length / particleCount + (Math.random() - .5) * 14;
    game.sparks.push({ type: 'laser-trail', x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance, vx: (Math.random() - .5) * 35, vy: (Math.random() - .5) * 35, size: 4 + Math.random() * 5, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 8, life: .32 + Math.random() * .2, maxLife: .52, filled: index % 2 === 0 });
  }
}

function laserWaveBurst(origin, angle, length) {
  const particleCount = Math.max(15, Math.floor(length / 38));
  for (let index = 0; index < particleCount; index += 1) {
    const side = index % 2 === 0 ? 1 : -1;
    const distance = 12 + (index / particleCount) * length + Math.random() * 18;
    game.sparks.push({ type: 'laser-wave', x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance, vx: 0, vy: 0, angle, side, size: 4 + Math.random() * 5, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 9, life: .45 + Math.random() * .22, maxLife: .67, expand: 1 + Math.random() * 2.5, filled: index % 3 === 0 });
  }
}

function laserSpeedLines(origin, angle, length) {
  for (let index = 0; index < 7; index += 1) {
    const distance = 20 + Math.random() * Math.max(30, length - 35);
    game.sparks.push({ type: 'laser-speed', x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance, angle, length: 10 + Math.random() * 22, life: .18 + Math.random() * .12, maxLife: .3 });
  }
}

function laserImpactBurst(x, y, angle, hit) {
  for (let index = 0; index < 4; index += 1) {
    game.sparks.push({ type: 'laser-impact-wave', x, y, radius: 8 + index * 7, growth: 180 + index * 80, life: .28 + index * .06, maxLife: .52 + index * .06, lineWidth: 2 + index % 2 });
  }
  for (let index = 0; index < (hit ? 42 : 18); index += 1) {
    const particleAngle = Math.random() * Math.PI * 2;
    const speed = 170 + Math.random() * (hit ? 330 : 180);
    game.sparks.push({ type: 'laser-impact-square', x, y, vx: Math.cos(particleAngle) * speed, vy: Math.sin(particleAngle) * speed, size: 3 + Math.random() * 7, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 16, life: .45 + Math.random() * .55, maxLife: 1, filled: index % 3 === 0 });
  }
  if (!hit) {
    for (let index = 0; index < 5; index += 1) {
      const crackAngle = angle + (Math.random() - .5) * Math.PI * .85;
      game.sparks.push({ type: 'laser-crack', x, y, angle: crackAngle, length: 14 + Math.random() * 25, life: .4 + Math.random() * .18, maxLife: .58 });
    }
  }
}

function chargeBurst(fighter, now) {
  const progress = Math.min(1, (now - fighter.chargeStarted) / 1000);
  const center = { x: fighter.x + fighter.size / 2, y: fighter.y + fighter.size / 2 };
  if (now - fighter.chargeParticlesAt < 62) return;
  fighter.chargeParticlesAt = now;
  for (let index = 0; index < 4; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = fighter.size * (2 + Math.random() * 2.2);
    game.sparks.push({ type: 'charge-inward', x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius, targetX: center.x, targetY: center.y, pull: 330 + progress * 300, vx: 0, vy: 0, size: 3 + Math.random() * 5, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 12, life: .5, maxLife: .5, filled: index % 2 === 0 });
  }
  game.sparks.push({ type: 'charge-ring', x: center.x, y: center.y, radius: fighter.size * (1.1 + progress * .5), rotation: Math.random() * Math.PI, spin: indexDirection(indexSeed()), lineWidth: 1.5 + progress * 1.5, life: .3, maxLife: .3 });
  game.sparks.push({ type: 'charge-warp', x: center.x, y: center.y, radius: fighter.size * (1.3 + progress * .6), rotation: 0, spin: -2.5, life: .24, maxLife: .24, strength: progress });
}

function indexSeed() { return Math.random() > .5 ? 1 : -1; }
function indexDirection(value) { return value * (1.5 + Math.random() * 2); }

function rayHitsFighter(origin, angle, target) {
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const center = { x: target.x + target.size / 2, y: target.y + target.size / 2 };
  const projection = (center.x - origin.x) * direction.x + (center.y - origin.y) * direction.y;
  const closestX = origin.x + direction.x * projection; const closestY = origin.y + direction.y * projection;
  const distanceToRay = Math.hypot(center.x - closestX, center.y - closestY);
  if (projection > 0 && distanceToRay < target.size * .72) return { distance: projection };
  return null;
}

function fireBullet(fighter, now) {
  const target = fighter.isPlayer ? ai : player;
  const origin = { x: fighter.x + fighter.size / 2, y: fighter.y + fighter.size / 2 };
  const targetPoint = getWeaponAimPoint(fighter, target);
  const bulletSpeed = 560;
  const angle = Math.atan2(targetPoint.y - origin.y, targetPoint.x - origin.x);
  game.bullets.push({ x: origin.x, y: origin.y, vx: Math.cos(angle) * bulletSpeed, vy: Math.sin(angle) * bulletSpeed, owner: fighter.isPlayer ? 'player' : 'ai', life: 2.5 });
  playBulletSound();
  fighter.lastShot = now;
}

function moveFighter(fighter, dx, dy, dt) {
  const length = Math.hypot(dx, dy) || 1;
  const acceleration = 1450;
  const friction = Math.pow(.08, dt);
  const movementScale = fighter.revivePending || fighter.reviveSupportMovement ? .5 : fighter.charging ? .7 : 1;
  const maxSpeed = fighter.speed * movementScale;
  fighter.vx += (dx / length) * acceleration * dt;
  fighter.vy += (dy / length) * acceleration * dt;
  const velocity = Math.hypot(fighter.vx, fighter.vy);
  if (velocity > maxSpeed) { fighter.vx = fighter.vx / velocity * maxSpeed; fighter.vy = fighter.vy / velocity * maxSpeed; }
  fighter.vx *= friction; fighter.vy *= friction;
  fighter.x += fighter.vx * dt + fighter.knockbackX * dt;
  fighter.y += fighter.vy * dt + fighter.knockbackY * dt;
  fighter.knockbackX *= Math.pow(.001, dt); fighter.knockbackY *= Math.pow(.001, dt);
  fighter.x = Math.max(14, Math.min(arena.width - fighter.size - 14, fighter.x)); fighter.y = Math.max(14, Math.min(arena.height - fighter.size - 14, fighter.y));
}

function updatePlayer(dt, now) {
  let dx = touchInput.x; let dy = touchInput.y;
  if (keys.has('w')) dy -= 1; if (keys.has('s')) dy += 1; if (keys.has('a')) dx -= 1; if (keys.has('d')) dx += 1;
  moveFighter(player, dx, dy, dt);
  updatePlayerMotionObservation(dt);
  if ((keys.has('j') || touchInput.fire) && !player.charging && now >= player.weaponLockedUntil && now - player.lastShot >= PLAYER_BULLET_INTERVAL) fireBullet(player, now);
  if (keys.has('k') || touchInput.laser) beginCharge(player, now);
  moveChargeAim(player, dx, dy, dt);
  if (!keys.has('k') && !touchInput.laser) releaseCharge(player, now);
}

function updatePlayerMotionObservation(dt) {
  if (!player || dt <= 0) return;
  const previousVx = player.observedVx;
  const previousVy = player.observedVy;
  const measuredVx = (player.x - player.observedX) / dt;
  const measuredVy = (player.y - player.observedY) / dt;
  player.observedX = player.x;
  player.observedY = player.y;
  player.observedVx = player.observedVx * .62 + measuredVx * .38;
  player.observedVy = player.observedVy * .62 + measuredVy * .38;
  const previousSpeed = Math.hypot(previousVx, previousVy);
  const currentSpeed = Math.hypot(player.observedVx, player.observedVy);
  if (previousSpeed > 35 && currentSpeed > 35) {
    const alignment = (previousVx * player.observedVx + previousVy * player.observedVy) / (previousSpeed * currentSpeed);
    player.observedTurn = player.observedTurn * .7 + (1 - Math.max(-1, Math.min(1, alignment))) * .3;
  } else {
    player.observedTurn *= .82;
  }
  const movementSignal = Math.min(1, currentSpeed / player.speed);
  player.observedConfidence = Math.min(1, player.observedConfidence * .92 + movementSignal * .08);
}

function getAiPredictedPoint(target, leadTime) {
  const confidence = target.observedConfidence || 0;
  const velocityX = target.observedVx || target.vx + target.knockbackX;
  const velocityY = target.observedVy || target.vy + target.knockbackY;
  const turnDamping = Math.max(.35, 1 - (target.observedTurn || 0) * .65);
  const predictionTime = leadTime * (.35 + confidence * .65) * turnDamping;
  const predictedX = target.x + target.size / 2 + velocityX * predictionTime;
  const predictedY = target.y + target.size / 2 + velocityY * predictionTime;
  return {
    x: Math.max(target.size / 2 + 14, Math.min(arena.width - target.size / 2 - 14, predictedX)),
    y: Math.max(target.size / 2 + 14, Math.min(arena.height - target.size / 2 - 14, predictedY))
  };
}

function getAiIncomingThreat(fighter, now) {
  const centerX = fighter.x + fighter.size / 2;
  const centerY = fighter.y + fighter.size / 2;
  let strongest = null;
  game.bullets.forEach((bullet) => {
    if (bullet.owner === 'ai') return;
    const dx = centerX - bullet.x;
    const dy = centerY - bullet.y;
    const speedSquared = bullet.vx * bullet.vx + bullet.vy * bullet.vy;
    if (!speedSquared) return;
    const time = (dx * bullet.vx + dy * bullet.vy) / speedSquared;
    if (time < 0 || time > .85) return;
    const closestX = bullet.x + bullet.vx * time;
    const closestY = bullet.y + bullet.vy * time;
    const distance = Math.hypot(centerX - closestX, centerY - closestY);
    if (distance < fighter.size * 1.6 && (!strongest || time < strongest.time)) strongest = { bullet, time, distance };
  });
  return strongest;
}

function getAiLaserThreat(fighter, now) {
  const centerX = fighter.x + fighter.size / 2;
  const centerY = fighter.y + fighter.size / 2;
  let strongest = null;
  const considerRay = (origin, angle, length, timeToFire, source) => {
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const projection = (centerX - origin.x) * directionX + (centerY - origin.y) * directionY;
    if (projection <= 0 || projection > length) return;
    const closestX = origin.x + directionX * projection;
    const closestY = origin.y + directionY * projection;
    const distance = Math.hypot(centerX - closestX, centerY - closestY);
    const dangerRadius = fighter.size * (source === 'charge' ? .95 : .8);
    if (distance > dangerRadius) return;
    const threat = { angle, distance, timeToFire, source };
    if (!strongest || threat.timeToFire < strongest.timeToFire || (threat.timeToFire === strongest.timeToFire && threat.distance < strongest.distance)) strongest = threat;
  };

  if (player.charging && player.chargeAim) {
    const origin = { x: player.x + player.size / 2, y: player.y + player.size / 2 };
    const angle = Math.atan2(player.chargeAim.y - origin.y, player.chargeAim.x - origin.x);
    const aimDistance = Math.hypot(player.chargeAim.x - origin.x, player.chargeAim.y - origin.y);
    const chargeElapsed = now - player.chargeStarted;
    considerRay(origin, angle, Math.min(LASER_MAX_LENGTH, Math.max(70, aimDistance + player.size * .35)), Math.max(0, 1000 - chargeElapsed), 'charge');
  }

  game.sparks.forEach((spark) => {
    if (spark.type !== 'laser' || spark.life <= 0) return;
    considerRay({ x: spark.x, y: spark.y }, spark.angle, spark.length, 0, 'fired');
  });
  return strongest;
}

function updateAiDecision(now, distanceToPlayer, horizontalGap, verticalGap) {
  const threat = getAiIncomingThreat(ai, now);
  const laserThreat = getAiLaserThreat(ai, now);
  const margin = 54;
  const nearLeft = ai.x < margin;
  const nearRight = ai.x > arena.width - ai.size - margin;
  const nearTop = ai.y < margin;
  const nearBottom = ai.y > arena.height - ai.size - margin;
  let dx = 0;
  let dy = 0;
  if (laserThreat) {
    const perpendicularX = -Math.sin(laserThreat.angle);
    const perpendicularY = Math.cos(laserThreat.angle);
    let evadeDirection = ai.aiLaserEvadeDirection || ai.aiStrafe;
    const clearance = 42;
    const candidateX = ai.x + perpendicularX * evadeDirection * clearance;
    const candidateY = ai.y + perpendicularY * evadeDirection * clearance;
    if (candidateX < margin || candidateX > arena.width - ai.size - margin || candidateY < margin || candidateY > arena.height - ai.size - margin) evadeDirection *= -1;
    if (player.vx * perpendicularX + player.vy * perpendicularY > 25) evadeDirection *= -1;
    dx = perpendicularX * evadeDirection;
    dy = perpendicularY * evadeDirection;
    if (nearLeft) dx += 1.2;
    if (nearRight) dx -= 1.2;
    if (nearTop) dy += 1.2;
    if (nearBottom) dy -= 1.2;
    ai.aiStrafe = evadeDirection;
    ai.aiLaserEvadeDirection = evadeDirection;
    ai.aiLaserEvadeAngle = laserThreat.angle;
    ai.aiLaserEvadeUntil = now + (laserThreat.source === 'charge' ? 380 : 260);
  } else if (now < ai.aiLaserEvadeUntil) {
    const perpendicularX = -Math.sin(ai.aiLaserEvadeAngle);
    const perpendicularY = Math.cos(ai.aiLaserEvadeAngle);
    dx = perpendicularX * ai.aiLaserEvadeDirection;
    dy = perpendicularY * ai.aiLaserEvadeDirection;
    if (nearLeft) dx += 1.2;
    if (nearRight) dx -= 1.2;
    if (nearTop) dy += 1.2;
    if (nearBottom) dy -= 1.2;
  } else if (threat) {
    const bullet = threat.bullet;
    const side = bullet.vx * verticalGap - bullet.vy * horizontalGap;
    const evadeDirection = side >= 0 ? -1 : 1;
    dx = Math.sign(-bullet.vy) * evadeDirection;
    dy = Math.sign(bullet.vx) * evadeDirection;
    if (!dx && !dy) dx = evadeDirection;
  } else if (game.totem && ai.totemCharges < TOTEM_PICKUP_LIMIT && game.totemPickups.ai < TOTEM_PICKUP_LIMIT) {
    dx = Math.sign(game.totem.x + TOTEM_SIZE / 2 - (ai.x + ai.size / 2));
    dy = Math.sign(game.totem.y + TOTEM_SIZE / 2 - (ai.y + ai.size / 2));
  } else if (distanceToPlayer < AI_SAFE_DISTANCE) {
    dx = -Math.sign(horizontalGap);
    dy = -Math.sign(verticalGap);
  } else if (distanceToPlayer > AI_MAX_DISTANCE) {
    dx = Math.sign(horizontalGap);
    dy = Math.sign(verticalGap);
  } else {
    if (now >= ai.aiStrafeUntil) {
      ai.aiStrafe = Math.random() < .5 ? -1 : 1;
      ai.aiStrafeUntil = now + 900 + Math.random() * 900;
    }
    dx = -Math.sign(verticalGap) * ai.aiStrafe;
    dy = Math.sign(horizontalGap) * ai.aiStrafe;
    if (player.charging) {
      dx += -Math.sign(horizontalGap) * .35;
      dy += -Math.sign(verticalGap) * .35;
    }
  }
  if (nearLeft) dx += 1;
  if (nearRight) dx -= 1;
  if (nearTop) dy += 1;
  if (nearBottom) dy -= 1;
  const length = Math.hypot(dx, dy) || 1;
  ai.aiMoveX = dx / length;
  ai.aiMoveY = dy / length;
}

function updateAi(dt, now) {
  const horizontalGap = player.x - ai.x; const verticalGap = player.y - ai.y;
  const distanceToPlayer = Math.hypot(horizontalGap, verticalGap);
  let firedLaser = false;
  if (now >= ai.aiDecisionAt) {
    ai.aiDecisionAt = now + 110 + Math.random() * 90;
    updateAiDecision(now, distanceToPlayer, horizontalGap, verticalGap);
  }
  moveFighter(ai, ai.aiMoveX, ai.aiMoveY, dt);
  const leadTime = Math.min(.32, Math.max(.08, distanceToPlayer / 700));
  const predictedPoint = getAiPredictedPoint(player, leadTime);
  const laserBlocked = now < ai.aiLaserBlockedUntil;
  if (laserBlocked && ai.charging) cancelLaserCharge(ai);
  if (!laserBlocked && now > ai.aiNextAction && !ai.charging && !player.revivePending) {
    beginCharge(ai, now);
    if (ai.charging) ai.chargeAim = predictedPoint;
  }
  if (ai.charging) ai.chargeAim = predictedPoint;
  if (!laserBlocked && ai.charging && now - ai.chargeStarted >= 1000) { chargeCompression(ai); firedLaser = fireLaser(ai, now); ai.charging = false; ai.chargeAim = null; ai.aiNextAction = now + 3000; }
  if (!ai.charging && !firedLaser && now >= ai.weaponLockedUntil && now - ai.lastShot >= AI_BULLET_INTERVAL) fireBullet(ai, now);
}

function updateBullets(dt, now) {
  const survivingBullets = [];
  const destroyedBullets = new Set();
  game.bullets.forEach((bullet, bulletIndex) => {
    bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt;
    if (bullet.life <= 0 || bullet.x <= -20 || bullet.x >= arena.width + 20 || bullet.y <= -20 || bullet.y >= arena.height + 20) { destroyedBullets.add(bulletIndex); return; }
    const target = bullet.owner === 'player' ? ai : player;
    if (target.defeated || target.revivePending) { destroyedBullets.add(bulletIndex); return; }
    if (bullet.x > target.x && bullet.x < target.x + target.size && bullet.y > target.y && bullet.y < target.y + target.size) {
      const direction = Math.sign(bullet.vx) || 1; target.knockbackX = direction * BULLET_KNOCKBACK_X; target.knockbackY = Math.sign(bullet.vy) * BULLET_KNOCKBACK_Y; target.weaponLockedUntil = now + WEAPON_LOCK_DURATION; burst(bullet.x, bullet.y, target.color); stopChargeSound(target); target.charging = false; target.chargeAim = null;
      if (!game.totem) {
        game.bulletHits += 1;
        game.bulletHitTotal += 1;
        if (game.bulletHits >= TOTEM_BULLET_HIT_THRESHOLD) { game.bulletHits = 0; spawnTotem(); }
        updateTotemUi();
      }
      destroyedBullets.add(bulletIndex); return;
    }
    for (let otherIndex = bulletIndex + 1; otherIndex < game.bullets.length; otherIndex += 1) {
      const other = game.bullets[otherIndex];
      if (other.owner !== bullet.owner && !destroyedBullets.has(otherIndex) && Math.hypot(bullet.x - other.x, bullet.y - other.y) <= 10) {
        destroyedBullets.add(bulletIndex); destroyedBullets.add(otherIndex); bulletClashBurst((bullet.x + other.x) / 2, (bullet.y + other.y) / 2); break;
      }
    }
    if (!destroyedBullets.has(bulletIndex)) survivingBullets.push(bullet);
  });
  game.bullets = survivingBullets.filter((bullet) => !destroyedBullets.has(game.bullets.indexOf(bullet)));
}

function spawnTotem() {
  if (game.totem || game.totemPickups.player + game.totemPickups.ai >= TOTEM_PICKUP_LIMIT * 2) return;
  const padding = 30;
  const angle = Math.random() * Math.PI * 2;
  game.totem = {
    x: padding + Math.random() * Math.max(1, arena.width - padding * 2 - TOTEM_SIZE),
    y: padding + Math.random() * Math.max(1, arena.height - padding * 2 - TOTEM_SIZE),
    vx: Math.cos(angle) * TOTEM_SPEED,
    vy: Math.sin(angle) * TOTEM_SPEED,
    particleAt: 0
  };
  for (let index = 0; index < 14; index += 1) addTotemParticle();
  updateTotemUi();
}

function addTotemParticle() {
  if (!game.totem) return;
  const angle = Math.random() * Math.PI * 2;
  const radius = TOTEM_SIZE * (1.3 + Math.random() * 1.5);
  game.sparks.push({
    type: 'totem-inward',
    x: game.totem.x + TOTEM_SIZE / 2 + Math.cos(angle) * radius,
    y: game.totem.y + TOTEM_SIZE / 2 + Math.sin(angle) * radius,
    targetX: game.totem.x + TOTEM_SIZE / 2,
    targetY: game.totem.y + TOTEM_SIZE / 2,
    pull: 70 + Math.random() * 50,
    size: 2 + Math.random() * 3,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - .5) * 7,
    life: .8,
    maxLife: .8,
    filled: Math.random() > .35
  });
}

function updateTotem(dt, now) {
  if (!game.totem) return;
  const totem = game.totem;
  totem.x += totem.vx * dt;
  totem.y += totem.vy * dt;
  if (totem.x <= 20 || totem.x >= arena.width - TOTEM_SIZE - 20) { totem.vx *= -1; totem.x = Math.max(20, Math.min(arena.width - TOTEM_SIZE - 20, totem.x)); }
  if (totem.y <= 20 || totem.y >= arena.height - TOTEM_SIZE - 20) { totem.vy *= -1; totem.y = Math.max(20, Math.min(arena.height - TOTEM_SIZE - 20, totem.y)); }
  if (now - totem.particleAt >= 90) { totem.particleAt = now; addTotemParticle(); }
  [player, ai].some((fighter) => {
    const pickupKey = fighter.isPlayer ? 'player' : 'ai';
    if (fighter.defeated || game.totemPickups[pickupKey] >= TOTEM_PICKUP_LIMIT || fighter.x + fighter.size < totem.x || fighter.x > totem.x + TOTEM_SIZE || fighter.y + fighter.size < totem.y || fighter.y > totem.y + TOTEM_SIZE) return false;
    game.totemPickups[pickupKey] += 1;
    fighter.totemCharges += 1;
    game.totem = null;
    totemPickupBurst(fighter);
    updateTotemUi();
    return true;
  });
}

function totemPickupBurst(fighter) {
    const centerX = fighter.x + fighter.size / 2;
    const centerY = fighter.y + fighter.size / 2;
    for (let index = 0; index < 76; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 320;
      const orbit = 10 + Math.random() * 25;
      game.sparks.push({ type: 'totem-collect', x: centerX + Math.cos(angle) * orbit, y: centerY + Math.sin(angle) * orbit, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 2 + Math.random() * 6, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 24, life: .65 + Math.random() * .65, maxLife: 1.3, filled: index % 3 !== 0, colorShift: index % 4 === 0 });
    }
    for (let index = 0; index < 18; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 130;
      game.sparks.push({ type: 'totem-collect-ring', x: centerX, y: centerY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 7 + Math.random() * 10, growth: 80 + Math.random() * 100, rotation: angle, spin: (Math.random() - .5) * 12, lineWidth: 1 + Math.random() * 2, life: .45 + Math.random() * .35, maxLife: .8 });
    }
    game.shakeTime = .16; game.shakeDuration = .16; game.shakePower = 7;
}

function updateTotemUi() {
  if (!totemProgress) return;
  const totalPickups = game.totemPickups.player + game.totemPickups.ai;
  if (totalPickups >= TOTEM_PICKUP_LIMIT * 2) {
    totemProgress.textContent = '圖騰生成上限已達';
  } else if (game.totem) {
    totemProgress.textContent = '圖騰已生成，快去拾取';
  } else {
    const remaining = TOTEM_BULLET_HIT_THRESHOLD - game.bulletHits;
    totemProgress.textContent = `圖騰還需 ${remaining} 顆砲彈`;
  }
}

function isSafeSpawn(x, y, fighter) {
  const margin = 22;
  if (x < margin || y < margin || x > arena.width - fighter.size - margin || y > arena.height - fighter.size - margin) return false;
  const opponent = fighter === player ? ai : player;
  if (opponent && !opponent.defeated && Math.hypot(x - opponent.x, y - opponent.y) < fighter.size * 3.5) return false;
  if (game.totem && Math.hypot(x - game.totem.x, y - game.totem.y) < fighter.size * 1.5) return false;
  return true;
}

function findSafeSpawn(fighter, oldX, oldY) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = 22 + Math.random() * Math.max(1, arena.width - fighter.size - 44);
    const y = 22 + Math.random() * Math.max(1, arena.height - fighter.size - 44);
    if (isSafeSpawn(x, y, fighter)) return { x, y };
  }
  const fallbackX = Math.max(22, Math.min(arena.width - fighter.size - 22, oldX));
  const fallbackY = Math.max(22, Math.min(arena.height - fighter.size - 22, oldY));
  return isSafeSpawn(fallbackX, fallbackY, fighter)
    ? { x: fallbackX, y: fallbackY }
    : { x: Math.max(22, arena.width * .25), y: Math.max(22, arena.height * .5) };
}

function pushReviveParticle(particle) {
  if (game.sparks.length < REVIVE_PARTICLE_LIMIT) game.sparks.push(particle);
}

function createReviveDeathEffect(x, y) {
  for (let index = 0; index < 72; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 90 + Math.random() * 390;
    pushReviveParticle({ type: 'revive-death', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 3 + Math.random() * 8, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 18, life: .45 + Math.random() * .55, maxLife: 1, filled: index % 3 !== 0, gray: index % 7 === 0 });
  }
  for (let index = 0; index < 12; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    pushReviveParticle({ type: 'revive-death', x, y, vx: Math.cos(angle) * (220 + Math.random() * 160), vy: Math.sin(angle) * (220 + Math.random() * 160), size: 2 + Math.random() * 3, rotation: angle, spin: (Math.random() - .5) * 25, life: .25 + Math.random() * .2, maxLife: .45, filled: false, gray: false });
  }
  pushReviveParticle({ type: 'revive-wave', x, y, radius: 8, growth: 230, lineWidth: 4, life: .32, maxLife: .32 });
}

function createReviveGatherEffect(x, y) {
  for (let index = 0; index < 34; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 75 + Math.random() * 95;
    pushReviveParticle({ type: 'revive-gather', x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius, targetX: x, targetY: y, pull: 360 + Math.random() * 260, size: 3 + Math.random() * 7, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 20, life: .5 + Math.random() * .35, maxLife: .85, filled: index % 3 !== 0 });
  }
  for (let index = 0; index < 8; index += 1) {
    pushReviveParticle({ type: 'revive-ring', x, y, radius: 20 + index * 4, rotation: index * Math.PI / 4, spin: (index % 2 ? -1 : 1) * (3 + Math.random() * 4), lineWidth: 1 + index % 2, life: .55 + index * .025, maxLife: .75 });
  }
}

function createReviveBurstEffect(x, y) {
  for (let index = 0; index < 68; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 130 + Math.random() * 470;
    pushReviveParticle({ type: 'revive-burst', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 3 + Math.random() * 7, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 22, life: .5 + Math.random() * .65, maxLife: 1.15, filled: index % 3 !== 0 });
  }
  for (let index = 0; index < 3; index += 1) {
    pushReviveParticle({ type: 'revive-wave', x, y, radius: 12 + index * 10, growth: 260 + index * 70, lineWidth: 3 - index * .5, life: .35 + index * .1, maxLife: .45 + index * .1 });
  }
}

function createReviveCompleteBurstEffect(x, y) {
  const colors = ['#B58B3A', '#D0A653', '#E1B957', '#A77E31'];
  for (let index = 0; index < 50; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 180 + Math.random() * 240;
    pushReviveParticle({
      type: 'revive-complete-burst',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 3,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - .5) * 14,
      color: colors[index % colors.length],
      life: .45 + Math.random() * .4,
      maxLife: .85,
      filled: index % 5 !== 0
    });
  }
}

function beginFighterRevive(fighter, now) {
  if (game.phase !== 'playing' || fighter.revivePending || fighter.totemCharges <= 0) return;
  fighter.revivePending = true;
  const deathX = fighter.x + fighter.size / 2;
  const deathY = fighter.y + fighter.size / 2;
  createReviveDeathEffect(deathX, deathY);
  fighter.totemCharges -= 1;
  fighter.defeated = true;
  const spawn = findSafeSpawn(fighter, fighter.x, fighter.y);
  game.phase = 'reviving';
  game.revive = { fighter, startedAt: now, reviveAt: now + REVIVE_WAIT_DURATION, gatherAt: now, burstStarted: false, spawnX: spawn.x, spawnY: spawn.y };
  fighter.charging = false; fighter.chargeAim = null; stopChargeSound(fighter);
  game.bullets = [];
  statusText.textContent = '暗影復活準備中';
  roundState.textContent = 'REVIVE 3.0';
  createReviveGatherEffect(spawn.x + fighter.size / 2, spawn.y + fighter.size / 2);
  game.shakeTime = .28; game.shakeDuration = .28; game.shakePower = 12;
}

function updateFighterRevive(now, dt) {
  if (!game.revive || game.phase !== 'reviving') return;
  const fighter = game.revive.fighter;
  const opponent = fighter === player ? ai : player;
  let dx = 0; let dy = 0;
  if (fighter.isPlayer) {
    dx = touchInput.x; dy = touchInput.y;
    if (keys.has('w')) dy -= 1; if (keys.has('s')) dy += 1; if (keys.has('a')) dx -= 1; if (keys.has('d')) dx += 1;
  } else {
    const horizontalGap = player.x - fighter.x;
    const verticalGap = player.y - fighter.y;
    dx = Math.sign(horizontalGap); dy = Math.sign(verticalGap);
  }
  moveFighter(fighter, dx, dy, dt);
  opponent.reviveSupportMovement = true;
  if (opponent === player) {
    let playerDx = touchInput.x; let playerDy = touchInput.y;
    if (keys.has('w')) playerDy -= 1; if (keys.has('s')) playerDy += 1; if (keys.has('a')) playerDx -= 1; if (keys.has('d')) playerDx += 1;
    moveFighter(opponent, playerDx, playerDy, dt);
  } else {
    const horizontalGap = player.x - opponent.x;
    const verticalGap = player.y - opponent.y;
    moveFighter(opponent, Math.sign(horizontalGap), Math.sign(verticalGap), dt);
  }
  const elapsed = now - game.revive.startedAt;
  const remaining = Math.max(0, (game.revive.reviveAt - now) / 1000);
  roundState.textContent = `REVIVE ${remaining.toFixed(1)}`;
  statusText.textContent = remaining > 0 ? '暗影復活準備中' : '復活';
  if (elapsed < REVIVE_GATHER_DURATION && now - game.revive.gatherAt >= 150) {
    game.revive.gatherAt = now;
    createReviveGatherEffect(game.revive.spawnX + fighter.size / 2, game.revive.spawnY + fighter.size / 2);
  }
  if (elapsed >= REVIVE_GATHER_DURATION && !game.revive.burstStarted) {
    game.revive.burstStarted = true;
    createReviveBurstEffect(game.revive.spawnX + fighter.size / 2, game.revive.spawnY + fighter.size / 2);
  }
  if (now < game.revive.reviveAt) return;
  fighter.x = game.revive.spawnX;
  fighter.y = game.revive.spawnY;
  fighter.vx = 0; fighter.vy = 0; fighter.knockbackX = 0; fighter.knockbackY = 0;
  fighter.defeated = false;
  fighter.revivePending = false;
  fighter.invulnerableUntil = now + REVIVE_INVULNERABILITY;
  fighter.reviveFlash = .42;
  createReviveCompleteBurstEffect(fighter.x + fighter.size / 2, fighter.y + fighter.size / 2);
  opponent.reviveSupportMovement = false;
  if (fighter.isPlayer) {
    cancelLaserCharge(ai);
    ai.aiLaserBlockedUntil = now + REVIVE_PLAYER_AI_LASER_DELAY;
    ai.aiNextAction = Math.max(ai.aiNextAction, ai.aiLaserBlockedUntil);
  }
  if (!fighter.isPlayer) {
    fighter.weaponLockedUntil = now + REVIVE_AI_WEAPON_DELAY;
    fighter.aiNextAction = now + REVIVE_AI_WEAPON_DELAY;
  }
  game.revive = null;
  game.phase = 'playing';
  statusText.textContent = '對戰進行中';
  roundState.textContent = 'LIVE';
  game.shakeTime = .28; game.shakeDuration = .28; game.shakePower = 12;
}

function burst(x, y, color) { for (let index = 0; index < 7; index += 1) game.sparks.push({ type: 'spark', x, y, vx: (Math.random() - .5) * 180, vy: (Math.random() - .5) * 180, life: .35, maxLife: .35, color }); }
function bulletClashBurst(x, y) {
  for (let index = 0; index < 18; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 150;
    game.sparks.push({ type: 'bullet-clash', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 3 + Math.random() * 4, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 10, life: .55 + Math.random() * .25, maxLife: .8, filled: index % 2 === 0 });
  }
  game.shakeTime = .2; game.shakeDuration = .2; game.shakePower = 9;
}
function finisherBurst(x, y, target) {
  for (let index = 0; index < 110; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 190 + Math.random() * 360;
    game.sparks.push({ type: 'finisher', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 4 + Math.random() * 7, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 9, life: .95 + Math.random() * .45, maxLife: 1.4, filled: index % 2 === 0 });
  }
  for (let index = 0; index < 24; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 270;
    game.sparks.push({ type: 'fighter-fragment', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 3 + Math.random() * 5, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 12, life: .8 + Math.random() * .35, maxLife: 1.15, color: target.color, filled: index % 3 !== 0 });
  }
}
function createVictoryHaloEffect(fighter) {
  game.sparks.push({ type: 'victory-aura', fighter, rotation: 0, innerRotation: 0, emitTimer: 0, startedAt: performance.now(), life: Infinity, maxLife: Infinity });
}
function createVictoryFireworks() {
  game.sparks.push({ type: 'victory-fireworks', elapsed: 0, waveIndex: 0, life: 5.8, maxLife: 5.8 });
}
function onFireworkLaunch(rocket) {
  if (rocket.launchSoundPlayed) return;
  rocket.launchSoundPlayed = true;
  console.info('煙火開始發射，準備播放音效', {
    waveIndex: rocket.waveIndex,
    x: Math.round(rocket.x),
    y: Math.round(rocket.y),
    sound: FIREWORKS_SOUND_PATH
  });
  playFireworksSound();
}
function createFireworkRocket(x, targetY, waveIndex, collection = game.sparks) {
  const rocket = {
    type: 'victory-firework-rocket',
    x,
    y: arena.height - 22,
    vx: (Math.random() - .5) * 18,
    vy: -(285 + Math.random() * 75),
    targetY,
    waveIndex,
    size: 4,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - .5) * 8,
    trailTimer: 0,
    ageMs: 0,
    exploded: false,
    launchSoundPlayed: false,
    life: 2.5,
    maxLife: 2.5
  };
  collection.push(rocket);
  onFireworkLaunch(rocket);
}
function createFireworkBurst(x, y, waveIndex, collection = game.sparks) {
  const count = 44;
  for (let index = 0; index < count; index += 1) {
    const radialIndex = waveIndex % 2 === 0 ? index : (index * 2) % count;
    const angle = Math.PI * 2 * radialIndex / count + (Math.random() - .5) * .13;
    const speed = 175 + Math.random() * 220;
    collection.push({ type: 'victory-firework-burst', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, filled: index % (3 + waveIndex % 3) !== 0, size: 4 + Math.random() * 3, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 14, color: '#050505', life: 1.35 + Math.random() * .5, maxLife: 1.85 });
  }
  for (let index = 0; index < 18; index += 1) {
    const angle = Math.PI * 2 * index / 18 + Math.random() * .18;
    const speed = 85 + Math.random() * 105;
    collection.push({ type: 'victory-firework-burst', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, filled: index % 2 === 0, size: 3 + Math.random() * 2, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 10, color: '#050505', life: .95 + Math.random() * .4, maxLife: 1.35 });
  }
}
function endGame(winner, killer) {
  if (game.phase === 'finished') return;
  cancelLaserCharge(player);
  cancelLaserCharge(ai);
  game.sparks = game.sparks.filter((spark) => !['charge-inward', 'charge-compress', 'charge-ring', 'charge-warp'].includes(spark.type));
  game.phase = 'finished';
  game.crown = { fighter: winner === 'PLAYER' ? player : ai, startedAt: performance.now() };
  const target = winner === 'PLAYER' ? ai : player;
  target.defeated = true;
  if (killer && !target.revivePending) {
    createVictoryHaloEffect(killer);
  }
  if (winner === 'PLAYER' && !game.victoryPlayed) {
    game.victoryPlayed = true;
    playVictorySound();
    createVictoryFireworks();
  }
  resultTitle.textContent = winner === 'PLAYER' ? 'PLAYER WINS' : 'GAME OVER'; statusText.textContent = winner === 'PLAYER' ? '藍方勝利' : '粉方勝利'; roundState.textContent = 'FINISH';
  if (winner === 'AI') playGameOverSound();
  finisherBurst(target.x + target.size / 2, target.y + target.size / 2, target);
  game.shakeTime = 1.25; game.shakeDuration = 1.25; game.shakePower = 34;
  resultOverlay.classList.remove('hidden');
  resultOverlay.classList.add('fade-in');
}

function updateSparks(dt) {
  const spawnedSparks = [];
  game.sparks = game.sparks.filter((spark) => {
    spark.life -= dt;
    if (spark.type === 'victory-fireworks') {
      spark.elapsed += dt;
      const waveTimes = [.18, .72, 1.28, 1.92, 2.58, 3.22, 3.86, 4.48];
      while (spark.waveIndex < waveTimes.length && spark.elapsed >= waveTimes[spark.waveIndex]) {
        const positions = [
          { x: arena.width * .16, y: arena.height * .31 },
          { x: arena.width * .82, y: arena.height * .27 },
          { x: arena.width * .5, y: arena.height * .17 },
          { x: arena.width * .29, y: arena.height * .39 },
          { x: arena.width * .7, y: arena.height * .36 },
          { x: arena.width * .42, y: arena.height * .25 },
          { x: arena.width * .88, y: arena.height * .16 },
          { x: arena.width * .12, y: arena.height * .18 }
        ];
        const position = positions[spark.waveIndex];
        createFireworkRocket(position.x, position.y, spark.waveIndex, spawnedSparks);
        spark.waveIndex += 1;
      }
    } else if (spark.type === 'victory-firework-rocket') {
      spark.ageMs += dt * 1000;
      spark.trailTimer -= dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= Math.pow(.2, dt);
      spark.vy += 92 * dt;
      spark.rotation += spark.spin * dt;
      if (spark.trailTimer <= 0) {
        spark.trailTimer = .055;
        spawnedSparks.push({ type: 'victory-firework-trail', x: spark.x, y: spark.y + spark.size, vx: (Math.random() - .5) * 20, vy: 18 + Math.random() * 28, size: 2 + Math.random() * 2, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 8, color: '#050505', filled: Math.random() > .35, life: .3, maxLife: .3 });
      }
      if (!spark.exploded && spark.ageMs >= 1000) {
        spark.exploded = true;
        createFireworkBurst(spark.x, spark.y, spark.waveIndex, spawnedSparks);
        spark.life = 0;
      }
    } else if (['spark', 'finisher', 'fighter-fragment', 'laser-trail', 'laser-impact-square', 'bullet-clash', 'totem-collect', 'totem-collect-ring', 'revive-death', 'revive-burst', 'revive-complete-burst', 'victory-burst', 'victory-firework-burst', 'victory-firework-trail'].includes(spark.type)) {
      spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.vx *= Math.pow(.06, dt); spark.vy *= Math.pow(.06, dt); spark.rotation += spark.spin * dt; spark.spin *= Math.pow(.08, dt);
      if (spark.type === 'victory-firework-burst') spark.vy += 72 * dt;
    } else if (spark.type === 'victory-aura') {
      spark.rotation += 2.8 * dt;
      spark.innerRotation -= 1.25 * dt;
      spark.emitTimer -= dt;
      if (spark.emitTimer <= 0) {
        spark.emitTimer = .09;
        const centerX = spark.fighter.x + spark.fighter.size / 2;
        const centerY = spark.fighter.y + spark.fighter.size - 2;
        const angle = spark.rotation + Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 58;
        const colors = ['#B58B3A', '#8A6426', '#D0A653', '#0B0B0B'];
        if (game.sparks.length < 210) game.sparks.push({ type: 'victory-aura-particle', x: centerX + Math.cos(angle) * spark.fighter.size * .85, y: centerY + Math.sin(angle) * spark.fighter.size * .28, vx: Math.cos(angle) * (Math.random() * 24), vy: -speed, orbit: Math.random() * Math.PI * 2, orbitSpeed: 2 + Math.random() * 3, centerX, centerY, size: 3 + Math.random() * 3, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 10, color: colors[Math.floor(Math.random() * colors.length)], life: .8 + Math.random() * .7, maxLife: 1.5 });
      }
    } else if (spark.type === 'victory-aura-particle') {
      spark.orbit += spark.orbitSpeed * dt;
      spark.x += spark.vx * dt + Math.cos(spark.orbit) * 10 * dt;
      spark.y += spark.vy * dt;
      spark.vy += 18 * dt;
      spark.rotation += spark.spin * dt;
    } else if (spark.type === 'victory-halo') {
      spark.angle += spark.angularSpeed * dt;
      spark.radius += spark.growth * dt;
      spark.rotation += spark.spin * dt;
    } else if (spark.type === 'charge-inward' || spark.type === 'charge-compress' || spark.type === 'totem-inward' || spark.type === 'revive-gather') {
      const pull = spark.pull || 420;
      const dx = spark.targetX - spark.x; const dy = spark.targetY - spark.y; const distance = Math.hypot(dx, dy) || 1;
      spark.x += dx / distance * pull * dt; spark.y += dy / distance * pull * dt; spark.rotation += spark.spin * dt;
    } else if (spark.type === 'charge-ring' || spark.type === 'charge-warp' || spark.type === 'revive-ring') {
      spark.rotation += spark.spin * dt;
    } else if (spark.type === 'laser-wave') {
      spark.rotation += spark.spin * dt; spark.size += (spark.expand || 1) * dt * 7;
    } else if (spark.type === 'laser-impact-wave' || spark.type === 'totem-collect-ring') {
      spark.radius += spark.growth * dt;
    } else if (spark.type === 'revive-wave') {
      spark.radius += spark.growth * dt;
    } else if (spark.type === 'awakening-spiral' || spark.type === 'awakening-rainbow') {
      spark.phase += spark.phaseSpeed * dt;
      spark.rotation += spark.spin * dt;
    } else if (spark.type === 'awakening-vortex' || spark.type === 'awakening-disk') {
      spark.angle += spark.angularSpeed * dt;
      spark.rotation += spark.spin * dt;
    } else if (spark.type === 'awakening-sigil') {
      spark.rotation += spark.spin * dt;
    } else if (spark.type === 'awakening-time-shard') {
      spark.phase += 4 * dt;
      spark.rotation += spark.spin * dt;
    } else if (spark.type === 'awakening-wave') {
      spark.radius += spark.growth * dt;
    }
    return spark.life > 0;
  });
  game.sparks.push(...spawnedSparks);
  if (game.shakeTime > 0) game.shakeTime -= dt;
  if (game.darkening) {
    game.darkening.elapsed += dt;
    if (game.darkening.elapsed >= game.darkening.duration) game.darkening = null;
  }
  if (player && player.reviveFlash > 0) player.reviveFlash = Math.max(0, player.reviveFlash - dt);
}
function updateChargeUi() { const p = player && player.charging ? Math.min(100, (performance.now() - player.chargeStarted) / 10) : 0; const a = ai && ai.charging ? Math.min(100, (performance.now() - ai.chargeStarted) / 10) : 0; playerCharge.style.width = `${p}%`; aiCharge.style.width = `${a}%`; playerChargeLabel.textContent = p >= 100 ? 'READY TO FIRE' : p ? '蓄力中...' : '待機'; aiChargeLabel.textContent = a >= 100 ? 'READY TO FIRE' : a ? '蓄力中...' : '待機'; }

function drawTotemOrbit(fighter, now) {
  if (fighter.totemCharges <= 0) return;
  const centerX = fighter.x + fighter.size / 2;
  const centerY = fighter.y + fighter.size / 2;
  const orbitRadius = fighter.size * .7;
  const colors = ['#B58B3A', '#C39A4A', '#A77E31', '#D0A653'];
  ctx.save();
  ctx.globalAlpha = .9;
  for (let index = 0; index < 12; index += 1) {
    const angle = now * .0012 + index * Math.PI * 2 / 12;
    const depth = Math.sin(angle * 2 + index * .7);
    const x = centerX + Math.cos(angle) * (orbitRadius + depth * 3);
    const y = centerY + Math.sin(angle) * (orbitRadius * .62) + depth * 4;
    const size = 3 + (index % 3);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 4);
    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
  ctx.restore();
}
function drawFighter(fighter) { const progress = fighter.charging ? Math.min(1, (performance.now() - fighter.chargeStarted) / 1000) : 0; drawTotemOrbit(fighter, performance.now()); ctx.save(); ctx.shadowColor = '#000'; ctx.shadowBlur = fighter.charging ? 9 + progress * 18 : 0; ctx.fillStyle = fighterColor(fighter); ctx.fillRect(fighter.x, fighter.y, fighter.size, fighter.size); ctx.restore(); ctx.fillStyle = '#fff'; ctx.globalAlpha = .7; ctx.fillRect(fighter.x + 8, fighter.y + 8, 5, 5); ctx.globalAlpha = 1; if (fighter.totemCharges > 0) { ctx.fillStyle = '#B58B3A'; ctx.fillRect(fighter.x + fighter.size - 8, fighter.y - 8, 8, 8); ctx.fillStyle = '#15151A'; ctx.font = 'bold 9px sans-serif'; ctx.fillText(fighter.totemCharges, fighter.x + fighter.size - 7, fighter.y - 1); } }
function drawVictoryCrown(now) {
  if (!game.crown || game.phase !== 'finished') return;
  const fighter = game.crown.fighter;
  const blockSize = 6;
  const formation = Math.min(1, (now - game.crown.startedAt) / 650);
  const floatOffset = Math.sin(now / 420) * 2;
  const originX = fighter.x + fighter.size / 2 - blockSize * 3.5;
  const originY = fighter.y - blockSize * 4 + floatOffset;
  const pattern = [
    '1000101',
    '1101011',
    '1010101',
    '1000001',
    '1111111'
  ];
  const colors = ['#B58B3A', '#8A6426', '#D0A653'];
  let blockIndex = 0;
  const totalBlocks = pattern.reduce((count, row) => count + [...row].filter((value) => value === '1').length, 0);
  ctx.save();
  ctx.shadowColor = '#B58B3A';
  ctx.shadowBlur = 8;
  pattern.forEach((row, rowIndex) => [...row].forEach((value, columnIndex) => {
    if (value !== '1') return;
    const revealAt = blockIndex / totalBlocks;
    blockIndex += 1;
    if (formation < revealAt) return;
    ctx.globalAlpha = .7 + formation * .3;
    ctx.fillStyle = colors[(rowIndex + columnIndex) % colors.length];
    ctx.fillRect(originX + columnIndex * blockSize, originY + rowIndex * blockSize, blockSize, blockSize);
  }));
  ctx.restore();
}
function fighterColor(fighter) {
  if (!fighter.charging) return fighter.color;
  const progress = Math.min(1, (performance.now() - fighter.chargeStarted) / 1000);
  const source = fighter.color.slice(1).match(/../g).map((value) => parseInt(value, 16));
  return `rgb(${source.map((value) => Math.round(value * (1 - progress))).join(', ')})`;
}
function drawHitCounter() {
  if (game.phase === 'countdown' || game.phase === 'finished') return;
  const value = String(game.bulletHitTotal);
  const pixelSize = player ? player.size : ai ? ai.size : 38;
  const digitWidth = 3 * pixelSize;
  const gap = pixelSize;
  const totalWidth = value.length * digitWidth + Math.max(0, value.length - 1) * gap;
  const startX = (arena.width - totalWidth) / 2;
  const startY = (arena.height - pixelSize * 5) / 2;
  ctx.save();
  ctx.fillStyle = '#8C8C90';
  ctx.globalAlpha = .72;
  value.split('').forEach((digit, digitIndex) => {
    const pattern = PIXEL_DIGITS[Number(digit)];
    pattern.split('').forEach((pixel, pixelIndex) => {
      if (pixel !== '1') return;
      const x = startX + digitIndex * (digitWidth + gap) + (pixelIndex % 3) * pixelSize;
      const y = startY + Math.floor(pixelIndex / 3) * pixelSize;
      ctx.fillRect(x, y, pixelSize, pixelSize);
    });
  });
  ctx.restore();
}
function drawPixelText(text, centerX, topY, blockSize, color, alpha = 1) {
  const glyphWidth = 3 * blockSize;
  const gap = blockSize;
  const totalWidth = text.length * glyphWidth + Math.max(0, text.length - 1) * gap;
  const startX = centerX - totalWidth / 2;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  [...text].forEach((character, characterIndex) => {
    const pattern = PIXEL_GLYPHS[character] || (PIXEL_DIGITS[Number(character)] || '000000000000000');
    pattern.split('').forEach((pixel, pixelIndex) => {
      if (pixel !== '1') return;
      const x = startX + characterIndex * (glyphWidth + gap) + (pixelIndex % 3) * blockSize;
      const y = topY + Math.floor(pixelIndex / 3) * blockSize;
      ctx.fillRect(x, y, blockSize, blockSize);
    });
  });
  ctx.restore();
}
function drawResultText() {
  if (game.phase !== 'finished' || resultOverlay.classList.contains('hidden')) return;
  const titleSize = Math.min(90, Math.max(36, arena.width * .09));
  const promptSize = Math.min(22, Math.max(12, arena.width * .022));
  const centerY = arena.height / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#15151A';
  ctx.globalAlpha = .9;
  ctx.font = `700 ${titleSize}px 'Barlow Condensed', sans-serif`;
  ctx.fillText(resultTitle.textContent, arena.width / 2, centerY - promptSize * 1.2);
  ctx.fillStyle = '#74737A';
  ctx.font = `700 ${promptSize}px 'Space Grotesk', sans-serif`;
  ctx.fillText('按空白鍵再來一場', arena.width / 2, centerY + titleSize * .65);
  ctx.restore();
}

function drawVictoryFireworksBackground() {
  game.sparks.forEach((spark) => {
    if (!['victory-firework-rocket', 'victory-firework-trail', 'victory-firework-burst'].includes(spark.type)) return;
    const alpha = Math.max(0, spark.life / spark.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha * (spark.type === 'victory-firework-trail' ? .62 : .9);
    ctx.translate(spark.x, spark.y);
    ctx.rotate(spark.rotation);
    ctx.fillStyle = '#050505';
    ctx.strokeStyle = '#050505';
    ctx.lineWidth = 1.5;
    if (spark.filled === false) {
      ctx.strokeRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
    } else {
      ctx.fillRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
    }
    ctx.restore();
  });
}

function draw() {
  ctx.clearRect(0, 0, arena.width, arena.height);
  ctx.save();
  if (game.shakeTime > 0) { const strength = game.shakePower * Math.min(1, game.shakeTime / game.shakeDuration); ctx.translate((Math.random() - .5) * strength, (Math.random() - .5) * strength); }
  ctx.strokeStyle = '#f4f4f5'; ctx.lineWidth = 1;
  for (let x = 28; x < arena.width; x += 42) { ctx.beginPath(); ctx.moveTo(x, 18); ctx.lineTo(x, arena.height - 18); ctx.stroke(); }
  for (let y = 28; y < arena.height; y += 42) { ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(arena.width - 18, y); ctx.stroke(); }
  drawVictoryFireworksBackground();
  if (game.phase === 'countdown') {
    drawPixelText(String(Math.max(1, Math.ceil(game.countdown))), arena.width / 2, (arena.height - (player ? player.size * 5 : 190)) / 2, player ? player.size : 38, '#15151A', .86);
  }
  drawHitCounter();
  drawResultText();
  [player, ai].forEach((fighter) => { if (!fighter) return; if (fighter.charging && fighter.chargeAim) { chargeBurst(fighter, performance.now()); const origin = { x: fighter.x + fighter.size / 2, y: fighter.y + fighter.size / 2 }; const angle = Math.atan2(fighter.chargeAim.y - origin.y, fighter.chargeAim.x - origin.x); ctx.save(); ctx.setLineDash([7, 8]); ctx.strokeStyle = fighter.color; ctx.globalAlpha = .7; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(origin.x + Math.cos(angle) * 900, origin.y + Math.sin(angle) * 900); ctx.stroke(); ctx.restore(); } });
  game.bullets.forEach((bullet) => { ctx.fillStyle = bullet.owner === 'player' ? COLORS.player : COLORS.ai; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2); ctx.fill(); });
  game.sparks.forEach((spark) => {
    if (['victory-firework-rocket', 'victory-firework-trail', 'victory-firework-burst'].includes(spark.type)) return;
    const alpha = Number.isFinite(spark.life / spark.maxLife) ? Math.max(0, spark.life / spark.maxLife) : 1;
    ctx.save(); ctx.globalAlpha = alpha;
    if (spark.type === 'laser' || spark.type === 'laser-afterimage') {
      ctx.strokeStyle = '#000'; ctx.shadowColor = '#000'; ctx.shadowBlur = spark.type === 'laser' ? 20 : 10; ctx.lineWidth = spark.type === 'laser' ? 7 : 3;
      ctx.beginPath(); ctx.moveTo(spark.x, spark.y); ctx.lineTo(spark.x + Math.cos(spark.angle) * spark.length, spark.y + Math.sin(spark.angle) * spark.length); ctx.stroke();
    } else if (spark.type === 'laser-speed') {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(spark.x, spark.y); ctx.lineTo(spark.x - Math.cos(spark.angle) * spark.length, spark.y - Math.sin(spark.angle) * spark.length); ctx.stroke();
    } else if (spark.type === 'laser-wave') {
      ctx.translate(spark.x, spark.y); ctx.rotate(spark.angle); ctx.strokeStyle = '#000'; ctx.fillStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, spark.size * 2.5, spark.side < 0 ? -Math.PI * .75 : Math.PI * .25, spark.side < 0 ? -Math.PI * .25 : Math.PI * .75); ctx.stroke();
      ctx.translate(spark.side * 5, 0); if (spark.filled) ctx.fillRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size); else ctx.strokeRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
    } else if (spark.type === 'laser-impact-wave' || spark.type === 'revive-wave') {
      ctx.strokeStyle = '#000'; ctx.lineWidth = spark.lineWidth; ctx.beginPath(); ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2); ctx.stroke();
    } else if (spark.type === 'awakening-wave') {
      ctx.strokeStyle = '#B58B3A'; ctx.shadowColor = '#B58B3A'; ctx.shadowBlur = 14; ctx.lineWidth = spark.lineWidth;
      ctx.strokeRect(spark.x - spark.radius, spark.y - spark.radius, spark.radius * 2, spark.radius * 2);
    } else if (spark.type === 'totem-collect-ring') {
      ctx.translate(spark.x, spark.y); ctx.rotate(spark.rotation); ctx.strokeStyle = '#B58B3A'; ctx.shadowColor = '#B58B3A'; ctx.shadowBlur = 8; ctx.lineWidth = spark.lineWidth;
      ctx.strokeRect(-spark.radius, -spark.radius, spark.radius * 2, spark.radius * 2);
    } else if (spark.type === 'laser-crack') {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(spark.x, spark.y); ctx.lineTo(spark.x + Math.cos(spark.angle) * spark.length, spark.y + Math.sin(spark.angle) * spark.length); ctx.stroke();
    } else if (spark.type === 'charge-ring' || spark.type === 'charge-warp' || spark.type === 'revive-ring') {
      ctx.translate(spark.x, spark.y); ctx.rotate(spark.rotation); ctx.strokeStyle = '#000'; ctx.lineWidth = spark.lineWidth || 2;
      if (spark.type === 'charge-ring') { ctx.beginPath(); ctx.arc(0, 0, spark.radius, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, spark.radius * .7, .2, Math.PI * 1.2); ctx.stroke(); }
      else if (spark.type === 'revive-ring') { ctx.strokeRect(-spark.radius, -spark.radius, spark.radius * 2, spark.radius * 2); ctx.rotate(Math.PI / 4); ctx.strokeRect(-spark.radius * .72, -spark.radius * .72, spark.radius * 1.44, spark.radius * 1.44); }
      else { ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(0, 0, spark.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    } else if (spark.type === 'awakening-sigil') {
      const progress = game.awakening ? Math.min(1, (performance.now() - game.awakening.startedAt) / AWAKENING_DURATION) : 1;
      const collapse = progress < .58 ? 1 : 1 - (progress - .58) / .42 * .28;
      ctx.translate(spark.x, spark.y); ctx.rotate(spark.rotation); ctx.strokeStyle = '#111'; ctx.shadowColor = '#B58B3A'; ctx.shadowBlur = 10; ctx.lineWidth = spark.lineWidth;
      ctx.globalAlpha *= .35 + Math.sin(progress * Math.PI) * .65;
      ctx.strokeRect(-spark.radius * collapse, -spark.radius * collapse, spark.radius * 2 * collapse, spark.radius * 2 * collapse);
      ctx.fillStyle = '#B58B3A';
      for (let index = 0; index < 8; index += 1) {
        const perimeter = (performance.now() / 700 + index / 8 + spark.radius / 100) % 1;
        const edge = perimeter * 4;
        let px; let py;
        if (edge < 1) { px = -spark.radius + edge * spark.radius * 2; py = -spark.radius; }
        else if (edge < 2) { px = spark.radius; py = -spark.radius + (edge - 1) * spark.radius * 2; }
        else if (edge < 3) { px = spark.radius - (edge - 2) * spark.radius * 2; py = spark.radius; }
        else { px = -spark.radius; py = spark.radius - (edge - 3) * spark.radius * 2; }
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
    } else if (spark.type === 'awakening-vortex') {
      const progress = game.awakening ? Math.min(1, (performance.now() - game.awakening.startedAt) / AWAKENING_DURATION) : 1;
      const radiusScale = progress < .42 ? 1 - progress / .42 * .68 : .32 + (progress - .42) / .58 * 1.65;
      const x = spark.x + Math.cos(spark.angle) * spark.radius * radiusScale;
      const y = spark.y + Math.sin(spark.angle) * spark.radius * radiusScale * .72;
      ctx.translate(x, y); ctx.rotate(spark.rotation); ctx.strokeStyle = '#111'; ctx.fillStyle = '#080808'; ctx.shadowColor = '#B58B3A'; ctx.shadowBlur = 7; ctx.lineWidth = 2;
      if (spark.filled) ctx.fillRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size); else ctx.strokeRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
    } else if (spark.type === 'awakening-disk') {
      const progress = game.awakening ? Math.min(1, (performance.now() - game.awakening.startedAt) / AWAKENING_DURATION) : 1;
      const pull = progress < .7 ? 1 - progress * .3 : .7 - (progress - .7) * .65;
      const x = spark.x + Math.cos(spark.angle) * spark.radiusX * pull;
      const y = spark.y + Math.sin(spark.angle) * spark.radiusY * pull;
      ctx.translate(x, y); ctx.rotate(spark.angle + spark.rotation); ctx.strokeStyle = '#222'; ctx.fillStyle = '#B58B3A'; ctx.shadowColor = '#B58B3A'; ctx.shadowBlur = 6; ctx.lineWidth = 1.5;
      if (spark.filled) ctx.fillRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size); else ctx.strokeRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
    } else if (spark.type === 'awakening-spiral') {
      const progress = game.awakening ? Math.min(1, (performance.now() - game.awakening.startedAt) / AWAKENING_DURATION) : 1;
      ctx.globalAlpha *= Math.min(1, Math.max(0, (progress - .12) / .38));
      const x = spark.originX + Math.cos(spark.angle) * spark.distance + spark.normalX * Math.cos(spark.phase) * spark.radius * (1 - progress * .25);
      const y = spark.originY + Math.sin(spark.angle) * spark.distance + spark.normalY * Math.cos(spark.phase) * spark.radius * (1 - progress * .25);
      ctx.translate(x, y); ctx.rotate(spark.rotation); ctx.strokeStyle = '#B58B3A'; ctx.fillStyle = '#B58B3A'; ctx.lineWidth = 2;
      if (spark.filled) ctx.fillRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size); else ctx.strokeRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
    } else if (spark.type === 'awakening-time-shard') {
      const progress = game.awakening ? Math.min(1, (performance.now() - game.awakening.startedAt) / AWAKENING_DURATION) : 1;
      const glitch = Math.sin(spark.phase) * (1 - Math.min(1, progress * 1.4)) * spark.offset;
      const x = spark.originX + Math.cos(spark.angle) * spark.distance + spark.normalX * glitch;
      const y = spark.originY + Math.sin(spark.angle) * spark.distance + spark.normalY * glitch;
      ctx.translate(x, y); ctx.rotate(spark.rotation); ctx.strokeStyle = '#111'; ctx.fillStyle = '#333'; ctx.globalAlpha *= .28 + Math.abs(Math.sin(spark.phase)) * .55; ctx.lineWidth = 1.5;
      if (spark.filled) ctx.fillRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size); else ctx.strokeRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
    } else if (spark.type === 'awakening-rainbow') {
      const progress = game.awakening ? Math.min(1, (performance.now() - game.awakening.startedAt) / AWAKENING_DURATION) : 1;
      ctx.globalAlpha *= Math.min(1, Math.max(0, (progress - .4) / .25));
      const convergence = Math.max(0, (progress - .55) / .45);
      const sideOffset = spark.side * 26 * (1 - convergence);
      const x = spark.originX + Math.cos(spark.angle) * spark.distance + spark.normalX * sideOffset;
      const y = spark.originY + Math.sin(spark.angle) * spark.distance + spark.normalY * sideOffset;
      ctx.translate(x, y); ctx.rotate(spark.angle); ctx.fillStyle = spark.color; ctx.shadowColor = spark.color; ctx.shadowBlur = 8;
      ctx.fillRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
    } else if (spark.type === 'victory-aura') {
      const centerX = spark.fighter.x + spark.fighter.size / 2;
      const centerY = spark.fighter.y + spark.fighter.size - 2;
      const activation = Math.min(1, (performance.now() - spark.startedAt) / 650);
      const pulse = .86 + Math.sin(performance.now() / 260) * .08;
      const outerRadius = spark.fighter.size * 1.65 * activation * pulse;
      const innerRadius = spark.fighter.size * 1.05 * activation;
      ctx.save();
      ctx.fillStyle = '#D0A653';
      ctx.shadowColor = '#E1B957';
      ctx.shadowBlur = 8;
      const drawBlockRing = (radius, count, rotation, alpha, size, yScale) => {
        for (let index = 0; index < count; index += 1) {
          const angle = rotation + index * Math.PI * 2 / count;
          const brightness = .52 + (Math.sin(rotation * 2 + index * 1.7) + 1) * .2;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius * yScale;
          ctx.save();
          ctx.globalAlpha *= alpha * brightness;
          ctx.fillStyle = index % 5 === 0 ? '#0B0B0B' : index % 3 === 0 ? '#8A6426' : '#D0A653';
          ctx.strokeStyle = '#B58B3A';
          ctx.lineWidth = 1;
          ctx.translate(x, y);
          ctx.rotate(angle + Math.PI / 4);
          ctx.fillRect(-size / 2, -size / 2, size, size);
          if (index % 5 === 0) ctx.strokeRect(-size / 2, -size / 2, size, size);
          ctx.restore();
        }
      };
      drawBlockRing(outerRadius, 36, spark.rotation, .9, 4, .38);
      drawBlockRing(innerRadius, 24, spark.innerRotation, .72, 3, .32);
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = spark.innerRotation + ray * Math.PI / 4;
        for (let step = 1; step <= 5; step += 1) {
          const distance = innerRadius * (.35 + step * .13);
          const x = centerX + Math.cos(angle) * distance;
          const y = centerY + Math.sin(angle) * distance * .35;
          ctx.save();
          ctx.globalAlpha *= .42 + step * .07;
          ctx.fillStyle = ray % 3 === 0 ? '#0B0B0B' : '#D0A653';
          ctx.strokeStyle = '#B58B3A';
          ctx.lineWidth = 1;
          ctx.translate(x, y);
          ctx.rotate(angle + (step % 2 ? Math.PI / 4 : 0));
          ctx.fillRect(-2, -2, 4, 4);
          if (ray % 3 === 0) ctx.strokeRect(-2, -2, 4, 4);
          ctx.restore();
        }
      }
      for (let diamond = 0; diamond < 4; diamond += 1) {
        const angle = spark.rotation + diamond * Math.PI / 2 + Math.PI / 4;
        const x = centerX + Math.cos(angle) * innerRadius * .72;
        const y = centerY + Math.sin(angle) * innerRadius * .27;
        ctx.save();
        ctx.globalAlpha *= .8;
        ctx.fillStyle = diamond % 2 ? '#8A6426' : '#D0A653';
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        [[-4, 0], [0, -4], [4, 0], [0, 4], [0, 0]].forEach(([blockX, blockY]) => ctx.fillRect(blockX - 2, blockY - 2, 4, 4));
        ctx.restore();
      }
      ctx.restore();
    } else if (spark.type === 'victory-aura-particle') {
      ctx.translate(spark.x, spark.y); ctx.rotate(spark.rotation); ctx.fillStyle = spark.color; ctx.strokeStyle = spark.color === '#0B0B0B' ? '#B58B3A' : spark.color; ctx.shadowColor = spark.color === '#0B0B0B' ? '#B58B3A' : spark.color; ctx.shadowBlur = 7;
      ctx.fillRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
      if (spark.color === '#0B0B0B') ctx.strokeRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
    } else if (spark.type === 'charge-inward' || spark.type === 'charge-compress' || spark.type === 'totem-inward' || spark.type === 'totem-collect' || spark.type === 'revive-gather' || spark.type === 'revive-death' || spark.type === 'revive-burst' || spark.type === 'revive-complete-burst' || spark.type === 'finisher' || spark.type === 'laser-trail' || spark.type === 'laser-impact-square' || spark.type === 'fighter-fragment' || spark.type === 'bullet-clash') {
      ctx.translate(spark.x, spark.y); ctx.rotate(spark.rotation); ctx.strokeStyle = spark.type === 'fighter-fragment' ? spark.color : spark.type === 'totem-collect' || spark.type === 'revive-complete-burst' ? spark.colorShift ? '#E1B957' : spark.color || '#B58B3A' : '#000'; ctx.fillStyle = spark.type === 'fighter-fragment' ? spark.color : spark.type === 'totem-collect' || spark.type === 'revive-complete-burst' ? spark.colorShift ? '#E1B957' : spark.color || '#B58B3A' : '#000'; ctx.lineWidth = 2;
      if (spark.gray) { ctx.strokeStyle = '#555'; ctx.fillStyle = '#555'; }
      if (spark.filled) ctx.fillRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size); else ctx.strokeRect(-spark.size / 2, -spark.size / 2, spark.size, spark.size);
    } else { ctx.fillStyle = spark.color; ctx.fillRect(spark.x - 3, spark.y - 3, 6, 6); }
    ctx.restore();
  });
  if (game.totem) {
    ctx.save();
    ctx.fillStyle = '#B58B3A';
    ctx.shadowColor = 'rgba(181, 139, 58, .55)';
    ctx.shadowBlur = 12;
    ctx.fillRect(game.totem.x, game.totem.y, TOTEM_SIZE, TOTEM_SIZE);
    ctx.restore();
  }
  if (game.awakening) {
    const progress = Math.min(1, (performance.now() - game.awakening.startedAt) / AWAKENING_DURATION);
    const centerX = game.awakening.fighter.x + game.awakening.fighter.size / 2;
    const centerY = game.awakening.fighter.y + game.awakening.fighter.size / 2 - progress * 18;
    const size = 8 + progress * (game.awakening.fighter.size - 8);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(performance.now() / 420);
    ctx.globalAlpha = Math.min(1, progress * 4) * (1 - Math.max(0, progress - .8) * 5);
    ctx.fillStyle = '#B58B3A'; ctx.shadowColor = '#B58B3A'; ctx.shadowBlur = 18;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeStyle = '#E1B957'; ctx.lineWidth = 2;
    ctx.strokeRect(-size * .7, -size * .7, size * 1.4, size * 1.4);
    ctx.globalAlpha *= .8;
    ctx.fillStyle = '#050505';
    ctx.fillRect(-size * .34, -size * .34, size * .68, size * .68);
    ctx.restore();
  }
  if (game.cinematic) {
    const cinematic = game.cinematic;
    ctx.save();
    ctx.globalAlpha = .9;
    ctx.strokeStyle = '#000'; ctx.shadowColor = '#B58B3A'; ctx.shadowBlur = 16; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cinematic.origin.x, cinematic.origin.y);
    ctx.lineTo(cinematic.origin.x + Math.cos(cinematic.angle) * cinematic.length, cinematic.origin.y + Math.sin(cinematic.angle) * cinematic.length);
    ctx.stroke();
    ctx.restore();
  }
  if (!player.defeated) {
    if (player.reviveFlash > 0 && Math.floor(player.reviveFlash * 24) % 2 === 0) ctx.globalAlpha = .28;
    drawFighter(player);
    ctx.globalAlpha = 1;
  }
  if (!ai.defeated) drawFighter(ai);
  drawVictoryCrown(performance.now());
  if (game.darkening) {
    const elapsed = game.darkening.elapsed;
    let opacity;
    if (elapsed < .4) opacity = .58 * (elapsed / .4);
    else if (elapsed < 1.4) opacity = .58;
    else opacity = .58 * Math.max(0, 1 - (elapsed - 1.4) / .7);
    ctx.fillStyle = '#000';
    ctx.globalAlpha = opacity;
    ctx.fillRect(0, 0, arena.width, arena.height);
  }
  ctx.restore();
}

function loop(now) {
  const dt = Math.min(.033, (now - game.lastTime) / 1000 || 0); game.lastTime = now;
  updateCinematic(now);
  updateAwakening(now);
  const gameplayDt = dt * (game.awakening ? AWAKENING_TIME_SCALE : 1);
  if (game.phase === 'countdown') { game.countdown -= dt; const shown = Math.max(1, Math.ceil(game.countdown)); if (shown !== game.lastCountdownShown) { game.lastCountdownShown = shown; countdownNumber.textContent = shown; playCountdownSound(); } if (game.countdown <= 0) { game.phase = 'playing'; ai.aiNextAction = now + 2800; countdownOverlay.classList.add('hidden'); statusText.textContent = '對戰進行中'; roundState.textContent = 'LIVE'; playCountdownCompleteSound(); } }
  else if (game.phase === 'playing') { updatePlayer(gameplayDt, now); updateAi(gameplayDt, now); updateTotem(gameplayDt, now); updateBullets(gameplayDt, now); }
  else if (game.phase === 'reviving') updateFighterRevive(now, gameplayDt);
  updateSparks(dt); updateChargeUi(); draw(); requestAnimationFrame(loop);
}

document.addEventListener('keydown', (event) => { const key = event.key.toLowerCase(); unlockGameOverSound(); if (game.phase === 'finished' && key === ' ') { event.preventDefault(); resetGame(); return; } if (['w', 'a', 's', 'd', 'j', 'k'].includes(key)) { event.preventDefault(); const wasCharging = player && player.charging; keys.add(key); if (key === 'k' && game.phase === 'playing') { beginCharge(player, performance.now()); } } });
document.addEventListener('keyup', (event) => { const key = event.key.toLowerCase(); if (['w', 'a', 's', 'd', 'j', 'k'].includes(key)) { event.preventDefault(); keys.delete(key); } });
function setupTouchControls() {
  const joystick = document.getElementById('joystick');
  const joystickKnob = document.getElementById('joystickKnob');
  const bulletButton = document.getElementById('bulletButton');
  const laserButton = document.getElementById('laserButton');
  let joystickPointerId = null;
  const updateJoystick = (event) => {
    const rect = joystick.getBoundingClientRect();
    const radius = rect.width / 2;
    const knobRadius = joystickKnob.offsetWidth / 2;
    const maxDistance = radius - knobRadius - 4;
    const dx = event.clientX - (rect.left + radius);
    const dy = event.clientY - (rect.top + radius);
    const distance = Math.min(maxDistance, Math.hypot(dx, dy));
    const direction = Math.atan2(dy, dx);
    const knobX = Math.cos(direction) * distance;
    const knobY = Math.sin(direction) * distance;
    touchInput.x = knobX / maxDistance;
    touchInput.y = knobY / maxDistance;
    joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
  };
  const resetJoystick = () => {
    joystickPointerId = null; touchInput.x = 0; touchInput.y = 0; joystickKnob.style.transform = 'translate(-50%, -50%)';
  };
  joystick.addEventListener('pointerdown', (event) => { event.preventDefault(); joystickPointerId = event.pointerId; joystick.setPointerCapture(event.pointerId); updateJoystick(event); });
  joystick.addEventListener('pointermove', (event) => { if (event.pointerId === joystickPointerId) updateJoystick(event); });
  joystick.addEventListener('pointerup', resetJoystick);
  joystick.addEventListener('pointercancel', resetJoystick);
  const setWeaponButton = (button, weapon, pressed) => { touchInput[weapon] = pressed; button.classList.toggle('active', pressed); };
  bulletButton.addEventListener('pointerdown', (event) => { event.preventDefault(); bulletButton.setPointerCapture(event.pointerId); setWeaponButton(bulletButton, 'fire', true); });
  laserButton.addEventListener('pointerdown', (event) => { event.preventDefault(); unlockGameOverSound(); laserButton.setPointerCapture(event.pointerId); setWeaponButton(laserButton, 'laser', true); if (game.phase === 'playing') { beginCharge(player, performance.now()); } });
  bulletButton.addEventListener('pointerup', () => setWeaponButton(bulletButton, 'fire', false));
  bulletButton.addEventListener('pointercancel', () => setWeaponButton(bulletButton, 'fire', false));
  laserButton.addEventListener('pointerup', () => setWeaponButton(laserButton, 'laser', false));
  laserButton.addEventListener('pointercancel', () => setWeaponButton(laserButton, 'laser', false));
}
setupTouchControls();
window.addEventListener('resize', resize); resize(); requestAnimationFrame(loop);
