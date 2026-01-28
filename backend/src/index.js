import express from 'express';
import cors from 'cors';
import { runAllChecks, runCheck, applyFix } from './checks/index.js';
import { getTemperatureData } from './checks/temperature.js';
import { scripts, getScriptsForPlatform, detectPlatform } from './scripts.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get temperature data (lightweight, for live widget)
app.get('/api/temperature', async (req, res) => {
  try {
    const data = await getTemperatureData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all security checks
app.get('/api/checks', async (req, res) => {
  try {
    const results = await runAllChecks();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run a specific check
app.get('/api/checks/:checkId', async (req, res) => {
  try {
    const result = await runCheck(req.params.checkId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply a fix
app.post('/api/fixes/:fixId', async (req, res) => {
  try {
    const result = await applyFix(req.params.fixId, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available fix scripts
app.get('/api/scripts', (req, res) => {
  const platform = req.query.platform || detectPlatform(req.headers['user-agent']);
  res.json({
    platform,
    scripts: getScriptsForPlatform(platform),
    all: scripts
  });
});

// Get specific script info
app.get('/api/scripts/:scriptId', (req, res) => {
  const script = scripts[req.params.scriptId];
  if (!script) {
    return res.status(404).json({ error: 'Script not found' });
  }
  res.json(script);
});

app.listen(PORT, () => {
  console.log(`
🛡️  ═══════════════════════════════════════════════════ 🛡️
    Security Dashboard Backend
    
    🚀 Server running on port ${PORT}
    📡 API: http://localhost:${PORT}/api
    💚 Health: http://localhost:${PORT}/health
🛡️  ═══════════════════════════════════════════════════ 🛡️
  `);
});
