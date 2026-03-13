/**
 * controllers/llmRouter.js
 * Translates natural-language voice transcripts into structured JSON
 * command objects using an LLM API (OpenAI, Gemini, or Anthropic).
 *
 * The LLM is strictly instructed to reply ONLY with valid JSON in the form:
 *   { "module": "<module>", "action": "<action>", "params": { ... } }
 *
 * Valid modules: os | files | macro | dev | telemetry
 */

'use strict';

const SYSTEM_PROMPT = `
You are the command-routing brain of Project A.E.T.H.E.R., a JARVIS-style OS assistant.
Your ONLY job is to convert a user's natural-language instruction into a single, strictly
formatted JSON command object. You must NEVER reply with conversational text.

The JSON must ALWAYS have this exact shape:
{
  "module": "<module>",
  "action": "<action>",
  "params": { ...relevant parameters... }
}

Available modules and actions:

MODULE: os
  launch_app       — params: { target: string }
  kill_process     — params: { target: string }
  list_processes   — params: {}
  lock_screen      — params: {}
  sleep            — params: {}
  shutdown         — params: {}
  restart          — params: {}
  set_volume       — params: { level: number (0-100) }
  set_mute         — params: { mute: boolean }
  set_brightness   — params: { level: number (0-100) }
  open_url         — params: { url: string }
  open_folder      — params: { path: string }
  execute_command  — params: { command: string }
  platform_info    — params: {}

MODULE: files
  organise_directory          — params: { path: string, maxAgeDays?: number }
  scaffold_react_component    — params: { projectSrc: string, componentName: string }
  scaffold_node_project       — params: { projectPath: string, projectName: string }
  read_file                   — params: { path: string }
  write_file                  — params: { path: string, content: string }
  delete_path                 — params: { path: string }
  move_path                   — params: { src: string, dest: string }
  list_directory              — params: { path: string }
  search_files                — params: { rootDir: string, pattern: string }

MODULE: macro
  play_pause      — params: {}
  next_track      — params: {}
  previous_track  — params: {}
  mute_toggle     — params: {}
  volume_up       — params: { steps?: number }
  volume_down     — params: { steps?: number }
  move_mouse      — params: { x: number, y: number }
  click_mouse     — params: { x: number, y: number, button?: string }
  type_string     — params: { text: string }
  press_key       — params: { key: string, modifiers?: string[] }

MODULE: dev
  open_vscode           — params: { path: string, newWindow?: boolean }
  open_chrome           — params: { url: string }
  npm_script            — params: { projectDir: string, script: string }
  npm_install           — params: { projectDir: string }
  build_project         — params: { projectDir: string }
  git_status            — params: { repoDir: string }
  git_commit            — params: { repoDir: string, message: string }
  git_push              — params: { repoDir: string, remote?: string, branch?: string }
  git_pull              — params: { repoDir: string, remote?: string, branch?: string }
  git_commit_push       — params: { repoDir: string, message: string, remote?: string, branch?: string }
  git_log               — params: { repoDir: string, n?: number }
  git_checkout          — params: { repoDir: string, branch: string }
  docker_up             — params: { projectDir: string }
  docker_down           — params: { projectDir: string }
  docker_restart        — params: { container: string }
  docker_ps             — params: {}
  init_workspace        — params: { projectDir: string, startScript?: string, browserUrl?: string, openVSCode?: boolean, openBrowser?: boolean, runDockerCompose?: boolean }

MODULE: telemetry
  snapshot  — params: {}

If the user's request is unclear or does not map to any of the above, return:
{ "module": "os", "action": "platform_info", "params": {} }

Respond with ONLY the JSON. No markdown. No explanation. No code fences.
`.trim();

// ─── OpenAI ──────────────────────────────────────────────────────────────────
async function parseWithOpenAI(transcript) {
  const { default: OpenAI } = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: transcript },
    ],
    temperature: 0,
    max_tokens: 300,
    response_format: { type: 'json_object' },
  });

  return completion.choices[0].message.content;
}

// ─── Google Gemini ────────────────────────────────────────────────────────────
async function parseWithGemini(transcript) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent(
    `${SYSTEM_PROMPT}\n\nUser: ${transcript}`
  );
  return result.response.text();
}

// ─── Anthropic Claude ─────────────────────────────────────────────────────────
async function parseWithAnthropic(transcript) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: transcript }],
  });

  return message.content[0].text;
}

/**
 * Parse a natural-language transcript into a structured command object
 * using the configured LLM provider.
 *
 * @param {string} transcript - User's voice/text input.
 * @returns {Promise<{ module: string, action: string, params: Object }>}
 */
async function parseCommandWithLLM(transcript) {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

  let rawJson;

  try {
    switch (provider) {
      case 'gemini':
        rawJson = await parseWithGemini(transcript);
        break;
      case 'anthropic':
        rawJson = await parseWithAnthropic(transcript);
        break;
      case 'openai':
      default:
        rawJson = await parseWithOpenAI(transcript);
        break;
    }

    // Strip potential markdown fences if the LLM misbehaves
    const cleaned = rawJson.replace(/```(?:json)?/gi, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.module || !parsed.action) {
      throw new Error('LLM returned invalid command structure.');
    }

    return {
      module: parsed.module,
      action: parsed.action,
      params: parsed.params || {},
    };
  } catch (err) {
    console.error('[llmRouter] Parsing error:', err.message);
    // Fallback: return platform_info so the UI gets at least some response
    return { module: 'telemetry', action: 'snapshot', params: {} };
  }
}

module.exports = { parseCommandWithLLM };
