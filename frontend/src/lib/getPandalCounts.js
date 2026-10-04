import fs from 'fs';
import path from 'path';

export function getPandalCounts() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'pandals.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const pandals = JSON.parse(raw);

    const counts = {};
    for (const pandal of pandals) {
      if (!pandal.isActive) continue;
      const city = pandal.city || 'Unknown';
      counts[city] = (counts[city] || 0) + 1;
    }
    return counts;
  } catch (err) {
    console.error('Failed to read pandals.json for counts:', err.message);
    return {};
  }
}
