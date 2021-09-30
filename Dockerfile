FROM node:14-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --registry https://registry.npm.taobao.org

COPY . .

EXPOSE 8080
CMD [ "node", "app.js" ]