/**
 * server.js — Project A.E.T.H.E.R. Backend Entry Point
 *
 * Serves the web dashboard and acts as the OS command bridge.
 * All communication with the frontend happens over Socket.io WebSockets.
 * The server ONLY binds to 127.0.0.1 — it is NEVER exposed to the internet.
 *
 * Command routing follows a strict JSON payload contract:
 *   { "module": "<module>", "action": "<action>", "params": { ... } }
 */

'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');

// ─── Controllers ─────────────────────────────────────────────────────────────
const osInterface = require('./controllers/osInterface');
const fileManager = require('./controllers/fileManager');
const macroController = require('./controllers/macroController');
const devOrchestrator = require('./controllers/devOrchestrator');
const telemetry = require('./controllers/telemetry');

// ─── LLM Router ──────────────────────────────────────────────────────────────
const { parseCommandWithLLM } = require('./controllers/llmRouter');

// ─── App Setup ───────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.use(cors({ origin: `http://${HOST}:${PORT}` }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── REST Health Check ───────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'operational',
    platform: osInterface.getPlatformInfo(),
    macroAvailable: macroController.isAvailable(),
    timestamp: new Date().toISOString(),
  });
});

// ─── Command Router ───────────────────────────────────────────────────────────
/**
 * Route a parsed command JSON to the correct controller function.
 * @param {{ module: string, action: string, params: Object }} cmd
 * @returns {Promise<any>}
 */
async function routeCommand(cmd) {
  const { module: mod, action, params = {} } = cmd;

  switch (mod) {
    // ── OS Interface ──────────────────────────────────────────────────────────
    case 'os':
      switch (action) {
        case 'launch_app':      return osInterface.launchApp(params.target);
        case 'kill_process':    return osInterface.killProcess(params.target);
        case 'list_processes':  return osInterface.listProcesses();
        case 'lock_screen':     return osInterface.lockScreen();
        case 'sleep':           return osInterface.sleep();
        case 'shutdown':        return osInterface.shutdown();
        case 'restart':         return osInterface.restart();
        case 'set_volume':      return osInterface.setVolume(params.level);
        case 'set_mute':        return osInterface.setMute(params.mute);
        case 'set_brightness':  return osInterface.setBrightness(params.level);
        case 'open_url':        return osInterface.openUrl(params.url);
        case 'open_folder':     return osInterface.openFolder(params.path);
        case 'execute_command': return osInterface.executeCommand(params.command);
        case 'platform_info':   return osInterface.getPlatformInfo();
        default: throw new Error(`Unknown os action: ${action}`);
      }

    // ── File Manager ──────────────────────────────────────────────────────────
    case 'files':
      switch (action) {
        case 'organise_directory':
          return fileManager.organiseDirectory(params.path, params.maxAgeDays);
        case 'scaffold_react_component':
          return fileManager.scaffoldReactComponent(params.projectSrc, params.componentName);
        case 'scaffold_node_project':
          return fileManager.scaffoldNodeProject(params.projectPath, params.projectName);
        case 'read_file':
          return { content: fileManager.readFile(params.path) };
        case 'write_file':
          fileManager.writeFile(params.path, params.content);
          return { success: true, path: params.path };
        case 'delete_path':
          fileManager.deletePath(params.path);
          return { success: true, path: params.path };
        case 'move_path':
          fileManager.movePath(params.src, params.dest);
          return { success: true };
        case 'list_directory':
          return fileManager.listDirectory(params.path);
        case 'search_files':
          return fileManager.searchFiles(params.rootDir, params.pattern);
        default: throw new Error(`Unknown files action: ${action}`);
      }

    // ── Macro Controller ──────────────────────────────────────────────────────
    case 'macro':
      switch (action) {
        case 'move_mouse':      return macroController.moveMouse(params.x, params.y);
        case 'click_mouse':     return macroController.clickMouse(params.x, params.y, params.button, params.doubleClick);
        case 'scroll_mouse':    return macroController.scrollMouse(params.x, params.y, params.magnitude);
        case 'type_string':     return macroController.typeString(params.text);
        case 'press_key':       return macroController.pressKey(params.key, params.modifiers);
        case 'toggle_key':      return macroController.toggleKey(params.key, params.direction);
        case 'play_pause':      return macroController.playPauseMedia();
        case 'next_track':      return macroController.nextTrack();
        case 'previous_track':  return macroController.previousTrack();
        case 'mute_toggle':     return macroController.muteToggle();
        case 'volume_up':       return macroController.volumeUp(params.steps);
        case 'volume_down':     return macroController.volumeDown(params.steps);
        case 'get_mouse_pos':   return macroController.getMousePosition();
        case 'get_screen_size': return macroController.getScreenSize();
        default: throw new Error(`Unknown macro action: ${action}`);
      }

    // ── Dev Orchestrator ──────────────────────────────────────────────────────
    case 'dev':
      switch (action) {
        case 'open_vscode':       return devOrchestrator.openInVSCode(params.path, params.newWindow);
        case 'open_chrome':       return devOrchestrator.openInChrome(params.url);
        case 'npm_script':        return devOrchestrator.runNpmScript(params.projectDir, params.script);
        case 'npm_install':       return devOrchestrator.npmInstall(params.projectDir);
        case 'build_project':     return devOrchestrator.buildProject(params.projectDir);
        case 'git_status':        return devOrchestrator.gitStatus(params.repoDir);
        case 'git_commit':        return devOrchestrator.gitCommit(params.repoDir, params.message);
        case 'git_push':          return devOrchestrator.gitPush(params.repoDir, params.remote, params.branch);
        case 'git_pull':          return devOrchestrator.gitPull(params.repoDir, params.remote, params.branch);
        case 'git_commit_push':   return devOrchestrator.gitCommitAndPush(params.repoDir, params.message, params.remote, params.branch);
        case 'git_log':           return devOrchestrator.gitLog(params.repoDir, params.n);
        case 'git_checkout':      return devOrchestrator.gitCheckoutNewBranch(params.repoDir, params.branch);
        case 'docker_up':         return devOrchestrator.dockerComposeUp(params.projectDir);
        case 'docker_down':       return devOrchestrator.dockerComposeDown(params.projectDir);
        case 'docker_restart':    return devOrchestrator.dockerRestart(params.container);
        case 'docker_ps':         return devOrchestrator.dockerPs();
        case 'init_workspace':    return devOrchestrator.initWorkspace(params);
        default: throw new Error(`Unknown dev action: ${action}`);
      }

    // ── Telemetry ─────────────────────────────────────────────────────────────
    case 'telemetry':
      switch (action) {
        case 'snapshot': return telemetry.getSnapshot();
        default: throw new Error(`Unknown telemetry action: ${action}`);
      }

    default:
      throw new Error(`Unknown module: ${mod}`);
  }
}

// ─── Socket.io Events ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] Client connected: ${socket.id}`);

  socket.emit('ready', {
    message: "A.E.T.H.E.R. online. How can I assist you?",
    platform: osInterface.getPlatformInfo(),
    macroAvailable: macroController.isAvailable(),
  });

  // ── Voice / Text command (natural language) ──────────────────────────────
  socket.on('voice_input', async (data) => {
    const { transcript } = data;
    if (!transcript || typeof transcript !== 'string') return;

    console.log(`[voice] Received: "${transcript}"`);

    try {
      // Step 1: Parse intent via LLM
      const command = await parseCommandWithLLM(transcript);
      console.log('[voice] Parsed command:', JSON.stringify(command));

      // Step 2: Route command to the right controller
      const result = await routeCommand(command);
      console.log('[voice] Result:', JSON.stringify(result));

      socket.emit('command_result', {
        success: true,
        transcript,
        command,
        result,
        response: generateVoiceResponse(command, result),
      });
    } catch (err) {
      console.error('[voice] Error:', err.message);
      socket.emit('command_result', {
        success: false,
        transcript,
        error: err.message,
        response: `I encountered an error: ${err.message}`,
      });
    }
  });

  // ── Direct JSON command (programmatic / debug) ────────────────────────────
  socket.on('direct_command', async (command) => {
    console.log('[direct] Command:', JSON.stringify(command));
    try {
      const result = await routeCommand(command);
      socket.emit('command_result', {
        success: true,
        command,
        result,
        response: generateVoiceResponse(command, result),
      });
    } catch (err) {
      console.error('[direct] Error:', err.message);
      socket.emit('command_result', {
        success: false,
        command,
        error: err.message,
        response: `Command failed: ${err.message}`,
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[socket] Client disconnected: ${socket.id}`);
  });
});

// ─── Voice Response Generator ─────────────────────────────────────────────────
/**
 * Generate a human-readable TTS response based on the executed command.
 * @param {{ module: string, action: string }} cmd
 * @param {*} result
 * @returns {string}
 */
function generateVoiceResponse(cmd, result) {
  const { module: mod, action } = cmd;

  const responses = {
    'os.lock_screen':    'Screen locked, sir.',
    'os.sleep':          'Initiating sleep mode.',
    'os.shutdown':       'Shutting down. Goodbye.',
    'os.restart':        'Restarting the system.',
    'os.launch_app':     `Launching application.`,
    'os.kill_process':   `Process terminated.`,
    'os.set_volume':     `Volume adjusted.`,
    'os.set_mute':       `Audio muted.`,
    'os.open_url':       `Opening URL in the browser.`,
    'os.open_folder':    `Opening folder.`,
    'files.organise_directory': 'Directory organised successfully.',
    'files.scaffold_react_component': 'React component scaffolded.',
    'files.scaffold_node_project': 'Node.js project scaffolded.',
    'macro.play_pause':  'Media playback toggled.',
    'macro.next_track':  'Skipping to the next track.',
    'macro.mute_toggle': 'Microphone toggled.',
    'dev.init_workspace': 'Workspace initialised. All systems ready.',
    'dev.git_commit_push': 'Changes committed and pushed.',
    'dev.npm_script': 'Script executed successfully.',
    'dev.docker_up': 'Docker containers are now running.',
    'dev.docker_down': 'Docker containers stopped.',
  };

  return responses[`${mod}.${action}`] || `Task completed successfully.`;
}

// ─── Start Telemetry Loop ─────────────────────────────────────────────────────
const telemetryInterval = telemetry.startTelemetryLoop(io, 2000);

// ─── Start Server ────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  const label = `  Dashboard: ${url}`;
  const width = Math.max(44, label.length + 4);
  const bar   = '═'.repeat(width);
  const pad   = (s) => s + ' '.repeat(width - s.length + 1) + '║';
  console.log(`\n  ╔${bar}╗`);
  console.log(`  ║${pad('  Project A.E.T.H.E.R. is ONLINE')}`);
  console.log(`  ║${pad(label)}`);
  console.log(`  ╚${bar}╝\n`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
function shutdown() {
  console.log('\n[server] Shutting down gracefully...');
  clearInterval(telemetryInterval);
  io.close();
  server.close(() => {
    console.log('[server] HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
