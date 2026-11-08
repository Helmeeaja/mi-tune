export function migrateGoogleIdentity(db) {
  const columns=new Set(db.prepare('PRAGMA table_info(users)').all().map(column=>column.name))
  if(!columns.has('google_sub'))db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT')
  if(!columns.has('google_only'))db.exec('ALTER TABLE users ADD COLUMN google_only INTEGER NOT NULL DEFAULT 0')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_google_identity ON users(google_sub) WHERE google_sub IS NOT NULL')
}
