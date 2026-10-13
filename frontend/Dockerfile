# Palace web (Next.js). Build from the frontend folder:
#   docker build --build-arg BACKEND_URL=http://backend:5000 -t palace-frontend frontend
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js bakes the /api and /uploads proxy targets into the build, so the
# backend address has to be known here, not at container start.
ARG BACKEND_URL=http://backend:5000
ARG BUILD_COMMIT=docker
ENV BACKEND_URL=$BACKEND_URL \
    BUILD_COMMIT=$BUILD_COMMIT \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# The image optimizer writes its cache here.
RUN mkdir -p .next/cache && chown -R node:node .next
USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
