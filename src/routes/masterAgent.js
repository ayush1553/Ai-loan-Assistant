import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { runMasterAgent } from '../services/masterAgent.js';

export const masterAgentRouter = express.Router();

masterAgentRouter.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body || {};
    const result = await runMasterAgent(message || '', context || {});
    res.json(result);
  } catch (err) {
    console.error('MasterAgent error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload endpoint for salary slip (mock). Stores files under tmp/uploads and returns a token
const uploadDir = path.join(process.cwd(), 'backend', 'tmp', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

masterAgentRouter.post('/upload-slip', upload.single('slip'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  // In a real system, we would OCR/validate; here we just acknowledge
  return res.json({ status: 'received', fileId: req.file.filename });
});


