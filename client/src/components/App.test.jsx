import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('react-ga4', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    send: jest.fn(),
  },
}));

jest.mock('./Navigation', () => function MockNavigation() {
  return <div data-testid="navigation" />;
});

it('renders without crashing', () => {
  render(<App />);

  expect(screen.getByTestId('navigation')).toBeInTheDocument();
});
