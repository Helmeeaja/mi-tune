FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --global pnpm@11.10.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
COPY scripts/build-sw.mjs ./scripts/build-sw.mjs
COPY server/range.mjs ./server/range.mjs
RUN pnpm run build && pnpm prune --prod

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    MI_TUNE_DATA_DIR=/var/lib/mi-tune \
    MUSIC_PYTHON=/app/.venv/bin/python \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/app/.venv/bin:$PATH
RUN apt-get update \
    && apt-get install --yes --no-install-recommends python3 python3-venv ffmpeg ca-certificates util-linux \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN python3 -m venv /app/.venv \
    && /app/.venv/bin/pip install --no-cache-dir -r requirements.txt 'yt-dlp[default]==2026.08.19'
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts/start-container.sh ./scripts/start-container.sh
RUN mkdir -p /var/lib/mi-tune && chown node:node /var/lib/mi-tune
EXPOSE 8080
CMD ["sh", "scripts/start-container.sh"]
