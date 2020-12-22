import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';
import PropTypes from 'prop-types';
import EditDialog from './EditDialog';
import { sendEditResult } from '../../../store/room/actions';
import { parseTime } from '../../../lib/utils';

const EditDialogContext = createContext();

// Function that dispatches an edit action to server
const editTime = (dispatch, attemptId, onClose) => (timeInput, penalties, auf, dnf) => {
  const t = parseTime(timeInput) + (auf ? 2000 : 0);
  dispatch(sendEditResult({
    id: attemptId,
    result: {
      time: t,
      penalties: {
        ...penalties,
        AUF: auf,
        DNF: dnf,
      },
    },
  }));
  onClose();
};

export const EditDialogProvider = ({ dispatch, children }) => {
  const [result, setResult] = useState({});
  const [open, setOpen] = useState(false);

  const prefillEditDialog = useCallback((r) => {
    setResult(r);
    setOpen(true);
  }, []);

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <EditDialogContext.Provider value={prefillEditDialog}>
        {children}
      </EditDialogContext.Provider>
      <EditDialog
        open={open}
        solveNum={result.solve}
        result={result.result}
        onClose={handleClose}
        editTime={editTime(dispatch, result.id, handleClose)}
      />
    </>
  );
};

EditDialogProvider.propTypes = {
  dispatch: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

export const useEditDialog = () => useContext(EditDialogContext);
