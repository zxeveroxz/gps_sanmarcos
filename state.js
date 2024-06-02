let state = {
    authenticated: false,
    error: null,
    data: null,
};

function updateState(newState) {
    state = { ...state, ...newState };
}

function setError(error) {
    state = { ...state, authenticated: false, error, data: null };
}

function getState() {
    return state;
}

module.exports = { updateState, setError, getState };
