FROM node:18

RUN apt -yy update && apt -yy install ffmpeg && apt clean

WORKDIR /app
COPY package*.json ./

RUN npm ci

COPY . /app/

CMD [ "node", "index.js" ]
