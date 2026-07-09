# Let's Cube

This is a Progressive Web app written in Node.JS, Express, MongoDB, socket.io, react, and material-ui.

This project consists of a client and a server.

## Development:

Make sure Node.JS and Docker are installed. Docker Compose starts the local MongoDB and Redis services used by the app.

```
git clone https://github.com/coder13/letscube.git
cd letscube
yarn install
docker compose up -d
```

If MongoDB or Redis are already running locally on their default ports, stop them or skip Docker Compose.

**Server**

The server is split across 2 processes:

```bash
yarn start:server # Starts the file server, auth, and API requests on port 8080
yarn start:socket # Run this in a separate terminal for Socket.IO on port 9000
```

**Client**

```bash
yarn start:client
```

For more on the internals and contributing, check out the [wiki](https://github.com/coder13/LetsCube/wiki)
