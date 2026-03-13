/**
 * controllers/telemetry.js
 * Real-time system diagnostics: CPU temperature & usage, RAM, GPU,
 * disk, and network — powered by the systeminformation package.
 *
 * The main export is startTelemetryLoop(), which streams data to
 * all connected Socket.io clients on a configurable interval.
 */

'use strict';

let si;
try {
  si = require('systeminformation');
} catch (_err) {
  si = null;
}

/**
 * Gather a full snapshot of system metrics.
 * Falls back gracefully if systeminformation is not available.
 * @returns {Promise<Object>}
 */
async function getSnapshot() {
  if (!si) {
    return {
      available: false,
      message: 'systeminformation package not installed.',
    };
  }

  try {
    const [cpu, mem, temp, disk, net, gpu, load] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.cpuTemperature(),
      si.fsSize(),
      si.networkStats(),
      si.graphics(),
      si.currentLoad(),
    ]);

    return {
      available: true,
      timestamp: Date.now(),
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speedGHz: cpu.speed,
        usagePercent: Math.round(load.currentLoad * 10) / 10,
        temperature: temp.main ?? null,
      },
      memory: {
        totalGB: Math.round((mem.total / 1024 ** 3) * 100) / 100,
        usedGB: Math.round((mem.used / 1024 ** 3) * 100) / 100,
        freeGB: Math.round((mem.free / 1024 ** 3) * 100) / 100,
        usagePercent: Math.round((mem.used / mem.total) * 1000) / 10,
        swapTotalGB: Math.round((mem.swaptotal / 1024 ** 3) * 100) / 100,
        swapUsedGB: Math.round((mem.swapused / 1024 ** 3) * 100) / 100,
      },
      disk: disk.map((d) => ({
        mount: d.mount,
        type: d.type,
        totalGB: Math.round((d.size / 1024 ** 3) * 10) / 10,
        usedGB: Math.round((d.used / 1024 ** 3) * 10) / 10,
        usagePercent: Math.round(d.use * 10) / 10,
      })),
      network: net.map((n) => ({
        interface: n.iface,
        rxMBps: Math.round((n.rx_sec / 1024 ** 2) * 100) / 100,
        txMBps: Math.round((n.tx_sec / 1024 ** 2) * 100) / 100,
      })),
      gpu: gpu.controllers.map((g) => ({
        model: g.model,
        vramMB: g.vram,
        usagePercent: g.utilizationGpu ?? null,
        temperatureC: g.temperatureGpu ?? null,
      })),
    };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

/**
 * Start the telemetry polling loop.
 * Emits a 'telemetry' event on the provided Socket.io server instance.
 *
 * @param {import('socket.io').Server} io - Socket.io server instance.
 * @param {number} [intervalMs=2000] - Polling interval in milliseconds.
 * @returns {NodeJS.Timeout} The interval handle (call clearInterval to stop).
 */
function startTelemetryLoop(io, intervalMs = 2000) {
  const loop = setInterval(async () => {
    try {
      const snapshot = await getSnapshot();
      io.emit('telemetry', snapshot);

      // Trigger a RAM warning if usage exceeds 90 %
      if (snapshot.available && snapshot.memory.usagePercent > 90) {
        io.emit('alert', {
          level: 'warning',
          message: `RAM usage is at ${snapshot.memory.usagePercent}%. Consider closing unused applications.`,
        });
      }

      // Trigger a CPU temperature warning
      if (snapshot.available && snapshot.cpu.temperature !== null && snapshot.cpu.temperature > 85) {
        io.emit('alert', {
          level: 'critical',
          message: `CPU temperature is ${snapshot.cpu.temperature}°C. Please check your cooling system.`,
        });
      }
    } catch (err) {
      // Silently continue — don't crash the server over a missed telemetry tick
      console.error('[telemetry] Loop error:', err.message);
    }
  }, intervalMs);

  return loop;
}

module.exports = { getSnapshot, startTelemetryLoop };
