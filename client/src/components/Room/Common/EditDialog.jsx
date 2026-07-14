import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { formatRawTime, parseTime } from '../../../lib/utils';

function EditDialog({
  editTime,
  open,
  userId,
  solveNum,
  result: { time, penalties },
  onClose,
}) {
  // State hooks to store raw time and penalties
  const [auf, setAuf] = useState(penalties ? penalties.AUF : false);
  const [dnf, setDnf] = useState(penalties ? penalties.DNF : false);
  const [timeInput, setTimeInput] = useState(time - (auf ? 2000 : 0));
  const [inputError, setInputError] = useState(false);

  // change the input fields whenever dialog's props change
  useEffect(() => {
    if (!penalties) {
      setTimeInput(formatRawTime(time));
      setAuf(false);
      setDnf(false);
      return;
    }
    setAuf(penalties.AUF);
    setDnf(penalties.DNF);
    setTimeInput(formatRawTime(time - (penalties.AUF ? 2000 : 0)));
  }, [time, penalties]);

  const resetDialog = () => {
    onClose();
    setInputError(false);
  };

  const editTimeCallback = (e) => {
    e.preventDefault();

    let t = parseTime(timeInput);
    if (!t) {
      setInputError(true);
      return;
    }
    t += (auf ? 2000 : 0);
    editTime(userId, timeInput, penalties, auf, dnf);
    setInputError(false);
  };

  return (
    <Dialog fullWidth open={open}>
      <DialogTitle>
        {`Edit result for solve ${solveNum}`}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          error={inputError}
          margin="dense"
          id="time"
          label="Enter original time without penalties (e.g. 12.34)"
          helperText={inputError ? 'Invalid input.' : ''}
          value={timeInput}
          onChange={(e) => setTimeInput(e.target.value)}
          fullWidth
        />
        <FormControlLabel
          control={<Checkbox checked={auf} onChange={(e) => setAuf(e.target.checked)} />}
          label="AUF"
        />
        <FormControlLabel
          control={<Checkbox checked={dnf} onChange={(e) => setDnf(e.target.checked)} />}
          label="DNF"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={resetDialog} color="default">
          Close
        </Button>
        <Button onClick={editTimeCallback} color="primary">
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}

EditDialog.propTypes = {
  editTime: PropTypes.func.isRequired,
  open: PropTypes.bool,
  userId: PropTypes.number,
  solveNum: PropTypes.number,
  result: PropTypes.shape({
    time: PropTypes.number,
    penalties: PropTypes.shape(),
  }),
  onClose: PropTypes.func,
};

EditDialog.defaultProps = {
  open: false,
  userId: null,
  solveNum: 1,
  result: {
    time: null,
    penalties: {},
  },
  onClose: () => {},
};

export default EditDialog;
