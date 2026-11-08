export function migrateSharingVisibility(db) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const playlists = new Set(db.prepare('PRAGMA table_info(playlists)').all().map(column=>column.name))
    const users = new Set(db.prepare('PRAGMA table_info(users)').all().map(column=>column.name))
    if (!playlists.has('visibility')) db.exec("ALTER TABLE playlists ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public'))")
    if (!users.has('likes_visibility')) db.exec("ALTER TABLE users ADD COLUMN likes_visibility TEXT NOT NULL DEFAULT 'private' CHECK(likes_visibility IN ('private','public'))")
    db.exec("CREATE INDEX IF NOT EXISTS playlists_public_owner ON playlists(visibility,owner_id,created_at)")
    db.exec('COMMIT')
  } catch(error) { db.exec('ROLLBACK');throw error }
}
