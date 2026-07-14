import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../theme';
import User from './User';

describe('User', () => {
  const baseUser = { displayName: 'Cuber', id: 42 };

  const renderUser = (user) => render(
    <ThemeProvider>
      <MemoryRouter>
        <User user={user} />
      </MemoryRouter>
    </ThemeProvider>,
  );

  it('does not turn an internal user ID into a public profile link', () => {
    renderUser(baseUser);
    const name = screen.getByText('Cuber');

    expect(name.tagName).toBe('SPAN');
    expect(name).not.toHaveAttribute('href');
  });

  it('links only through a server-provided public profile key', () => {
    renderUser({ ...baseUser, profileKey: 'cuber' });

    expect(screen.getByText('Cuber')).toHaveAttribute('href', '/users/cuber');
  });
});
