FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.mjs app.js auth.js index.html styles.css prospecting-search.mjs google-maps-scraper.mjs ./

ENV PORT=4173
EXPOSE 4173

CMD ["node", "server.mjs"]
