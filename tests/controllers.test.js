/**
 * tests/controllers.test.js
 * Unit tests for A.E.T.H.E.R. backend controllers.
 * Uses Node.js built-in test runner (node --test).
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ─── fileManager tests ────────────────────────────────────────────────────────
describe('fileManager', () => {
  const fileManager = require('../controllers/fileManager');
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ensureDir creates nested directories', () => {
    const nested = path.join(tmpDir, 'a', 'b', 'c');
    fileManager.ensureDir(nested);
    assert.ok(fs.existsSync(nested), 'Nested dirs should exist');
  });

  it('writeFile and readFile round-trip', () => {
    const filePath = path.join(tmpDir, 'test.txt');
    fileManager.writeFile(filePath, 'hello aether');
    const content = fileManager.readFile(filePath);
    assert.equal(content, 'hello aether');
  });

  it('readFile throws on missing file', () => {
    assert.throws(
      () => fileManager.readFile(path.join(tmpDir, 'nonexistent.txt')),
      /File not found/
    );
  });

  it('listDirectory returns correct entries', () => {
    const dir = path.join(tmpDir, 'listtest');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'file1.txt'), 'a');
    fs.writeFileSync(path.join(dir, 'file2.js'), 'b');
    const entries = fileManager.listDirectory(dir);
    assert.equal(entries.length, 2);
    assert.ok(entries.every((e) => e.type === 'file'));
  });

  it('listDirectory throws on missing directory', () => {
    assert.throws(
      () => fileManager.listDirectory(path.join(tmpDir, 'missing')),
      /Directory not found/
    );
  });

  it('movePath moves a file', () => {
    const src  = path.join(tmpDir, 'move_src.txt');
    const dest = path.join(tmpDir, 'move_dest.txt');
    fs.writeFileSync(src, 'move me');
    fileManager.movePath(src, dest);
    assert.ok(!fs.existsSync(src),  'Source should be gone');
    assert.ok(fs.existsSync(dest), 'Dest should exist');
  });

  it('movePath throws on missing source', () => {
    assert.throws(
      () => fileManager.movePath(path.join(tmpDir, 'nope.txt'), path.join(tmpDir, 'also-nope.txt')),
      /Source not found/
    );
  });

  it('deletePath removes a file', () => {
    const file = path.join(tmpDir, 'del.txt');
    fs.writeFileSync(file, 'delete me');
    fileManager.deletePath(file);
    assert.ok(!fs.existsSync(file), 'File should be deleted');
  });

  it('searchFiles finds matching filenames', () => {
    const dir = path.join(tmpDir, 'search');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'report.pdf'), '');
    fs.writeFileSync(path.join(dir, 'image.png'), '');
    const results = fileManager.searchFiles(dir, 'report');
    assert.equal(results.length, 1);
    assert.ok(results[0].endsWith('report.pdf'));
  });

  it('organiseDirectory moves files to categorised subfolders', () => {
    const orgDir = path.join(tmpDir, 'orgtest');
    fs.mkdirSync(orgDir);
    fs.writeFileSync(path.join(orgDir, 'doc.pdf'), '');
    fs.writeFileSync(path.join(orgDir, 'clip.mp4'), '');
    fs.writeFileSync(path.join(orgDir, 'song.mp3'), '');

    const report = fileManager.organiseDirectory(orgDir, 30);

    assert.ok(report.moved.some((m) => m.includes('doc.pdf')));
    assert.ok(report.moved.some((m) => m.includes('clip.mp4')));
    assert.ok(report.moved.some((m) => m.includes('song.mp3')));
    assert.ok(fs.existsSync(path.join(orgDir, 'Documents/PDFs', 'doc.pdf')));
    assert.ok(fs.existsSync(path.join(orgDir, 'Videos', 'clip.mp4')));
    assert.ok(fs.existsSync(path.join(orgDir, 'Audio', 'song.mp3')));
  });

  it('organiseDirectory throws on missing directory', () => {
    assert.throws(
      () => fileManager.organiseDirectory(path.join(tmpDir, 'nodir')),
      /does not exist/
    );
  });

  it('scaffoldReactComponent creates jsx and css files', () => {
    const src = path.join(tmpDir, 'react-src');
    fs.mkdirSync(src);
    const { jsx, css } = fileManager.scaffoldReactComponent(src, 'Dashboard');
    assert.ok(fs.existsSync(jsx), 'JSX file should exist');
    assert.ok(fs.existsSync(css), 'CSS file should exist');
    const jsxContent = fs.readFileSync(jsx, 'utf8');
    assert.ok(jsxContent.includes('Dashboard'), 'JSX should contain component name');
  });

  it('scaffoldNodeProject creates expected files', () => {
    const projDir = path.join(tmpDir, 'nodeproj');
    fileManager.scaffoldNodeProject(projDir, 'TestProject');
    assert.ok(fs.existsSync(path.join(projDir, 'package.json')));
    assert.ok(fs.existsSync(path.join(projDir, 'src', 'index.js')));
    assert.ok(fs.existsSync(path.join(projDir, 'README.md')));
  });
});

// ─── macroController tests ───────────────────────────────────────────────────
describe('macroController', () => {
  const macroController = require('../controllers/macroController');

  it('isAvailable() returns a boolean', () => {
    assert.equal(typeof macroController.isAvailable(), 'boolean');
  });

  it('functions throw a descriptive error when robotjs is unavailable', () => {
    if (macroController.isAvailable()) return; // Skip if robotjs is present

    const fns = [
      () => macroController.moveMouse(0, 0),
      () => macroController.clickMouse(0, 0),
      () => macroController.typeString('test'),
      () => macroController.pressKey('a'),
      () => macroController.playPauseMedia(),
      () => macroController.muteToggle(),
    ];
    for (const fn of fns) {
      assert.throws(fn, /Macro control is not available/);
    }
  });
});

// ─── osInterface tests ────────────────────────────────────────────────────────
describe('osInterface', () => {
  const osInterface = require('../controllers/osInterface');

  it('getPlatformInfo() returns expected keys', () => {
    const info = osInterface.getPlatformInfo();
    assert.ok('platform' in info);
    assert.ok('arch' in info);
    assert.ok('hostname' in info);
    assert.ok('uptime' in info);
    assert.ok('totalMemory' in info);
    assert.ok('freeMemory' in info);
  });

  it('getPlatformInfo().platform is one of the known values', () => {
    const { platform } = osInterface.getPlatformInfo();
    assert.ok(['win32', 'darwin', 'linux'].includes(platform));
  });
});

// ─── telemetry tests ─────────────────────────────────────────────────────────
describe('telemetry', () => {
  const telemetry = require('../controllers/telemetry');

  it('getSnapshot() resolves to an object', async () => {
    const snapshot = await telemetry.getSnapshot();
    assert.equal(typeof snapshot, 'object');
    assert.ok('available' in snapshot);
  });

  it('getSnapshot() includes a timestamp when data is available', async () => {
    const snapshot = await telemetry.getSnapshot();
    if (snapshot.available) {
      assert.ok(typeof snapshot.timestamp === 'number');
    }
  });
});

// ─── llmRouter tests ─────────────────────────────────────────────────────────
describe('llmRouter', () => {
  const { parseCommandWithLLM } = require('../controllers/llmRouter');

  it('returns fallback command when no API key is configured', async () => {
    // Ensure no API key is set so we hit the error path → fallback
    const origKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = '';

    const cmd = await parseCommandWithLLM('lock the screen');
    assert.ok(typeof cmd === 'object');
    assert.ok('module' in cmd);
    assert.ok('action' in cmd);
    assert.ok('params' in cmd);

    process.env.OPENAI_API_KEY = origKey;
  });
});
