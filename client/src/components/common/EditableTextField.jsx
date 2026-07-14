import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@mui/styles';
import Paper from '@mui/material/Paper';
import Input from '@mui/material/Input';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import ClickAwayListener from '@mui/material/ClickAwayListener';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    width: '100%',
    border: `1px solid ${theme.palette.divider}`,
    transition: '2s',
    padding: '1em',
    justifyContent: 'space-between',
    borderRadius: theme.borderRadius,
    marginBottom: '1em',
  },
  divider: {
    height: 28,
    margin: 4,
  },
}));

function EditableTextField({
  label, value, onChange, validate,
}) {
  const classes = useStyles();
  const [editing, setEditing] = useState(false);
  const [_value, setValue] = useState(value);
  const [error, setError] = useState();

  const startEditing = () => {
    setEditing(true);
    setValue(value);
    setError(false);
  };

  const handleChange = (event) => {
    setValue(event.target.value);
    setError(validate(event.target.value));
  };

  const cancel = () => {
    setEditing(false);
    setValue(value);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    // TODO: username validation
    if (_value !== value && !validate(_value)) {
      onChange(_value, (err) => {
        if (err) {
          setError(err);
        }
      });
    }
    cancel();
  };

  return (
    <ClickAwayListener
      onClickAway={cancel}
    >
      <Paper component="form" className={classes.root} onSubmit={onSubmit}>
        <FormControl
          fullWidth
          disabled={!editing}
          error={!!error}
          onClick={startEditing}
        >
          <InputLabel style={{ width: '10em' }}>{label}</InputLabel>
          <Input
            value={editing ? _value : value}
            onChange={handleChange}
            inputRef={(r) => {
              if (r) {
                r.focus();
              }
            }}
            margin="dense"
          />
          <FormHelperText>{error}</FormHelperText>
        </FormControl>
        {!editing ? (
          <Button
            variant="text"
            onClick={startEditing}
            color="primary"
            style={{
              marginLeft: 'auto',
              marginRight: 0,
              order: 2,
            }}
          >
            Change
          </Button>
        ) : (
          <ButtonGroup>
            <Button variant="text" onClick={onSubmit} color="primary" disabled={value === _value}>Change</Button>
            <Button variant="text" onClick={cancel}>Cancel</Button>
          </ButtonGroup>
        )}
      </Paper>
    </ClickAwayListener>
  );
}

EditableTextField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  validate: PropTypes.func.isRequired,
};

EditableTextField.defaultProps = {
  value: undefined,
};

export default EditableTextField;
