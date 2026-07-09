# Let's Cube

This is a Progressive Web app written in Node.JS, Express, MongoDB, socket.io, react, and material-ui.

This project consists of a client and a server.

## Development:

Make sure Node.JS and Docker are installed. Docker Compose starts the local MongoDB and Redis services used by the app.

```
git clone https://github.com/coder13/letscube.git
cd letscube
npm install # installs pre-commit hook
docker compose up -d
```

If MongoDB or Redis are already running locally on their default ports, stop them or skip Docker Compose.

**Server**

The server is split across 2 files, you can run them individually from the server directory after installing modules

```bash
cd server && npm install
```

```
npm run start:server # Starts the file server (not used for dev), auth, and some api requests
npm run start:socket # Run this in a separate terminal; Starts the socket.io server for all the realtime socket requests
```

**Client**

```cd client && npm install && npm run start```

For more on the internals and contributing, check out the [wiki](https://github.com/coder13/LetsCube/wiki)
