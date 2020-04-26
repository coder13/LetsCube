import { USER_COUNT_UPDATED } from './actions';

const INITIAL_STATE = {
    user_count = 0,
}

const reducers = {
    [USER_COUNT_UPDATED]: (state, action) => ({...state, user_count: action.userCount}),
}

serverReducer(state = INITIAL_STATE, action) {
    if(reducers[action.type]) {
        return reducers[action.type](state, action);
    }
    return state;
}

export default serverReducer;