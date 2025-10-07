import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, '../../data/customers.json');

function loadCustomers() {
  try {
    const raw = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const customers = loadCustomers();

export function findCustomerByIdentity({ name, city, phone }) {
  const norm = (s) => String(s || '').trim().toLowerCase();
  const nName = norm(name);
  const nCity = norm(city);
  const nPhone = String(phone || '').replace(/\D/g, '');
  return customers.find(
    (c) => norm(c.name) === nName && norm(c.city) === nCity && String(c.phone) === nPhone
  );
}

export function getCustomerById(id) {
  return customers.find((c) => c.id === id) || null;
}

export { customers };


