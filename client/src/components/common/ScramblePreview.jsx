import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import loadTwistyPlayer from '../../lib/cubingTwisty';
import Scramble from './Scramble';

export const puzzleByEvent = {
  222: '2x2x2',
  333: '3x3x3',
  '333bf': '3x3x3',
  '333oh': '3x3x3',
  '333ft': '3x3x3',
  444: '4x4x4',
  '444bf': '4x4x4',
  555: '5x5x5',
  '555bf': '5x5x5',
  666: '6x6x6',
  777: '7x7x7',
  minx: 'megaminx',
  pyram: 'pyraminx',
  clock: 'clock',
  'clock-optimal': 'clock',
  skewb: 'skewb',
  sq1: 'square1',
  fto: 'fto',
  pll: '3x3x3',
  zbll: '3x3x3',
  lse: '3x3x3',
  ru: '3x3x3',
};

function TwistyVisualization({ event, puzzle, scramble, size, expanded }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    let player;

    if (!puzzle || !scramble) {
      return undefined;
    }

    loadTwistyPlayer().then((TwistyPlayer) => {
      if (disposed) {
        return;
      }

      player = new TwistyPlayer({
        puzzle,
        alg: scramble,
        visualization: '2D',
        controlPanel: 'none',
        background: 'none',
      });
      // cubing.js 0.63.3 exposes this setter but rejects timestamp in constructor config.
      player.timestamp = 'end';
      player.style.width = '100%';
      player.style.height = '100%';
      containerRef.current.appendChild(player);
    }).catch(() => {
      // The scramble text remains available if the preview cannot be rendered.
    });

    return () => {
      disposed = true;
      if (player && player.parentNode) {
        player.parentNode.removeChild(player);
      }
    };
  }, [puzzle, scramble]);

  if (!puzzle || !scramble) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`${event} scramble preview`}
      style={{
        width: '100%',
        height: expanded ? 'min(70vh, 640px)' : size,
        maxWidth: expanded ? 640 : size,
      }}
    />
  );
}

TwistyVisualization.propTypes = {
  event: PropTypes.string.isRequired,
  puzzle: PropTypes.string.isRequired,
  scramble: PropTypes.string.isRequired,
  size: PropTypes.number.isRequired,
  expanded: PropTypes.bool,
};

TwistyVisualization.defaultProps = {
  expanded: false,
};

function ScramblePreview({ event, scramble, size }) {
  const [expanded, setExpanded] = useState(false);
  const puzzle = puzzleByEvent[event];

  if (!puzzle || !scramble) {
    return null;
  }

  const handleKeyDown = (keyEvent) => {
    if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
      keyEvent.preventDefault();
      setExpanded(true);
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Enlarge ${event} scramble preview`}
        onClick={() => setExpanded(true)}
        onKeyDown={handleKeyDown}
        style={{ cursor: 'zoom-in', width: '100%', maxWidth: size }}
      >
        <TwistyVisualization
          event={event}
          puzzle={puzzle}
          scramble={scramble}
          size={size}
        />
      </div>
      <Dialog
        fullWidth
        maxWidth="md"
        open={expanded}
        onClose={() => setExpanded(false)}
        aria-label={`${event} enlarged scramble preview`}
      >
        <DialogContent style={{ textAlign: 'center' }}>
          <Scramble event={event} scrambles={[scramble]} />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <TwistyVisualization
              expanded
              event={event}
              puzzle={puzzle}
              scramble={scramble}
              size={size}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

ScramblePreview.propTypes = {
  event: PropTypes.string.isRequired,
  scramble: PropTypes.string,
  size: PropTypes.number,
};

ScramblePreview.defaultProps = {
  scramble: '',
  size: 240,
};

export default ScramblePreview;
