# Alternativa a la ejecucion nativa de Render (runtime: node).
# Util para correr en cualquier plataforma con contenedores y para CI.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json nest-cli.json drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Nunca correr como root dentro del contenedor.
RUN addgroup -S apitrace && adduser -S apitrace -G apitrace
COPY --from=builder --chown=apitrace:apitrace /app/node_modules ./node_modules
COPY --from=builder --chown=apitrace:apitrace /app/dist ./dist
COPY --from=builder --chown=apitrace:apitrace /app/drizzle ./drizzle
COPY --chown=apitrace:apitrace package.json ./
USER apitrace
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/main.js"]
