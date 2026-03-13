/**
 * controllers/osInterface.js
 * Handles OS-level commands: launching apps, killing processes,
 * system power actions (lock, sleep, shutdown, restart),
 * volume control, and brightness adjustments.
 *
 * All commands are routed through Node.js child_process to the native OS shell.
 * Supports Windows, macOS, and Linux.
 */

'use strict';

const { exec, execSync } = require('child_process');
const os = require('os');

const PLATFORM = os.platform(); // 'win32' | 'darwin' | 'linux'

/**
 * Execute a shell command and return a Promise.
 * @param {string} cmd - The command string to execute.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${cmd}\n${error.message}`));
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

/**
 * Launch an application by name or path.
 * @param {string} target - Application name or executable path.
 */
async function launchApp(target) {
  let cmd;
  if (PLATFORM === 'win32') {
    cmd = `start "" "${target}"`;
  } else if (PLATFORM === 'darwin') {
    cmd = `open -a "${target}"`;
  } else {
    cmd = `"${target}" &`;
  }
  return runCommand(cmd);
}

/**
 * Force-kill a process by name.
 * @param {string} processName - e.g. "chrome.exe" or "Google Chrome"
 */
async function killProcess(processName) {
  let cmd;
  if (PLATFORM === 'win32') {
    cmd = `taskkill /F /IM "${processName}"`;
  } else if (PLATFORM === 'darwin') {
    cmd = `pkill -x "${processName}" || osascript -e 'quit app "${processName}"'`;
  } else {
    cmd = `pkill -x "${processName}"`;
  }
  return runCommand(cmd);
}

/**
 * List all running processes (abbreviated).
 */
async function listProcesses() {
  let cmd;
  if (PLATFORM === 'win32') {
    cmd = 'tasklist /FO CSV /NH';
  } else if (PLATFORM === 'darwin') {
    cmd = 'ps -eo pid,comm | head -40';
  } else {
    cmd = 'ps -eo pid,comm | head -40';
  }
  return runCommand(cmd);
}

/**
 * Lock the workstation / screen.
 */
async function lockScreen() {
  let cmd;
  if (PLATFORM === 'win32') {
    cmd = 'rundll32.exe user32.dll,LockWorkStation';
  } else if (PLATFORM === 'darwin') {
    cmd = 'osascript -e \'tell application "System Events" to keystroke "q" using {control down, command down}\'';
  } else {
    cmd = 'loginctl lock-session';
  }
  return runCommand(cmd);
}

/**
 * Put the computer to sleep.
 */
async function sleep() {
  let cmd;
  if (PLATFORM === 'win32') {
    cmd = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0';
  } else if (PLATFORM === 'darwin') {
    cmd = 'pmset sleepnow';
  } else {
    cmd = 'systemctl suspend';
  }
  return runCommand(cmd);
}

/**
 * Shut down the computer.
 */
async function shutdown() {
  let cmd;
  if (PLATFORM === 'win32') {
    cmd = 'shutdown /s /t 0';
  } else if (PLATFORM === 'darwin') {
    cmd = 'osascript -e \'tell app "System Events" to shut down\'';
  } else {
    cmd = 'shutdown -h now';
  }
  return runCommand(cmd);
}

/**
 * Restart the computer.
 */
async function restart() {
  let cmd;
  if (PLATFORM === 'win32') {
    cmd = 'shutdown /r /t 0';
  } else if (PLATFORM === 'darwin') {
    cmd = 'osascript -e \'tell app "System Events" to restart\'';
  } else {
    cmd = 'shutdown -r now';
  }
  return runCommand(cmd);
}

/**
 * Set the system volume (0–100).
 * @param {number} level - Volume level (0-100).
 */
async function setVolume(level) {
  const vol = Math.max(0, Math.min(100, parseInt(level, 10)));
  let cmd;
  if (PLATFORM === 'win32') {
    // Uses PowerShell to set master volume
    cmd = `powershell -Command "(New-Object -comObject WScript.Shell).SendKeys([char]174); Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class Audio { [DllImport(\\"winmm.dll\\")] public static extern int waveOutSetVolume(IntPtr h, uint dw); }'; [Audio]::waveOutSetVolume([IntPtr]::Zero, (${vol} * 65535 / 100) * 65537)"`;
  } else if (PLATFORM === 'darwin') {
    cmd = `osascript -e 'set volume output volume ${vol}'`;
  } else {
    cmd = `amixer -q sset Master ${vol}%`;
  }
  return runCommand(cmd);
}

/**
 * Mute or unmute the system audio.
 * @param {boolean} mute - true to mute, false to unmute.
 */
async function setMute(mute) {
  let cmd;
  if (PLATFORM === 'win32') {
    const key = mute ? '0' : '1';
    cmd = `powershell -Command "(New-Object -comObject WScript.Shell).SendKeys([char]173)"`;
  } else if (PLATFORM === 'darwin') {
    cmd = mute
      ? "osascript -e 'set volume with output muted'"
      : "osascript -e 'set volume without output muted'";
  } else {
    cmd = mute ? 'amixer -q sset Master mute' : 'amixer -q sset Master unmute';
  }
  return runCommand(cmd);
}

/**
 * Set display brightness (0–100). Works on laptops with supported drivers.
 * @param {number} level - Brightness level (0-100).
 */
async function setBrightness(level) {
  const br = Math.max(0, Math.min(100, parseInt(level, 10)));
  let cmd;
  if (PLATFORM === 'win32') {
    cmd = `powershell -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${br})"`;
  } else if (PLATFORM === 'darwin') {
    cmd = `osascript -e 'tell application "System Preferences" to set brightness to ${br / 100}'`;
  } else {
    cmd = `brightnessctl set ${br}%`;
  }
  return runCommand(cmd);
}

/**
 * Open a URL in the default browser.
 * @param {string} url
 */
async function openUrl(url) {
  let cmd;
  if (PLATFORM === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (PLATFORM === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  return runCommand(cmd);
}

/**
 * Open a folder in the native file explorer.
 * @param {string} dirPath - Absolute path to directory.
 */
async function openFolder(dirPath) {
  let cmd;
  if (PLATFORM === 'win32') {
    cmd = `explorer "${dirPath}"`;
  } else if (PLATFORM === 'darwin') {
    cmd = `open "${dirPath}"`;
  } else {
    cmd = `xdg-open "${dirPath}"`;
  }
  return runCommand(cmd);
}

/**
 * Execute an arbitrary shell command (advanced use).
 * @param {string} command - Raw shell command.
 */
async function executeCommand(command) {
  return runCommand(command);
}

/**
 * Get current platform info.
 */
function getPlatformInfo() {
  return {
    platform: PLATFORM,
    arch: os.arch(),
    hostname: os.hostname(),
    uptime: os.uptime(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
  };
}

module.exports = {
  launchApp,
  killProcess,
  listProcesses,
  lockScreen,
  sleep,
  shutdown,
  restart,
  setVolume,
  setMute,
  setBrightness,
  openUrl,
  openFolder,
  executeCommand,
  getPlatformInfo,
};
