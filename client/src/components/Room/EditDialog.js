import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogActions,
  DialogTitle,
  DialogContent,
  TextField,
} from '@material-ui/core';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { formatRawTime } from '../../lib/utils';

function EditDialog({
  editTime,
  open,
  solveNum,
  result: { time, penalties },
  onClose,
}) {
  // State hooks to store raw time and penalties
  const [auf, setAuf] = useState(penalties ? penalties.AUF : false);
  const [dnf, setDnf] = useState(penalties ? penalties.DNF : false);
  const [timeInput, setTimeInput] = useState(time - (auf ? 2000 : 0));

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

  const editTimeCallback = useCallback(() => {
    editTime(timeInput, penalties, auf, dnf);
  }, [editTime, timeInput, penalties, auf, dnf]);

  return (
    <Dialog fullWidth open={open}>
      <DialogTitle>
        {`Edit result for solve ${solveNum}`}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          id="time"
          label="Enter original time without penalties (e.g. 12.34)"
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
        <Button onClick={onClose} color="default">
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
  solveNum: PropTypes.number,
  result: PropTypes.shape({
    time: PropTypes.number,
    penalties: PropTypes.shape(),
  }),
  onClose: PropTypes.func,
};

EditDialog.defaultProps = {
  open: false,
  solveNum: 1,
  result: {
    time: null,
    penalties: {},
  },
  onClose: () => {},
};

export default EditDialog;
