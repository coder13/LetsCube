import React from 'react';
import { render, screen } from '@testing-library/react';
import Announcements from './Announcements';
import { lcFetch } from '../../lib/fetch';

jest.mock('../../lib/fetch', () => ({
  lcFetch: jest.fn(),
}));

describe('Announcements', () => {
  beforeEach(() => {
    lcFetch.mockReset();
  });

  it('renders markdown announcements', async () => {
    lcFetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('[Docs](https://example.com)'),
    });

    render(<Announcements />);

    const link = await screen.findByRole('link', { name: 'Docs' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
