const isRoomTypeEnabled = (type, grandPrixEnabled) => (
  type !== 'grand_prix' || grandPrixEnabled
);

module.exports = { isRoomTypeEnabled };
