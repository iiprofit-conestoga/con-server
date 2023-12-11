FROM node:18.17.1-alpine3.14

ENV DB_USER='iiprofit'
ENV DB_PASSWORD='#India1947'
ENV DB_HOST='cloud-db.cngx7d5v7dd5.us-east-1.rds.amazonaws.com'
ENV DB_PORT=5432
ENV DB_NAME='conestogadb'

WORKDIR /app

COPY ["package.json", "package-lock.json*", "./"]

RUN npm install --production 

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]