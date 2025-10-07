import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { masterAgentRouter } from './routes/masterAgent.js';
import { pdfRouter } from './routes/pdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', masterAgentRouter);
app.use('/pdf', pdfRouter);

// Serve static frontend from ../frontend
app.use('/', express.static(path.join(__dirname, '../../frontend')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Loan Assistant running on http://localhost:${PORT}`);
});


