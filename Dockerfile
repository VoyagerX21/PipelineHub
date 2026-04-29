FROM node:22-slim

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./

RUN npm install --omit=dev && npm cache clean --force

COPY --chown=node:node . .

USER node

EXPOSE 3000

CMD ["node", "server.js"]