import {
  activeVoices,
  currentSong,
  fadeTo,
  getVolume,
  installAudio,
  isMuted,
  playSfx,
  playSong,
  SFX_IDS,
  setMuted,
  setVolume,
  SONG_IDS,
  stopMusic,
  unlockAudio,
  type Bus,
} from '../src/audio';

installAudio();

const root = document.getElementById('audio')!;
const stats = document.getElementById('stats')!;

function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'grid';
  root.append(h, grid);
  return grid;
}

function button(parent: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => {
    unlockAudio();
    onClick();
  });
  parent.append(b);
  return b;
}

const mixer = section('Mixer');
for (const bus of ['master', 'sfx', 'music'] as Bus[]) {
  const l = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.05';
  input.value = String(getVolume(bus));
  input.addEventListener('input', () => setVolume(bus, Number(input.value)));
  l.append(`${bus.padEnd(6)}`, input);
  mixer.append(l);
}
const mute = button(mixer, 'Mute', () => {
  setMuted(!isMuted());
  mute.classList.toggle('on', isMuted());
});

const sfx = section('SFX');
for (const id of SFX_IDS) button(sfx, id, () => playSfx(id));

const pan = section('Pan');
button(pan, 'enemy_die_s left', () => playSfx('enemy_die_s', { pan: -1 }));
button(pan, 'enemy_die_s right', () => playSfx('enemy_die_s', { pan: 1 }));

const songs = section('Songs');
for (const id of SONG_IDS) button(songs, id, () => playSong(id));
for (const id of SONG_IDS) button(songs, `fade → ${id}`, () => fadeTo(id, 2));
button(songs, 'stop', () => stopMusic(0.5));

// Max-level loadout firing every tick: should hold at a few voices, not climb.
const stress = section('Stress');
let stressTimer = 0;
let stressEnd = 0;
const stressBtn = button(stress, 'All weapons, 30 s', () => {
  if (stressTimer) {
    clearInterval(stressTimer);
    stressTimer = 0;
    stressBtn.classList.remove('on');
    return;
  }
  stressEnd = performance.now() + 30_000;
  stressBtn.classList.add('on');
  let tick = 0;
  stressTimer = window.setInterval(() => {
    tick++;
    for (const id of ['shot_blaster', 'shot_spread', 'shot_lance', 'shot_seeker', 'drone_hit']) {
      playSfx(id, { pan: Math.sin(tick / 10) });
    }
    if (tick % 4 === 0) playSfx('enemy_hit');
    if (tick % 20 === 0) playSfx('enemy_die_s', { pan: Math.cos(tick) });
    if (tick % 45 === 0) playSfx('asteroid_break');
    if (performance.now() > stressEnd) stressBtn.click();
  }, 1000 / 60);
});

let peak = 0;
function updateStats(): void {
  const v = activeVoices();
  peak = Math.max(peak, v);
  stats.textContent = `voices ${v} (peak ${peak}) · song ${currentSong() ?? '—'}`;
  requestAnimationFrame(updateStats);
}
updateStats();
