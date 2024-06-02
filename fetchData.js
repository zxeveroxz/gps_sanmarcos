require('dotenv').config();

const axios = require('axios');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { updateState, setError } = require('./state');

const ruta1 = process.env.GPS__RUTA1;
const ruta2 = process.env.GPS__RUTA2;
const usuario = process.env.GPS__USUARIO;
const clave = process.env.GPS__CLAVE;

const COOKIE_DIR = './GALLETAS';
const COOKIE_PATH = path.join(COOKIE_DIR, 'cookies.json');

if (!fs.existsSync(COOKIE_DIR)) {
    fs.mkdirSync(COOKIE_DIR, { recursive: true });
}

const cookieJar = new tough.CookieJar();
const client = wrapper(axios.create({
    jar: cookieJar,
    withCredentials: true,
}));

let intento = 0;

async function authenticate() {
    console.log('Vamos a comenzar la autenticación...');
    try {
        const loginResponse = await client.get(ruta1, {
            headers: { 'User-Agent': 'Mozilla/6.0 (compatible; MSIE 7.0; Windows NT 6.1)' },
            validateStatus: false,
        });

        let result = loginResponse.data;
        result = result.replace('method="post" action="./LoginV4.aspx"', 'method="POST" action="inde2.php"');
        const $ = cheerio.load(result);
        const viewState = $('#__VIEWSTATE').val();
        const eventValidation = $('#__EVENTVALIDATION').val();
        const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val();
        const fieldsString = `__EVENTTARGET=btningresar&__EVENTARGUMENT=&__VIEWSTATE=${encodeURIComponent(viewState)}&__VIEWSTATEGENERATOR=${encodeURIComponent(viewStateGenerator)}&__EVENTVALIDATION=${encodeURIComponent(eventValidation)}&txusuario=${usuario}&txclave=${clave}&hdintentos=1`;

        await client.post(ruta1, fieldsString, {
            headers: {
                'User-Agent': 'Mozilla/6.0 (compatible; MSIE 7.0; Windows NT 6.1)',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            validateStatus: false,
        });

        console.log('Autenticación completada.');

        const cookieJSON = JSON.stringify(cookieJar.toJSON());
        fs.writeFileSync(COOKIE_PATH, cookieJSON);

    } catch (error) {
        console.error('Error durante la autenticación:', error);
        setError('Error durante la autenticación');
    }
}

function removeQuotes(dataArray) {
    return dataArray.map(item => item.replace(/^'(.*)'$/, '$1'));
}

async function fetchData() {
    try {
        console.log("VAMOS A LEER LAS COORDENADAS");

        if (!fs.existsSync(COOKIE_PATH)) {
            console.log('Archivo de cookies no encontrado. Autenticando...');
            await authenticate();
        }

        const cookieData = fs.readFileSync(COOKIE_PATH, 'utf-8');
        const cookies = JSON.parse(cookieData);
        const cookieJar2 = tough.CookieJar.fromJSON(cookies);

        const client2 = wrapper(axios.create({
            jar: cookieJar2,
            withCredentials: true,
        }));

        const mainResponse = await client2.get(ruta2, {
            headers: { 'User-Agent': 'Mozilla/6.0 (compatible; MSIE 7.0; Windows NT 6.1)' },
            validateStatus: false,
        });

        let html = mainResponse.data;
        const $main = cheerio.load(html);
        let scriptsContent = '';
        $main('script').each((i, script) => {
            scriptsContent += $main(script).html() + '<hr>';
        });

        const markerMatches = scriptsContent.match(/addMarcadorGoogle\(.*?\);/gi) || [];
        const markers = { est: 'error', autor: 'Sergio Zegarra' };
        markerMatches.forEach((marker, index) => {
            const data = marker.replace('addMarcadorGoogle(', '').replace(');', '').split(',');
            markers[index] = { data };
            markers.est = 'ok';
        });
        markers.tot = markerMatches.length;

        for (const key in markers) {
            if (markers[key].data) {
                markers[key].data = removeQuotes(markers[key].data);
            }
        }

        const markerKeys = Object.keys(markers).filter(key => key !== 'est' && key !== 'tot' && key !== 'autor');
        console.log("Total de Markers: ", markerKeys.length);

        updateState({ authenticated: true, error: null, data: markers });

        if (markers.est === 'error' && markers.tot === 0) {
            intento++;
            if (intento < 5) {
                console.log(`Reintentando (${intento}/5)...`);
                updateState({ authenticated: false, error: `Reintentando (${intento}/5)...` });
                await fetchData();
            } else {
                console.log('Eliminando archivo de cookies y reintentando autenticación...');
                updateState({ authenticated: false, error: 'Eliminando archivo de cookies y reintentando autenticación...' });
                fs.unlinkSync(COOKIE_PATH);
                intento = 0;
                await authenticate();
                await fetchData();
            }
        } else {
            intento = 0;
        }

    } catch (error) {
        console.error('Error al obtener los datos:', error);
        setError('Error al obtener los datos');
        setTimeout(async () => {
            await fetchData();
        }, 30000);
    }
}

module.exports = { fetchData };
