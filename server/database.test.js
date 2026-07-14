/** @jest-environment node */
/* eslint-env jest */

jest.mock('mongoose', () => ({
  connect: jest.fn(),
  set: jest.fn(),
}));
jest.mock('./logger', () => ({
  debug: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');
const database = require('./database');

describe('MongoDB connection failure', () => {
  it('exits unsuccessfully so one-off privacy commands fail closed', async () => {
    const connectionError = new Error('MongoDB unavailable');
    const exitError = new Error('process exit');
    mongoose.connect.mockRejectedValue(connectionError);
    const exit = jest.spyOn(process, 'exit').mockImplementation((code) => {
      exitError.code = code;
      throw exitError;
    });

    await expect(database.connect()).rejects.toBe(exitError);
    expect(exit).toHaveBeenCalledWith(1);
    expect(exitError.code).toBe(1);

    exit.mockRestore();
  });
});
