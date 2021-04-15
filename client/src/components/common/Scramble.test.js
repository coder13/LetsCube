import React from 'react';
import { shallow } from 'enzyme';
import Scramble from './Scramble';

const scramble = 'test';

it('renders without crashing', () => {
  shallow(<Scramble scrambles={[scramble]} />);
});

it('renders 3x3 text correctly', () => {
  const component = shallow(<Scramble event="333" scrambles={[scramble]} />);

  expect(component.text()).toEqual(scramble);
});
