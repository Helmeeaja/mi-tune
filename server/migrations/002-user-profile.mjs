export function migrateUserProfiles(db) {
  const columns = new Set(db.prepare('PRAGMA table_info(users)').all().map(column => column.name))
  db.exec('BEGIN')
  try {
    if (!columns.has('bio')) db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''")
    if (!columns.has('avatar')) db.exec('ALTER TABLE users ADD COLUMN avatar TEXT')
    if (!columns.has('email')) db.exec("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''")
    if (!columns.has('joined_at')) db.exec('ALTER TABLE users ADD COLUMN joined_at INTEGER')
    db.exec('CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id); CREATE INDEX IF NOT EXISTS friend_requests_receiver ON friend_requests(receiver_id); CREATE INDEX IF NOT EXISTS friendships_receiver ON friendships(b)')
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
}
