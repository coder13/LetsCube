import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';

class App extends Component {
  constructor (props) {
    super(props);

    this.state = {
      loading: true,
      user: null,
      error: null
    }
  }

  componentDidMount () {
    fetch('/api/me')
      .then(data => data.json())
      .then(data => {
        this.setState({
          loading: false,
          user: data
        })
      }).catch(error => {
        console.error(error);
        this.setState({error})
      });
  }

  render () {
    const { loading, user } = this.state;

    return (
      <div className="App">
        { loading ?
          <p>Loading...</p> :
          user ?
            <p>Logged in as {user.name}</p> :
            <a href="/auth/login?redirect=http://localhost:3000">Login</a>
          }
      </div>
    );
  }
}

export default App;
