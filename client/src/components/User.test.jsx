import React from 'react';
import { shallow } from 'enzyme';
import Typography from '@material-ui/core/Typography';
import User from './User';

describe('User', () => {
  const baseUser = { displayName: 'Cuber', id: 42 };

  it('does not turn an internal user ID into a public profile link', () => {
    const wrapper = shallow(<User user={baseUser} />);
    const name = wrapper.find(Typography).first();

    expect(name.prop('component')).toBe('span');
    expect(name.prop('to')).toBeUndefined();
  });

  it('links only through a server-provided public profile key', () => {
    const wrapper = shallow(<User user={{ ...baseUser, profileKey: 'cuber' }} />);
    const name = wrapper.find(Typography).first();

    expect(name.prop('to')).toBe('/users/cuber');
  });
});
