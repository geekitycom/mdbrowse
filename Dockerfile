# Pinned to the Node the project is developed on; `node:24-*` floats.
ARG NODE_IMAGE=node:24.18.0-trixie-slim

FROM ${NODE_IMAGE}

ENV NODE_ENV=production

WORKDIR /app

# pnpm at the version packageManager in package.json names.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# --ignore-scripts: `prepare` runs husky, which is a devDependency and has no
# .git to install into. The store is removed afterwards; node_modules keeps its
# own links to the files.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts \
  && rm -rf "$(pnpm store path)" /root/.cache

COPY server.js safe-fetch.js homepage.md ./
COPY public ./public

USER node

EXPOSE 3000

# The port is read inside node so a PORT override is checked where the server
# actually listens.
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --start-interval=2s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
