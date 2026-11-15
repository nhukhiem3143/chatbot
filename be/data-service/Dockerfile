
FROM node:20-slim

# Cài chứng chỉ CA và công cụ kiểm tra HTTPS/TLS
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        openssl \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI + Docker Compose plugin
COPY --from=docker:27-cli \
    /usr/local/bin/docker \
    /usr/local/bin/docker

COPY --from=docker:27-cli \
    /usr/local/libexec/docker/cli-plugins/docker-compose \
    /usr/local/libexec/docker/cli-plugins/docker-compose

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
