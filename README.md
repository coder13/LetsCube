# Let's Cube

This is a Progressive Web app written in Node.JS, Express, MongoDB, socket.io, react, and material-ui.

This project consists of a client and a server.

## Development:

Make sure Node.JS, MongoDB, and redis are installed.

```
git clone https://github.com/coder13/letscube.git
cd letscube
npm install # installs pre-commit hook
```

**Server**

The server is split across 2 files, you can run them individually from the server directory after installing modules

```bash
cd server && npm install
```

```
npm run start:server # Starts the file server (not used for dev), auth, and some api requests
npm run start:socket # Run this in a separate terminal; Starts the socket.io server for all the realtime socket requests
```

**Server**

```cd client && npm install && npm run start```

For more on the internals and contributing, check out the [wiki](https://github.com/coder13/LetsCube/wiki)
