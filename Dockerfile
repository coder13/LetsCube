# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS client-build
WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN yarn install --frozen-lockfile

ARG REACT_APP_API_ORIGIN=
ARG REACT_APP_SOCKETIO_ORIGIN=
ARG REACT_APP_WCA_ORIGIN=https://www.worldcubeassociation.org
ARG REACT_APP_WCA_CLIENT_ID=

ENV NODE_OPTIONS=--openssl-legacy-provider
ENV REACT_APP_API_ORIGIN=${REACT_APP_API_ORIGIN}
ENV REACT_APP_SOCKETIO_ORIGIN=${REACT_APP_SOCKETIO_ORIGIN}
ENV REACT_APP_WCA_ORIGIN=${REACT_APP_WCA_ORIGIN}
ENV REACT_APP_WCA_CLIENT_ID=${REACT_APP_WCA_CLIENT_ID}

COPY client ./client
RUN yarn workspace letscube-client build

FROM node:22-bookworm-slim AS server-deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable

COPY package.json yarn.lock ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN yarn install --frozen-lockfile --production=true \
  && yarn cache clean \
  && mkdir -p server/node_modules

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=prod
ENV PORT=8080
ENV SOCKETIO_PORT=9000

WORKDIR /app
RUN groupadd --system letscube \
  && useradd --system --gid letscube --home-dir /app --shell /usr/sbin/nologin letscube

COPY --chown=letscube:letscube server ./server
COPY --from=server-deps --chown=letscube:letscube /app/node_modules ./node_modules
COPY --from=server-deps --chown=letscube:letscube /app/server/node_modules ./server/node_modules
COPY --from=client-build --chown=letscube:letscube /app/client/build ./client/build

USER letscube
EXPOSE 8080 9000

CMD ["node", "server/index.js"]
