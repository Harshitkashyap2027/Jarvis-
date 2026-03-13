/**
 * controllers/macroController.js
 * Hardware-level macro simulation: mouse movement, clicking, keyboard input,
 * and media key presses. Requires the optional robotjs or @jitsi/robotjs package.
 *
 * If neither package is available the module gracefully degrades and
 * every function returns a clear "not available" error so the rest of
 * the application keeps running.
 */

'use strict';

let robot = null;

// Attempt to load robotjs (optional native dependency)
try {
  robot = require('@jitsi/robotjs');
} catch (_e1) {
  try {
    robot = require('robotjs');
  } catch (_e2) {
    // Neither package available — graceful degradation
    robot = null;
  }
}

/**
 * Check whether macro control is available.
 * @returns {boolean}
 */
function isAvailable() {
  return robot !== null;
}

function requireRobot() {
  if (!robot) {
    throw new Error(
      'Macro control is not available. Install "@jitsi/robotjs" or "robotjs" and enable ENABLE_MACRO_CONTROL=true in your .env file.'
    );
  }
}

/**
 * Move the mouse cursor to absolute screen coordinates.
 * @param {number} x
 * @param {number} y
 */
function moveMouse(x, y) {
  requireRobot();
  robot.moveMouse(x, y);
  return { x, y };
}

/**
 * Click at absolute screen coordinates.
 * @param {number} x
 * @param {number} y
 * @param {'left'|'right'|'middle'} [button='left']
 * @param {boolean} [doubleClick=false]
 */
function clickMouse(x, y, button = 'left', doubleClick = false) {
  requireRobot();
  robot.moveMouse(x, y);
  if (doubleClick) {
    robot.mouseClick(button, true);
  } else {
    robot.mouseClick(button);
  }
  return { x, y, button, doubleClick };
}

/**
 * Scroll the mouse wheel.
 * @param {number} x
 * @param {number} y
 * @param {number} scrollMagnitude - Positive scrolls down, negative scrolls up.
 */
function scrollMouse(x, y, scrollMagnitude) {
  requireRobot();
  robot.moveMouse(x, y);
  robot.scrollMouse(0, scrollMagnitude);
  return { x, y, scrollMagnitude };
}

/**
 * Type a string of text at the current cursor position.
 * @param {string} text
 */
function typeString(text) {
  requireRobot();
  robot.typeString(text);
  return { text };
}

/**
 * Press a single key (with optional modifiers).
 * @param {string} key - Key name (e.g. 'space', 'enter', 'a').
 * @param {string[]} [modifiers=[]] - e.g. ['control', 'shift']
 */
function pressKey(key, modifiers = []) {
  requireRobot();
  robot.keyTap(key, modifiers);
  return { key, modifiers };
}

/**
 * Hold or release a key.
 * @param {string} key
 * @param {'down'|'up'} direction
 */
function toggleKey(key, direction) {
  requireRobot();
  robot.keyToggle(key, direction);
  return { key, direction };
}

/**
 * Get the current mouse cursor position.
 * @returns {{ x: number, y: number }}
 */
function getMousePosition() {
  requireRobot();
  return robot.getMousePos();
}

/**
 * Get the pixel colour at screen coordinates.
 * @param {number} x
 * @param {number} y
 * @returns {string} Hex colour string.
 */
function getPixelColour(x, y) {
  requireRobot();
  return robot.getPixelColor(x, y);
}

/**
 * Get the screen dimensions.
 * @returns {{ width: number, height: number }}
 */
function getScreenSize() {
  requireRobot();
  return robot.getScreenSize();
}

// ─── Convenience Media Key Helpers ──────────────────────────────────────────

/**
 * Simulate pressing the Play/Pause media key.
 */
function playPauseMedia() {
  requireRobot();
  robot.keyTap('audio_play');
  return { action: 'play_pause' };
}

/**
 * Simulate pressing the Next Track media key.
 */
function nextTrack() {
  requireRobot();
  robot.keyTap('audio_next');
  return { action: 'next_track' };
}

/**
 * Simulate pressing the Previous Track media key.
 */
function previousTrack() {
  requireRobot();
  robot.keyTap('audio_prev');
  return { action: 'previous_track' };
}

/**
 * Simulate pressing the Mute key.
 */
function muteToggle() {
  requireRobot();
  robot.keyTap('audio_mute');
  return { action: 'mute_toggle' };
}

/**
 * Simulate volume up.
 * @param {number} [steps=3]
 */
function volumeUp(steps = 3) {
  requireRobot();
  for (let i = 0; i < steps; i++) robot.keyTap('audio_vol_up');
  return { action: 'volume_up', steps };
}

/**
 * Simulate volume down.
 * @param {number} [steps=3]
 */
function volumeDown(steps = 3) {
  requireRobot();
  for (let i = 0; i < steps; i++) robot.keyTap('audio_vol_down');
  return { action: 'volume_down', steps };
}

module.exports = {
  isAvailable,
  moveMouse,
  clickMouse,
  scrollMouse,
  typeString,
  pressKey,
  toggleKey,
  getMousePosition,
  getPixelColour,
  getScreenSize,
  playPauseMedia,
  nextTrack,
  previousTrack,
  muteToggle,
  volumeUp,
  volumeDown,
};
