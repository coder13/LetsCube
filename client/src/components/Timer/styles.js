export default (theme) => ({
  root: {
    display: 'flex',
    width: '100%',
    height: '6rem',
    flexGrow: 0,
    textAlign: 'center',
    flexDirection: 'column',
    padding: 'auto',
    justifyContent: 'center',
  },
  disabled: {
    color: theme.palette.text.disabled,
  },
  PRIMING: {
    color: theme.palette.common.green,
  },
  INSPECTING_PRIMING: {
    color: theme.palette.common.green,
  },
  INSPECTING: {
    color: theme.palette.common.red,
  },
  fullscreen: {
    position: 'fixed',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: theme.zIndex.tooltip + 1,
    backgroundColor: theme.palette.background.paper,
    transition: `background-color .2s ${theme.transitions.easing.easeInOut}`,
  },
  timerText: {
    fontSize: '3rem',
    fontWeight: 300,
  },
});
