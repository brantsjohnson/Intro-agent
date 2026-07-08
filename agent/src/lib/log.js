// Sent-log persistence. SQLite via better-sqlite3.
// Dedup key: (event_url, recipient_email). Never email the same person twice for the same event.
import "dotenv/config";
import Database from "better-sqlite3";

const path = process.env.SENT_LOG_PATH || "./sent-log.sqlite";
const db = new Database(path);

db.exec(`
  CREATE TABLE IF NOT EXISTS sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    event_url TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    kind TEXT NOT NULL,       -- 'sponsor' | 'organizer'
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    gmail_message_id TEXT,
    UNIQUE(event_url, recipient_email)
  );
`);

export function alreadySent({ eventUrl, recipientEmail }) {
  const row = db
    .prepare("SELECT 1 FROM sends WHERE event_url = ? AND recipient_email = ? LIMIT 1")
    .get(eventUrl, recipientEmail);
  return !!row;
}

export function recordSend(entry) {
  const stmt = db.prepare(`
    INSERT INTO sends (event_name, event_url, recipient_email, recipient_name, subject, kind, gmail_message_id)
    VALUES (@event_name, @event_url, @recipient_email, @recipient_name, @subject, @kind, @gmail_message_id)
  `);
  stmt.run(entry);
}

export function listRecent(limit = 20) {
  return db.prepare("SELECT * FROM sends ORDER BY sent_at DESC LIMIT ?").all(limit);
}
