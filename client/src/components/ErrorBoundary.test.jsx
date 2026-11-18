import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const Broken = () => {
  throw new Error('render failed');
};

it('offers a reload action after a render failure', () => {
  const onReload = jest.fn();
  const reportError = jest.fn();

  render(
    <ErrorBoundary onReload={onReload} reportError={reportError}>
      <Broken />
    </ErrorBoundary>,
  );

  expect(screen.getByRole('alert')).toHaveTextContent("Let's Cube stopped unexpectedly.");
  expect(reportError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
  fireEvent.click(screen.getByRole('button', { name: 'Reload app' }));
  expect(onReload).toHaveBeenCalledTimes(1);
});
