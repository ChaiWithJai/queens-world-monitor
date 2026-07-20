import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'src/queens/data/calendar-events.json');
const localPath = process.env.QUEENS_CALENDAR_SOURCE
  ? resolve(process.env.QUEENS_CALENDAR_SOURCE)
  : resolve(root, '../queens-calendar/src/data/generated/events.json');

const readCalendar = async () => {
  try {
    return JSON.parse(await readFile(localPath, 'utf8'));
  } catch {
    const response = await fetch('https://queens-calendar.netlify.app/api/events', {
      headers: { 'User-Agent': 'MBIQ-Queens-World-Monitor/0.1 (+https://github.com/koala73/worldmonitor)' },
    });
    if (!response.ok) throw new Error(`Queens Calendar returned ${response.status}`);
    return response.json();
  }
};

const events = await readCalendar();
if (!Array.isArray(events) || events.length === 0) {
  throw new Error('Queens Calendar sync produced no events');
}

const normalized = events
  .filter((event) => event?.id && event?.title && event?.startDate && event?.venue)
  .sort((left, right) => String(left.startDate).localeCompare(String(right.startDate)));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
console.log(`Synced ${normalized.length} Queens Calendar events to ${outputPath}`);
