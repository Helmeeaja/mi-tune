export function migratePlaylistCovers(db) {
  const columns = db.prepare('PRAGMA table_info(playlists)').all()
  if (!columns.some(column => column.name === 'cover')) db.exec('ALTER TABLE playlists ADD COLUMN cover TEXT')
}
