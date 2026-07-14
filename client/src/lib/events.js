import Events from './events.json';

export { Events };

export const getNameFromId = (eventId) => Events.find((event) => event.id === eventId).name;
