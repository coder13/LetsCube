import { red } from '@material-ui/core/colors';
import { createMuiTheme } from '@material-ui/core/styles';

// A custom theme for this app
export default createMuiTheme({
  palette: {
    primary: {
      main: '#556cd6',
    },
    secondary: {
      main: red.A400,
    },
    error: {
      main: red.A400,
    },
    background: {
      default: '#fff',
    },
  },
  typography: {
    fontSize: 11,
    subtitle2: { // scramble
      fontFamily: '"Roboto", "Helvetica", "Arial", "sans-seri"',
      fontWeight: 300,
      fontSize: '1rem',
      lineHeight: 1.5,
      letterSpacving: '0.00938em',
    }
  },
});