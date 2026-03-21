import { HttpError } from './errors.js';

export interface ImportedUserRow {
  username: string;
  password: string;
  displayName: string;
  role: 'PARTICIPANT' | 'ADMIN';
}

const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

export const parseUserCsv = (csv: string): ImportedUserRow[] => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new HttpError(400, 'CSV must include a header row and at least one participant.');
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const usernameIndex = headers.indexOf('username');
  const passwordIndex = headers.indexOf('password');
  const displayNameIndex = headers.indexOf('displayname');
  const roleIndex = headers.indexOf('role');

  if (usernameIndex === -1 || passwordIndex === -1 || displayNameIndex === -1) {
    throw new HttpError(
      400,
      'CSV must contain username, password, and displayName columns.',
    );
  }

  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const username = values[usernameIndex]?.trim();
    const password = values[passwordIndex]?.trim();
    const displayName = values[displayNameIndex]?.trim();
    const role = (values[roleIndex]?.trim().toUpperCase() || 'PARTICIPANT') as
      | 'PARTICIPANT'
      | 'ADMIN';

    if (!username || !password || !displayName) {
      throw new HttpError(400, `CSV row ${index + 2} is missing required values.`);
    }

    return {
      username,
      password,
      displayName,
      role: role === 'ADMIN' ? 'ADMIN' : 'PARTICIPANT',
    };
  });
};
