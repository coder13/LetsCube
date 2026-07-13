const { Scrambow } = require('scrambow');

function generateScrambowScramble(scramblerType) {
  return new Scrambow().setType(scramblerType).get(1)[0].scramble_string;
}

module.exports = { generateScrambowScramble };
