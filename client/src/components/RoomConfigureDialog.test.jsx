import React from 'react';
import { shallow } from 'enzyme';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
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

describe('RoomConfigureDialog passwords', () => {
  it('allows an existing private room to be edited without replacing its password', () => {
    const onSave = jest.fn();
    const wrapper = shallow(
      <RoomConfigureDialog
        room={privateRoom}
        open
        onSave={onSave}
        onCancel={jest.fn()}
      />,
    );

    const save = wrapper.find(Button).filterWhere((button) => button.text() === 'Save');
    expect(save.prop('disabled')).toBe(false);
    save.simulate('click');

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      private: true,
      password: undefined,
    }));
  });

  it('sends an explicitly changed password', () => {
    const onSave = jest.fn();
    const wrapper = shallow(
      <RoomConfigureDialog
        room={privateRoom}
        open
        onSave={onSave}
        onCancel={jest.fn()}
      />,
    );

    wrapper.find(TextField).findWhere((field) => field.prop('id') === 'password')
      .simulate('change', { target: { value: 'new-password' } });
    wrapper.find(Button).filterWhere((button) => button.text() === 'Save').simulate('click');

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      private: true,
      password: 'new-password',
    }));
  });

  it('requires a password when making an existing public room private', () => {
    const wrapper = shallow(
      <RoomConfigureDialog
        room={{ ...privateRoom, private: false }}
        open
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    wrapper.find(FormControlLabel).first().prop('control').props.onChange();
    wrapper.update();

    const save = wrapper.find(Button).filterWhere((button) => button.text() === 'Save');
    expect(save.prop('disabled')).toBe(true);
  });

  it('requires a password when creating a private room', () => {
    const wrapper = shallow(
      <RoomConfigureDialog
        open
        onSave={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    wrapper.find(FormControlLabel).first().prop('control').props.onChange();
    wrapper.update();

    const create = wrapper.find(Button).filterWhere((button) => button.text() === 'Create');
    expect(create.prop('disabled')).toBe(true);
  });
});
