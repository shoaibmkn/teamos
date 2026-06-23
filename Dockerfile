# TeamOS container image. Builds the npm workspace and runs the Next.js app.
# Used for container hosts (clawdship, Fly, Render, etc.). The default backend
# is the in-memory demo; set TEAMOS_DATA_BACKEND=sheets + the Google env vars
# (see DEPLOY.md) for a persistent deployment.
FROM node:20-bookworm-slim

WORKDIR /app

# Install and build (workspace-aware). .dockerignore keeps node_modules/.next out.
COPY . .
RUN npm ci && npm run build -w @teamos/web

ENV NODE_ENV=production
ENV TEAMOS_DEV_LOGIN=true

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@teamos/web"]
