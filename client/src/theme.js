import React, {
  createContext, useContext, useState, useEffect, useCallback,
} from 'react';
import PropTypes from 'prop-types';
import {
  indigo, green, grey, blue, red,
} from '@material-ui/core/colors';
import {
  createMuiTheme,
  ThemeProvider as MuiThemeProvider,
} from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

const primary = {
  light: {
    main: indigo[500],
  },
  dark: {

  },
};

// A custom theme for this app
const makeTheme = (darkMode) => createMuiTheme({
  palette: {
    type: darkMode ? 'dark' : 'light',
    primary: primary.light,
    common: {
      green: green[darkMode ? 800 : 200],
      greenBorder: green[darkMode ? 900 : 300],
      grey: grey[darkMode ? 700 : 200],
      greyBorder: grey[darkMode ? 800 : 300],
      blue: blue[darkMode ? 800 : 200],
      blueBorder: blue[darkMode ? 900 : 300],
      red: red[darkMode ? 500 : 'A700'],
    },
  },
  typography: {
    fontSize: 12,
  },
});

const ToggleThemeContext = createContext();

const storedThemeType = window.localStorage.getItem('themeType');

export const ThemeProvider = ({ children }) => {
  const prefersDarkMode = useMediaQuery('@media (prefers-color-scheme: dark)');
  const preferredThemeType = prefersDarkMode ? 'dark' : 'light';
  const [themeType, setThemeType] = useState(storedThemeType || preferredThemeType);

  const toggleTheme = useCallback(() => {
    setThemeType((type) => (type === 'light' ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    window.localStorage.setItem('themeType', themeType);
  }, [themeType]);

  return (
    <MuiThemeProvider theme={makeTheme(themeType === 'dark')}>
      <ToggleThemeContext.Provider value={toggleTheme}>
        {children}
      </ToggleThemeContext.Provider>
    </MuiThemeProvider>
  );
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useToggleTheme = () => useContext(ToggleThemeContext);
