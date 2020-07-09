const Events = [{
  id: '333',
  scrambler: '333',
  name: '3x3',
  group: 'WCA',
}, {
  id: '222',
  scrambler: '222',
  name: '2x2',
  group: 'WCA',
}, {
  id: '444',
  scrambler: '444',
  name: '4x4',
  group: 'WCA',
}, {
  id: '555',
  scrambler: '555',
  name: '5x5',
  group: 'WCA',
}, {
  id: '666',
  scrambler: '666',
  name: '6x6',
  group: 'WCA',
}, {
  id: '777',
  scrambler: '777',
  name: '7x7',
  group: 'WCA',
}, {
  id: '333bf',
  scrambler: '333',
  name: '3x3 Blindfolded',
  group: 'WCA',
// }, {
  // id: '333fm',
  // scrambler: '333',
  // name: '3x3x3 Fewest Moves',
}, {
  id: '333oh',
  scrambler: '333',
  name: '3x3 One-Handed',
  group: 'WCA',
}, {
  id: '333ft',
  scrambler: '333',
  name: '3x3 With Feet',
  group: 'WCA',
}, {
  id: 'minx',
  scrambler: 'minx',
  name: 'Megaminx',
  group: 'WCA',
}, {
  id: 'pyram',
  scrambler: 'pyram',
  name: 'Pyraminx',
  group: 'WCA',
}, {
  id: 'clock',
  scrambler: 'clock',
  name: 'Clock',
  group: 'WCA',
}, {
  id: 'skewb',
  scrambler: 'skewb',
  name: 'Skewb',
  group: 'WCA',
}, {
  id: 'sq1',
  scrambler: 'sq1',
  name: 'Square-1',
  group: 'WCA',
}, {
  id: '444bf',
  scrambler: '444',
  name: '4x4 Blindfolded',
  group: 'WCA',
}, {
  id: '555bf',
  scrambler: '555',
  name: '5x5 Blindfolded',
  group: 'WCA',
// }, {
//   id: '333mbf',
//   name: '3x3x3 Multi-Blind',
}, {
  id: 'fto',
  scrambler: 'fto',
  name: 'FTO',
  group: 'Other',
}, {
  id: 'pll',
  scrambler: 'pll',
  name: 'PLL',
  group: 'Other',
}, {
  id: 'zbll',
  scrambler: 'zbll',
  name: 'ZBLL',
  group: 'Other',
}, {
  id: 'lse',
  scrambler: 'lse',
  name: 'Last Six Edges',
  group: 'Other',
}, {
  id: 'ru',
  scrambler: 'ru',
  name: 'RU 2gen',
  group: 'Other',
}];

module.exports.Events = Events;

module.exports.getNameFromId = (eventId) => Events.find((e) => e.id === eventId).name;
