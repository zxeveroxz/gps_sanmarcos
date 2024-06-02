const express = require('express');
const { fetchData } = require('./fetchData');
const { getState } = require('./state');

const app = express();
const PORT = 8080;

app.get('/estado', (req, res) => {
    const state = getState();
    res.json(state.error ? { estado: 'error', error: state.error } : { estado: 'ok' });
});

app.get('/datos', (req, res) => {
    const state = getState();
    res.json(state.data ? state.data : { error: 'No data available' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    fetchData();
    setInterval(fetchData, 50000);
});
