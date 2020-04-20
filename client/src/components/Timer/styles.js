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
    color: '#7f7f7f',
  },
  PRIMING: {
    color: 'green',
  },
  INSPECTING_PRIMING: {
    color: 'green',
  },
  INSPECTING: {
    color: 'red',
  },
  fullscreen: {
    position: 'fixed',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    zIndex: theme.zIndex.tooltip + 1,
    backgroundColor: 'white',
    transition: `background-color .2s ${theme.transitions.easing.easeInOut}`,
  },
  timerText: {
    fontSize: '3rem',
    fontWeight: 300,
  },
});
