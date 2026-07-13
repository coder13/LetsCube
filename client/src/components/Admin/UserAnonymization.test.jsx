import React from 'react';
import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import { useDispatch } from 'react-redux';
import { useConfirm } from 'material-ui-confirm';
import UserAnonymization from './UserAnonymization';
import { ANONYMIZE_ADMIN_USER, SEARCH_ADMIN_USERS } from '../../store/admin/actions';

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
}));
jest.mock('material-ui-confirm', () => ({
  useConfirm: jest.fn(),
}));

describe('admin user anonymization', () => {
  let dispatch;

  beforeEach(() => {
    dispatch = jest.fn();
    useDispatch.mockReturnValue(dispatch);
    useConfirm.mockReturnValue(jest.fn().mockResolvedValue(undefined));
  });

  it('searches and displays matching identity details', () => {
    render(<UserAnonymization />);
    fireEvent.change(screen.getByLabelText('Find user'), { target: { value: '2020TEST01' } });
    fireEvent.click(screen.getByText('Search'));

    const action = dispatch.mock.calls[0][0];
    expect(action).toEqual(expect.objectContaining({
      type: SEARCH_ADMIN_USERS,
      query: '2020TEST01',
    }));

    act(() => action.onComplete(null, [{
      id: 1234,
      name: 'Test Solver',
      username: 'solver',
      email: 'solver@example.com',
      wcaId: '2020TEST01',
    }]));

    expect(screen.getByText('Name: Test Solver')).toBeInTheDocument();
    expect(screen.getByText('Email: solver@example.com')).toBeInTheDocument();
  });

  it('confirms before dispatching anonymization', async () => {
    render(<UserAnonymization />);
    fireEvent.change(screen.getByLabelText('Find user'), { target: { value: '1234' } });
    fireEvent.click(screen.getByText('Search'));
    act(() => dispatch.mock.calls[0][0].onComplete(null, [{
      id: 1234,
      name: 'Test Solver',
    }]));

    await act(async () => {
      fireEvent.click(screen.getByText('Anonymize'));
      await Promise.resolve();
    });

    expect(dispatch.mock.calls[1][0]).toEqual(expect.objectContaining({
      type: ANONYMIZE_ADMIN_USER,
      userId: 1234,
    }));
  });
});
