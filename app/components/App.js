import React, { Component } from 'react';
import {
  Switch,
  Route,
  Redirect
} from 'react-router-dom';
import { connect } from 'react-redux';
import Container from '@material-ui/core/Container';
import { withStyles } from '@material-ui/core/styles';
import Header from './Header'
import RoomList from './RoomList'
import Room from './Room'
import { fetchUser } from '../actions';

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

class App extends Component {
  constructor (props) {
    super(props);

    this.state = {
      loading: false,
      error: null
    }
  }

  componentDidMount () {
    // this.props.fetchUser();
  //   fetch('/api/me')
  //     .then(res => {
  //       if (res.ok) {
  //         return res.json();
  //       } else if (res.status === 403) {
  //         this.setState({
  //           loading: false,
  //           user: false
  //         });
  //       }
  //     })
  //     .then(data => {
  //       this.setState({
  //         loading: false,
  //         user: data
  //       })
  //     });
  }

  render () {
    const { loading } = this.state;
    const { classes, user } = this.props;

    if (loading) {
      return (<Loading/>);
    }

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

const mapDispatchToProps = (dispatch) => ({
  fetchUser: () => dispatch(fetchUser())
})

export default withStyles(styles)(connect(mapStateToProps, mapDispatchToProps)(App));
