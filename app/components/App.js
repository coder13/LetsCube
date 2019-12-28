import React, { Component } from 'react';
import Container from '@material-ui/core/Container';
import { 
  BrowserRouter as Router,
  Switch,
  Route
} from 'react-router-dom';
import Header from './Header'

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
      .then(res => {
        if (res.ok) {
          return res.json();
        } else if (res.status === 403) {
          this.setState({
            user: false
          });
        }
      })
      .then(data => {
        this.setState({
          loading: false,
          user: data
        })
      });
  }

  render () {
    const { loading, user, errors } = this.state;

    return (
      <Router>
        <Container>
          <Header user={user} />
          { errors ? 
            errors.map(err =>
              <p>{err}</p>
            ) : ''
          }
          <p>{ loading ? 'Loading...' : ''}</p>
        </Container>
      </Router>
    );
  }
}

export default App;
