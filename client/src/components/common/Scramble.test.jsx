import React from 'react';
import { render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import Scramble from './Scramble';

const scramble = 'test';
const theme = createTheme();

const renderScramble = (props) => render(
  <ThemeProvider theme={theme}>
    <Scramble {...props} />
  </ThemeProvider>,
);

it('renders without crashing', () => {
  renderScramble({ scrambles: [scramble] });

  expect(screen.getByText(scramble)).toBeInTheDocument();
});

it('renders 3x3 text correctly', () => {
  renderScramble({ event: '333', scrambles: [scramble] });

  expect(screen.getByText(scramble)).toHaveTextContent(scramble);
});
