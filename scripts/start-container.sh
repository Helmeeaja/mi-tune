set -eu
if [ "$MI_TUNE_DATA_DIR" != '/var/lib/mi-tune' ]; then
    printf 'Invalid container data directory\n' >&2
    exit 1
fi
mkdir -p "$MI_TUNE_DATA_DIR"
chown -R node:node "$MI_TUNE_DATA_DIR"
exec runuser -u node -- node server/index.mjs
