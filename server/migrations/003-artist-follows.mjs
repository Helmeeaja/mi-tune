export function migrateArtistFollows(db) {
  db.exec('BEGIN')
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS artists(id TEXT PRIMARY KEY,data TEXT NOT NULL,updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS artist_follows(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,followed_at INTEGER NOT NULL,PRIMARY KEY(user_id,artist_id));
      CREATE INDEX IF NOT EXISTS artist_follows_owner ON artist_follows(user_id,followed_at DESC);`)
    db.exec('COMMIT')
  } catch (error) { db.exec('ROLLBACK'); throw error }
}
