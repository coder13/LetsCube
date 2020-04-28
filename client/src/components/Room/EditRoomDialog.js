import React from 'react';
import PropTypes from 'prop-types';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
// import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';

function EditRoomDialog({ open, onSave, onCancel }) {
  const [roomName] = React.useState('');
  const [isPrivate] = React.useState(false);
  const [pswd] = React.useState('');

  const handleCancel = () => {
    onCancel();
  }

  const handleSave = () => {
    onSave({
      name: roomName,
      private: isPrivate,
      password: pswd,
    });
  }

  return (
    <Dialog open={open} onClose={handleCancel}>
      <DialogTitle>Edit Room</DialogTitle>
      <DialogActions>
        <Button onClick={handleCancel} color="secondary">Cancel</Button>
        <Button onClick={handleSave} color="primary" disabled={!roomName || (isPrivate && !pswd)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

EditRoomDialog.propTypes = {
  open: PropTypes.bool,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

EditRoomDialog.defaultProps = {
  open: false,
};

export default EditRoomDialog;
