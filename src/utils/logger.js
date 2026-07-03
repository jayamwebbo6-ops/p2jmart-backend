/**
 * ============================================================
 *  P2J Mart – Application Logger
 * ============================================================
 *  - Creates one log file per day → logs/YYYY-MM-DD.log
 *  - Auto-deletes files older than 30 days on startup and daily
 *  - Level support : INFO | WARN | ERROR
 *  - Module tags   : [CART] [ORDER] [PRODUCT] [STOCK] [CHECKOUT]
 * ============================================================
 */

const fs   = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────
const LOG_DIR        = path.join(__dirname, '../../logs');   // backend/logs/
const MAX_DAYS       = 30;                                   // keep last N days
const ENABLED        = true;                                 // flip to false to mute all file logs

// ─── Bootstrap ───────────────────────────────────────────────
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ─── Helpers ─────────────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0, 10);  // YYYY-MM-DD

const logFilePath = () => path.join(LOG_DIR, `${todayKey()}.log`);

/** Format: [2026-07-02 17:36:05] [LEVEL] [MODULE] message {meta?} */
const formatLine = (level, module, message, meta) => {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const tag = `[${ts}] [${level.padEnd(5)}] [${module.toUpperCase()}]`;
  let line = `${tag} ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    try {
      line += `  ${JSON.stringify(meta)}`;
    } catch (_) { /* ignore circular refs */ }
  }
  return line + '\n';
};

/** Append a formatted line to today's log file (non-blocking) */
const writeLine = (level, module, message, meta) => {
  if (!ENABLED) return;
  const line = formatLine(level, module, message, meta);

  // Also mirror to console with colour
  const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
  console[consoleMethod](line.trimEnd());

  fs.appendFile(logFilePath(), line, (err) => {
    if (err) console.error('[Logger] Failed to write log file:', err.message);
  });
};

// ─── Public API ──────────────────────────────────────────────
const info  = (module, message, meta = {}) => writeLine('INFO',  module, message, meta);
const warn  = (module, message, meta = {}) => writeLine('WARN',  module, message, meta);
const error = (module, message, meta = {}) => writeLine('ERROR', module, message, meta);

// ─── Convenience Module Loggers ──────────────────────────────
const cart     = { info: (m, d) => info('CART',     m, d), warn: (m, d) => warn('CART',     m, d), error: (m, d) => error('CART',     m, d) };
const order    = { info: (m, d) => info('ORDER',    m, d), warn: (m, d) => warn('ORDER',    m, d), error: (m, d) => error('ORDER',    m, d) };
const product  = { info: (m, d) => info('PRODUCT',  m, d), warn: (m, d) => warn('PRODUCT',  m, d), error: (m, d) => error('PRODUCT',  m, d) };
const stock    = { info: (m, d) => info('STOCK',    m, d), warn: (m, d) => warn('STOCK',    m, d), error: (m, d) => error('STOCK',    m, d) };
const checkout = { info: (m, d) => info('CHECKOUT', m, d), warn: (m, d) => warn('CHECKOUT', m, d), error: (m, d) => error('CHECKOUT', m, d) };

// ─── Log Rotation – Purge files older than MAX_DAYS ──────────
const purgeOldLogs = () => {
  try {
    const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log'));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_DAYS);

    let deleted = 0;
    for (const file of files) {
      // Filename must be YYYY-MM-DD.log
      const dateStr = file.replace('.log', '');
      const fileDate = new Date(dateStr);
      if (isNaN(fileDate.getTime())) continue;   // skip non-date filenames

      if (fileDate < cutoff) {
        fs.unlinkSync(path.join(LOG_DIR, file));
        deleted++;
      }
    }

    if (deleted > 0) {
      info('LOGGER', `Purged ${deleted} log file(s) older than ${MAX_DAYS} days.`);
    }
  } catch (err) {
    console.error('[Logger] Purge error:', err.message);
  }
};

// Run purge on server startup
purgeOldLogs();

// Schedule daily purge at midnight (re-uses the already-loaded cron if available,
// but this module is dependency-free — uses a simple setInterval instead)
const MS_PER_DAY = 24 * 60 * 60 * 1000;
setInterval(purgeOldLogs, MS_PER_DAY);

// ─── Startup Banner ──────────────────────────────────────────
info('LOGGER', `Logger initialised. Log directory: ${LOG_DIR}`, { retentionDays: MAX_DAYS });

// ─── Export ──────────────────────────────────────────────────
module.exports = { info, warn, error, cart, order, product, stock, checkout, purgeOldLogs };
