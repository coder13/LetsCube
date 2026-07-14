import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme';
import RoomConfigureDialog from './RoomConfigureDialog';

const privateRoom = {
  _id: 'room-one',
  name: 'Private room',
  private: true,
  type: 'normal',
  requireRevealedIdentity: false,
  startTime: '',
  twitchChannel: '',
};

const renderDialog = (props) => render(
  <ThemeProvider>
    <RoomConfigureDialog {...props} />
  </ThemeProvider>,
);

describe('RoomConfigureDialog passwords', () => {
  it('allows an existing private room to be edited without replacing its password', () => {
    const onSave = jest.fn();
    renderDialog({
      room: privateRoom,
      open: true,
      onSave,
      onCancel: jest.fn(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      private: true,
      password: undefined,
    }));
  });

  it('sends an explicitly changed password', () => {
    const onSave = jest.fn();
    renderDialog({
      room: privateRoom,
      open: true,
      onSave,
      onCancel: jest.fn(),
    });

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      private: true,
      password: 'new-password',
    }));
  });

  it('requires a password when making an existing public room private', () => {
    renderDialog({
      room: { ...privateRoom, private: false },
      open: true,
      onSave: jest.fn(),
      onCancel: jest.fn(),
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Private Room?' }));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('requires a password when creating a private room', () => {
    renderDialog({
      open: true,
      onSave: jest.fn(),
      onCancel: jest.fn(),
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Private Room?' }));

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });
});
