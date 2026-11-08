# Playlist cover migration

001-playlist-cover.mjs adds a nullable cover TEXT column only when absent. Existing playlist IDs, owners, names, track lists, account sessions and favorites are preserved. No cover backfill is performed.

Startup applies the additive migration. The previous source remains compatible with the extra nullable column, so rolling back source does not require dropping user cover data. Do not remove the column to roll back code. A schema reversal, if ever required, must be a new explicit migration with a verified backup.
