import React, {
  createContext, useState, useCallback, useContext,
} from 'react';
import PropTypes from 'prop-types';
import StatsDialog from './StatsDialog';

const StatsDialogContext = createContext();

export const StatsDialogProvider = ({ children }) => {
  const [options, setOptions] = useState({});
  const [open, setOpen] = useState(false);

  const showStats = useCallback((opts) => {
    setOptions(opts);
    setOpen(true);
  }, []);

  const handleClose = () => {
    setOpen(false);
    setOptions({});
  };

  return (
    <>
      <StatsDialogContext.Provider value={showStats}>
        { children }
      </StatsDialogContext.Provider>
      <StatsDialog
        open={open}
        title={options.title}
        stats={options.stats}
        onClose={handleClose}
      />
    </>
  );
};

StatsDialogProvider.propTypes = {
  children: PropTypes.arrayOf(PropTypes.element).isRequired,
};

export const useStatsDialog = () => useContext(StatsDialogContext);
