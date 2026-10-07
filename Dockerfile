FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
COPY public ./public
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY data ./data
RUN chmod +x ./scripts/docker-entrypoint.sh \
  && mkdir -p /app/reports
EXPOSE 3000
CMD ["./scripts/docker-entrypoint.sh"]
