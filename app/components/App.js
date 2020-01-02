import React from 'react';
import { Switch, Route, Redirect } from 'react-router-dom';
import { connect } from 'react-redux';
import Container from '@material-ui/core/Container';
import { withStyles } from '@material-ui/core/styles';
import Header from './Header'
import RoomList from './RoomList'
import Room from './Room'

const styles = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    flexDirection: 'column',
  },
  grow: {
    flexGrow: 1,
  },
};

function App ({ classes, fetching, user }) {
  if (fetching) {
    return (<Loading/>);
  }

  console.log(26, user)

  return (
    <div className={classes.root}>
      <Header user={user} />
        <Switch>
          <Route exact path="/" component={RoomList} />
          <Route path="/rooms/:roomId" component={Room} />
          {user && 
            (<Route exact path ="/preferences" component={Preferences}/>)}
          <Redirect to="/" />
        </Switch>
    </div>
  );
}

function Loading () {
  return (
    <div>Loading...</div>
  );
}

function Preferences () {
  return (
    <Container>
      <h1>Prefs!</h1>
    </Container>
  );
}

const mapStateToProps = (state) => ({
  connected: state.connected,
  user: state.user
});

export default withStyles(styles)(connect(mapStateToProps)(App));
