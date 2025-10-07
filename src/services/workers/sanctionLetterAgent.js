import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pdfDir = path.join(__dirname, '../../../tmp');

if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

export async function sanctionLetterAgent(context) {
  const id = uuidv4();
  const filePath = path.join(pdfDir, `${id}.pdf`);
  const { name, city, loanAmount, tenureMonths, underwriting } = context;
  const interestRate = underwriting?.interestRate ?? 12;

  await generatePdf({
    filePath,
    data: {
      applicantName: name || 'Customer',
      city: city || '-',
      amount: loanAmount,
      tenureMonths,
      interestRate
    }
  });

  const link = `/pdf/${id}`;
  return { id, link };
}

function generatePdf({ filePath, data }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text('Personal Loan Sanction Letter', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown();
    doc.text(`To,`);
    doc.text(`${data.applicantName}`);
    doc.text(`${data.city}`);
    doc.moveDown();
    doc.text('Subject: Sanction of Personal Loan');
    doc.moveDown();
    doc.text(
      `We are pleased to inform you that your personal loan application has been approved with the following terms:`
    );
    doc.moveDown();
    doc.list([
      `Sanctioned Amount: ₹${new Intl.NumberFormat('en-IN').format(data.amount)}`,
      `Tenure: ${data.tenureMonths} months`,
      `Interest Rate: ${data.interestRate}% p.a.`
    ]);
    doc.moveDown();
    doc.text(
      'Please note that this sanction is subject to execution of standard loan documentation and successful completion of any pending KYC requirements.'
    );
    doc.moveDown();
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown();
    doc.text('Digitally signed by:');
    doc.text('Tata Capital – AI Assistant');
    doc.moveDown();
    doc.text('Regards,');
    doc.text('AI Loan Assistant');

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}


