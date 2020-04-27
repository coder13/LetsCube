The project is split into 2 parts: the server, and the client.

# Sending a Pull Request

1. Fork the repo
2. Clone it to your machine

```bash
git clone git@github.com:<yourusername>/letscube.git
cd letscube
git remote add upstream git@github.com:coder13/letscube.git
```

3. Sync your local `master` branch with upstream:
```bash
get checkout master
git pull upstream master
```

4. Create a new feature branch:
```bash
git checkout -b feature-branch
```

5. Commit and push the changes:
```bash
git push -u
```

7. Go to the [repository](https://github.com/coder13/letscube) and make a Pull Request to the `dev` branch.

# Installing and Running:

`npm install` in the root directory installs the pre-commit hook.

## to start the bash server:

```bash
cd server/
npm install
npm start
```

## to start the client dev server:

```bash
cd client/
npm install
npm start
```
# Pre-commit hook

When installed properly, the pre-commit hook won't let you commit without the client and server being properly linted and tests being ran.

# Linting

Both the client and the server use eslint and a slight variation of [airbnb's style guide](https://github.com/airbnb/javascript).

# Tests

LetsCube is currently using Jest and Enzyme for testing. Right now there is very minimal tests but I would like to add much more coverage in time. For any complicated computational code, it should be tested to make sure there are no errors.

# Nit picky stuff:

This project uses React: A component should be made whenever something gets too complicated (like with the timesTable) or if it's going to be used repeatedly. 

Redux: I'd like to keep the number of reducers relatively low. Please get in contact with me before adding another reducer.

Socket.IO: A common code pattern I found myself using is socket events to send information from a client and a separate event to echo the data to clients. If not done properly and one event was used for both, an infinite loop would happen. Take this into consideration when creating events that echo to other users.
