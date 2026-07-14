import React, { useState } from 'react';
import Popover from '@mui/material/Popover';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import HelpIcon from '@mui/icons-material/Help';

const HelpPopover = () => {
  const [helpAnchor, setHelpAnchor] = useState(null);

  return (
    <div style={{ position: 'relative', width: 0, height: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0 }}>
        <IconButton
          color="inherit"
          onClick={(e) => setHelpAnchor(e.currentTarget)}
        >
          <HelpIcon />
        </IconButton>
        <Popover
          open={!!helpAnchor}
          anchorEl={helpAnchor}
          onClose={() => setHelpAnchor(null)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          <Typography style={{ paddingLeft: '.5em', paddingRight: '.5em' }}>
            <p>Press `Spacebar` to start the timer.</p>
            <p>Press any key to stop the timer.</p>
            <p>Press `Enter` to submit time.</p>
          </Typography>
        </Popover>
      </div>
    </div>
  );
};

export default HelpPopover;
