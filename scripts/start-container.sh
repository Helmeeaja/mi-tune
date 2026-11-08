set -eu
if [ "${VERCEL:-0}" = '1' ] && [ "${MI_TUNE_DATA_DIR:-/var/lib/mi-tune}" = '/var/lib/mi-tune' ]; then
    export MI_TUNE_DATA_DIR=/tmp/mi-tune
fi
case "${MI_TUNE_DATA_DIR:-/var/lib/mi-tune}" in
    /var/lib/mi-tune|/tmp/mi-tune) ;;
    *) printf 'Invalid container data directory\n' >&2; exit 1 ;;
esac
export MI_TUNE_DATA_DIR=${MI_TUNE_DATA_DIR:-/var/lib/mi-tune}
mkdir -p "$MI_TUNE_DATA_DIR"
if [ "$(id -u)" = '0' ]; then
    chown -R node:node "$MI_TUNE_DATA_DIR"
    exec runuser -u node -- node server/index.mjs
fi
exec node server/index.mjs
