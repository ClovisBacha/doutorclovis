# DoctorThink — imagem de deploy (Bun)
FROM oven/bun:1
WORKDIR /app

# instala deps primeiro (cache de camada)
COPY package.json ./
RUN bun install

# copia o resto do código
COPY . .

# Railway/Render injetam PORT; server.ts lê process.env.PORT
CMD ["bun", "run", "src/server.ts"]
