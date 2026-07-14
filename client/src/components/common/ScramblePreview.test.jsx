import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import Events from '../../lib/events.json';
import loadTwistyPlayer from '../../lib/cubingTwisty';
import { ThemeProvider } from '../../theme';
import ScramblePreview, { puzzleByEvent } from './ScramblePreview';

jest.mock('../../lib/cubingTwisty', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const players = [];

const renderPreview = (element) => render(<ThemeProvider>{element}</ThemeProvider>);

const flushPlayerLoad = () => act(async () => {
  await Promise.resolve();
});

class TwistyPlayer {
  constructor(config) {
    const player = document.createElement('div');
    player.config = config;
    players.push(player);
    return player;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  players.length = 0;
  loadTwistyPlayer.mockResolvedValue(TwistyPlayer);
});

it('maps every configured event to a cubing.js puzzle', () => {
  expect(Object.keys(puzzleByEvent).sort()).toEqual(
    Events.map(({ id }) => id).sort(),
  );
});

it('renders the static 2D end state of a scramble', async () => {
  const { getByRole } = renderPreview(
    <ScramblePreview event="pyram" scramble="R U" size={120} />,
  );

  await flushPlayerLoad();
  expect(players).toHaveLength(1);

  expect(players[0].config).toEqual({
    puzzle: 'pyraminx',
    alg: 'R U',
    visualization: '2D',
    controlPanel: 'none',
    background: 'none',
  });
  expect(players[0].timestamp).toBe('end');
  expect(getByRole('img')).toContainElement(players[0]);
});

it('enlarges the preview with its scramble text', async () => {
  const { getByLabelText, getAllByRole, getByText } = renderPreview(
    <ScramblePreview event="777" scramble="R U" />,
  );
  await flushPlayerLoad();

  fireEvent.click(getByLabelText('Enlarge 777 scramble preview'));
  await flushPlayerLoad();

  expect(getByLabelText('777 enlarged scramble preview')).toBeInTheDocument();
  expect(getByText('R U')).toBeInTheDocument();
  expect(getAllByRole('img')).toHaveLength(1);
  expect(getAllByRole('img')[0]).toHaveStyle('width: 100%');
  expect(players).toHaveLength(2);
});

it('replaces and removes the player when the scramble changes', async () => {
  const { rerender, unmount, getByRole } = render(
    <ScramblePreview event="333" scramble="R U" />,
  );
  await flushPlayerLoad();
  expect(players).toHaveLength(1);

  rerender(<ScramblePreview event="333" scramble="F R" />);
  await flushPlayerLoad();
  expect(players).toHaveLength(2);

  expect(getByRole('img')).not.toContainElement(players[0]);
  expect(getByRole('img')).toContainElement(players[1]);

  unmount();
  expect(players[1].parentNode).toBeNull();
});

it('renders nothing without a supported event and scramble', () => {
  const { container, rerender } = render(
    <ScramblePreview event="unknown" scramble="R U" />,
  );
  expect(container.innerHTML).toBe('');

  rerender(<ScramblePreview event="333" scramble="" />);
  expect(container.innerHTML).toBe('');
  expect(loadTwistyPlayer).not.toHaveBeenCalled();
});

it('keeps the room usable if cubing.js cannot load', async () => {
  loadTwistyPlayer.mockRejectedValue(new Error('preview failed'));
  const { getByRole } = render(
    <ScramblePreview event="333" scramble="R U" />,
  );

  await act(async () => {});

  expect(getByRole('img').innerHTML).toBe('');
});
