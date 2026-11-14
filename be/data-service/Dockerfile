FROM node:20-slim

# Docker CLI + compose plugin (lấy từ image chính thức) để chạy/tắt web do AI sinh ra
COPY --from=docker:27-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:27-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
