import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();

test('Simplified Single-Player HUD in src/App.tsx excludes speed sliders, notation script bar, and multiplayer lobby', () => {
  const appTsx = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');

  // Must include simplified game & camera controls
  for (const requiredId of [
    'btn-side-toggle',
    'btn-ai-move',
    'btn-reset',
    'btn-cam-player',
    'btn-cam-top',
    'btn-cam-side',
    'btn-cam-wide',
    'btn-hide-ui',
    'btn-history-toggle',
    'history-sidebar',
    'hist-cap-white-count',
    'hist-cap-black-count',
    'assopradas-panel',
    'assopradas-list',
    'moves-history-list',
    'controls-hint',
    'captured-tray'
  ]) {
    assert.ok(appTsx.includes(`id="${requiredId}"`), `Missing required HUD control #${requiredId}`);
  }

  // Must NOT include camera speed sliders, script mode bar, or multiplayer lobby
  for (const forbiddenId of [
    'cam-speed-wrap',
    'input-cam-speed',
    'rot-speed-wrap',
    'input-rot-speed',
    'script-bar',
    'btn-script-modal',
    'btn-script-prev',
    'btn-script-next',
    'btn-lobby',
    'lobby-modal',
    'room-pill',
    'btn-checkmate-stepback'
  ]) {
    assert.ok(!appTsx.includes(forbiddenId), `Forbidden UI element #${forbiddenId} found in App.tsx`);
  }
});

test('All 7 compressed 3D assets (.glb.gz.b64) decode and gunzip to valid glTF 2.0 binary models', () => {
  const expectedModels = [
    'option8_cathedral',
    'pawn_white',
    'rook_white',
    'knight_white',
    'bishop_white',
    'queen_white',
    'king_white'
  ];

  for (const name of expectedModels) {
    const b64Path = path.join(ROOT, 'public/assets/glb', `${name}.glb.gz.b64`);
    assert.ok(fs.existsSync(b64Path), `Missing 3D asset ${b64Path}`);
    const b64Text = fs.readFileSync(b64Path, 'utf-8').trim();
    assert.ok(b64Text.length > 1000, `Asset ${name}.glb.gz.b64 is unexpectedly small`);

    const gzBuf = Buffer.from(b64Text, 'base64');
    const glbBuf = zlib.gunzipSync(gzBuf);

    const magic = glbBuf.toString('ascii', 0, 4);
    const version = glbBuf.readUInt32LE(4);
    const totalLen = glbBuf.readUInt32LE(8);
    assert.equal(magic, 'glTF', `Invalid glTF magic header for ${name}`);
    assert.equal(version, 2, `Invalid glTF version for ${name}`);
    assert.equal(totalLen, glbBuf.length, `Mismatched glTF byte length for ${name}`);
  }
});

test('Brazilian Checkers 8x8 rules and Golden Queen Dama coronation are implemented in wizardChessEngine.js', () => {
  const engineSrc = fs.readFileSync(path.join(ROOT, 'src/wizardChessEngine.js'), 'utf-8');
  assert.ok(engineSrc.includes("const PIECE_TYPES = ['pawn', 'queen']"), 'Should restrict active pieces to pawn (Pedra) and queen (Dama)');
  assert.ok(engineSrc.includes('getCaptureTreesForPiece'), 'Should implement recursive capture tree search');
  assert.ok(engineSrc.includes('getGlobalMaxCapturesForColor'), 'Should implement Lei da Maioria capture sequence calculation');
  assert.ok(engineSrc.includes('spawnCoronationBurst'), 'Should implement coronation into Golden Queen Dama');
  assert.ok(engineSrc.includes('spawnCaptureMagicParticles'), 'Should implement 3D magic dust and golden sparks particle system on capture');
  assert.ok(engineSrc.includes('playStoneShatterAndSparksSound'), 'Should implement procedural Web Audio API sound effects for stone shatter and sparks');
  assert.ok(engineSrc.includes('toggleSound'), 'Should implement sound mute/unmute toggle');
  assert.ok(engineSrc.includes('assoprarPedra'), 'Should implement Regra do Assopro (blowing away the stone that failed to capture)');
  assert.ok(engineSrc.includes('getPiecesWithCaptureAvailable'), 'Should detect pieces that had a capture available before a non-capture move');
  assert.ok(engineSrc.includes('updateHistorySidebarUI'), 'Should update the lateral move history and assopradas sidebar UI');
  assert.ok(engineSrc.includes('assopradasHistory'), 'Should maintain a dedicated list of blown-away (assopradas) stones');
  assert.ok(engineSrc.includes('CaptureLightAndSparkEmitterGroup'), 'Should create a 3D group of light emitters and golden sparks at the capture location');
  assert.ok(engineSrc.includes('lightEmitters') && engineSrc.includes('sparkStreaks') && engineSrc.includes('sharedShardVectors'), 'Should coordinate light emitters and 3D golden spark streaks with stone shatter physics');
});

