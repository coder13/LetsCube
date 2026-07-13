import Events from 'letscube-scrambles/events';

export { Events };

export const getNameFromId = (eventId) => Events.find((event) => event.id === eventId).name;
