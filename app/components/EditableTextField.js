import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';

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

function EditableTextField({ label, value, onChange }) {
  const classes = useStyles();
  const [editing, setEditing] = useState(false);
  const [_value, setValue] = useState(value);
  const [error, setError] = useState();

  const startEditing = () => {
    setEditing(true);
    setError(false);
  };

  const handleChange = (event) => {
    if (event.target.value.length < 20) {
      setValue(event.target.value);
    }
  };

  const cancel = () => {
    setEditing(false);
    setValue(value);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    // TODO: username validation
    if (_value !== value) {
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
};

EditableTextField.defaultProps = {
  value: undefined,
};

export default EditableTextField;
