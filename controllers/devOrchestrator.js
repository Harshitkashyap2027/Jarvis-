/**
 * controllers/devOrchestrator.js
 * Development workflow automation: VS Code, Git operations, npm scripts,
 * Docker management, and multi-process workspace initialisation.
 */

'use strict';

const { exec } = require('child_process');
const os = require('os');
const path = require('path');

const PLATFORM = os.platform();

/**
 * Execute a shell command and return a Promise.
 * @param {string} cmd
 * @param {Object} [options]
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runCommand(cmd, options = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 60000, ...options }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${cmd}\n${error.message}\n${stderr}`));
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

// ─── VS Code ────────────────────────────────────────────────────────────────

/**
 * Open a file or directory in VS Code.
 * @param {string} targetPath - Absolute path to open.
 * @param {boolean} [newWindow=false]
 */
async function openInVSCode(targetPath, newWindow = false) {
  const flag = newWindow ? '--new-window' : '';
  return runCommand(`code ${flag} "${targetPath}"`);
}

// ─── Browser ────────────────────────────────────────────────────────────────

/**
 * Open a URL in Google Chrome (or the default browser as fallback).
 * @param {string} url
 */
async function openInChrome(url) {
  let cmd;
  if (PLATFORM === 'win32') {
    cmd = `start chrome "${url}"`;
  } else if (PLATFORM === 'darwin') {
    cmd = `open -a "Google Chrome" "${url}"`;
  } else {
    cmd = `google-chrome "${url}" || chromium-browser "${url}"`;
  }
  return runCommand(cmd);
}

// ─── Terminal / Process ──────────────────────────────────────────────────────

/**
 * Run an npm script inside a project directory.
 * @param {string} projectDir - Absolute path to the npm project.
 * @param {string} script - npm script name (e.g. 'start', 'build', 'test').
 */
async function runNpmScript(projectDir, script) {
  return runCommand(`npm run ${script}`, { cwd: projectDir });
}

/**
 * Install npm dependencies in a project directory.
 * @param {string} projectDir
 */
async function npmInstall(projectDir) {
  return runCommand('npm install', { cwd: projectDir });
}

/**
 * Run a build in a project directory.
 * @param {string} projectDir
 */
async function buildProject(projectDir) {
  return runNpmScript(projectDir, 'build');
}

// ─── Git Operations ──────────────────────────────────────────────────────────

/**
 * Get the current git status of a repository.
 * @param {string} repoDir
 */
async function gitStatus(repoDir) {
  return runCommand('git status --short', { cwd: repoDir });
}

/**
 * Stage all changes and commit with a message.
 * @param {string} repoDir
 * @param {string} message - Commit message.
 */
async function gitCommit(repoDir, message) {
  await runCommand('git add -A', { cwd: repoDir });
  return runCommand(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: repoDir });
}

/**
 * Push the current branch to a remote.
 * @param {string} repoDir
 * @param {string} [remote='origin']
 * @param {string} [branch=''] - If empty, pushes the current branch.
 */
async function gitPush(repoDir, remote = 'origin', branch = '') {
  const branchArg = branch ? ` ${branch}` : '';
  return runCommand(`git push ${remote}${branchArg}`, { cwd: repoDir });
}

/**
 * Pull the latest changes from a remote.
 * @param {string} repoDir
 * @param {string} [remote='origin']
 * @param {string} [branch=''] - If empty, pulls the current branch.
 */
async function gitPull(repoDir, remote = 'origin', branch = '') {
  const branchArg = branch ? ` ${remote} ${branch}` : '';
  return runCommand(`git pull${branchArg}`, { cwd: repoDir });
}

/**
 * Stage, commit, and push in one go.
 * @param {string} repoDir
 * @param {string} message
 * @param {string} [remote='origin']
 * @param {string} [branch='']
 */
async function gitCommitAndPush(repoDir, message, remote = 'origin', branch = '') {
  await gitCommit(repoDir, message);
  return gitPush(repoDir, remote, branch);
}

/**
 * Get the git log (last N commits).
 * @param {string} repoDir
 * @param {number} [n=10]
 */
async function gitLog(repoDir, n = 10) {
  return runCommand(`git log --oneline -${n}`, { cwd: repoDir });
}

/**
 * Create and switch to a new branch.
 * @param {string} repoDir
 * @param {string} branchName
 */
async function gitCheckoutNewBranch(repoDir, branchName) {
  return runCommand(`git checkout -b "${branchName}"`, { cwd: repoDir });
}

// ─── Docker ──────────────────────────────────────────────────────────────────

/**
 * Run docker-compose up (detached) in a project directory.
 * @param {string} projectDir
 */
async function dockerComposeUp(projectDir) {
  return runCommand('docker-compose up -d', { cwd: projectDir });
}

/**
 * Run docker-compose down in a project directory.
 * @param {string} projectDir
 */
async function dockerComposeDown(projectDir) {
  return runCommand('docker-compose down', { cwd: projectDir });
}

/**
 * Restart a specific Docker container.
 * @param {string} containerName
 */
async function dockerRestart(containerName) {
  return runCommand(`docker restart "${containerName}"`);
}

/**
 * List running Docker containers.
 */
async function dockerPs() {
  return runCommand('docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"');
}

// ─── Workspace Initialisation ────────────────────────────────────────────────

/**
 * Initialize a full development workspace: open VS Code, start a server,
 * launch browser, optionally start database.
 *
 * @param {Object} config
 * @param {string} config.projectDir - Absolute path to the project.
 * @param {string} [config.startScript='start'] - npm script to start the server.
 * @param {string} [config.browserUrl='http://localhost:3000'] - URL to open.
 * @param {boolean} [config.openVSCode=true]
 * @param {boolean} [config.openBrowser=true]
 * @param {boolean} [config.runDockerCompose=false]
 */
async function initWorkspace(config) {
  const {
    projectDir,
    startScript = 'start',
    browserUrl = 'http://localhost:3000',
    openVSCode = true,
    openBrowser = true,
    runDockerCompose = false,
  } = config;

  const results = {};

  if (runDockerCompose) {
    try {
      results.docker = await dockerComposeUp(projectDir);
    } catch (err) {
      results.docker = { error: err.message };
    }
  }

  if (openVSCode) {
    try {
      results.vscode = await openInVSCode(projectDir);
    } catch (err) {
      results.vscode = { error: err.message };
    }
  }

  if (openBrowser) {
    try {
      results.browser = await openInChrome(browserUrl);
    } catch (err) {
      results.browser = { error: err.message };
    }
  }

  return results;
}

module.exports = {
  openInVSCode,
  openInChrome,
  runNpmScript,
  npmInstall,
  buildProject,
  gitStatus,
  gitCommit,
  gitPush,
  gitPull,
  gitCommitAndPush,
  gitLog,
  gitCheckoutNewBranch,
  dockerComposeUp,
  dockerComposeDown,
  dockerRestart,
  dockerPs,
  initWorkspace,
};
