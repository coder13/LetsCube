import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import Announcements from './Announcements';
import { lcFetch } from '../../lib/fetch';

jest.mock('../../lib/fetch', () => ({
  lcFetch: jest.fn(),
}));

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('Announcements', () => {
  beforeEach(() => {
    lcFetch.mockReset();
  });

  it('renders markdown announcements', async () => {
    lcFetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('[Docs](https://example.com)'),
    });

    let wrapper;

    await act(async () => {
      wrapper = mount(<Announcements />);
      await flushPromises();
    });

    wrapper.update();

    const link = wrapper.find('a').first();

    expect(link.text()).toEqual('Docs');
    expect(link.prop('href')).toEqual('https://example.com');
    expect(link.prop('target')).toEqual('_blank');
  });
});
