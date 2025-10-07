import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const pdfRouter = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pdfDir = path.join(__dirname, '../../tmp');

if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

pdfRouter.get('/:id', (req, res) => {
  const filePath = path.join(pdfDir, `${req.params.id}.pdf`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'PDF not found' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  fs.createReadStream(filePath).pipe(res);
});


