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
COPY data ./data
RUN mkdir -p /app/reports
EXPOSE 3000
# Inline CMD tránh lỗi CRLF của file .sh khi build trên Windows
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"${AUTO_IMPORT:-1}\" = \"1\" ]; then echo \"Import batch_1 rồi batch_2...\"; node dist/cli.js data/batch_1.json data/batch_2.json --export; fi && exec node dist/main.js"]
