# Entorno completo: Node + pnpm + la app. El host no necesita ninguna de las dos.
# engines.node es >=24; Node 24 ya ejecuta TypeScript en modo strip-only (tests, scripts, pipeline).
FROM node:24-bookworm-slim

# pnpm 11 (packageManager en package.json). Instalación global para no depender de corepack,
# que Node 25+ ya no empaqueta por defecto.
RUN npm install -g pnpm@11.13.1

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

# Mismo arranque que `pnpm run dev`, escuchando fuera de localhost para el publish de Compose.
CMD ["pnpm", "exec", "next", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
