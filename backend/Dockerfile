FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc

EXPOSE 4000

CMD ["node", "dist/server.js"]
