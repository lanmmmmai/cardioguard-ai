FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL=http://localhost:8000
ARG VITE_WS_URL=ws://localhost:8000/ws/realtime
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY web_frontend/package.json web_frontend/package-lock.json ./
RUN npm ci

COPY web_frontend/ ./
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY web_frontend/package.json web_frontend/package-lock.json ./
RUN npm ci --omit=dev

COPY web_frontend/server.js web_frontend/seo-injector.js ./
COPY --from=build /app/dist ./dist

USER node

EXPOSE 8080

CMD ["node", "server.js"]
