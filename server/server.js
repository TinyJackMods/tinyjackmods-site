require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Раздаем статические файлы сайта из корневой папки (на уровень выше от server)
app.use(express.static(path.join(__dirname, '../')));

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Настоящие AppID Steam для Jackbox игр
const STEAM_APP_MAP = {
    331670: 'JPP1',
    434170: 'JPP2',
    386940: 'JPP3',
    612630: 'JPP4',
    774801: 'JPP5',
    1005240: 'JPP6', // Jackbox Party Pack 6
    1211600: 'JPP7',
    1552350: 'JPP8',
    1832600: 'JPS',  // Jackbox Party Starter
    1850960: 'JPP9',
    1982630: 'JPP10',
    2611710: 'JNP'
};

app.get('/api/auth/steam', (req, res) => {
    const returnUrl = `${SERVER_URL}/api/auth/steam/callback`;
    const params = new URLSearchParams({
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.mode': 'checkid_setup',
        'openid.return_to': returnUrl,
        'openid.realm': SERVER_URL,
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
    });

    res.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
});

app.get('/api/auth/steam/callback', async (req, res) => {
    try {
        const openidParams = new URLSearchParams(req.query);
        openidParams.set('openid.mode', 'check_authentication');

        const validation = await axios.post('https://steamcommunity.com/openid/login', openidParams.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (!validation.data.includes('is_valid:true')) {
            return res.status(401).send('Ошибка авторизации Steam: недействительный токен');
        }

        const claimedId = req.query['openid.claimed_id'];
        const steamId = claimedId.split('/').pop();

        let playerName = 'Игрок Steam';
        let userGameKeys = new Set();
        let rawAppIds = new Set();

        // 1. Получаем никнейм
        try {
            const profileRes = await axios.get(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId}`);
            const player = profileRes.data.response?.players?.[0];
            if (player?.personaname) {
                playerName = player.personaname;
            }
        } catch (e) {
            console.error('Не удалось получить профиль Steam:', e.message);
        }

        // 2. Запрос к официальному Steam Web API
        try {
            const gamesRes = await axios.get(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&format=json&include_appinfo=1&include_played_free_games=1`);
            const ownedGames = gamesRes.data.response?.games || [];
            
            ownedGames.forEach(g => {
                rawAppIds.add(g.appid);
                if (STEAM_APP_MAP[g.appid]) {
                    userGameKeys.add(STEAM_APP_MAP[g.appid]);
                }
            });
        } catch (e) {
            console.error('Не удалось получить список игр через API:', e.message);
        }

        // 3. Если API не отдал все игры, делаем точечный поиск по страницам Steam
        if (userGameKeys.size < Object.keys(STEAM_APP_MAP).length) {
            try {
                // Запрашиваем публичный XML список
                const xmlRes = await axios.get(`https://steamcommunity.com/profiles/${steamId}/games?tab=all&xml=1`);
                const matches = [...xmlRes.data.matchAll(/<appID>(\d+)<\/appID>/g)];
                matches.forEach(m => {
                    const appId = parseInt(m[1]);
                    rawAppIds.add(appId);
                    if (STEAM_APP_MAP[appId]) userGameKeys.add(STEAM_APP_MAP[appId]);
                });

                // Если все еще не нашли JPP6 или JPS, проверяем напрямую страницы сообщества игр пользователя
                const appsToForceCheck = [1005240, 1832600, 1056090, 1921200]; // JPP6 и JPS (включая старые ID)
                
                await Promise.all(appsToForceCheck.map(async (appId) => {
                    try {
                        const checkRes = await axios.get(`https://steamcommunity.com/profiles/${steamId}/stats/${appId}/?xml=1`, { timeout: 3000 });
                        if (checkRes.data && !checkRes.data.includes('error')) {
                            rawAppIds.add(appId);
                            if (STEAM_APP_MAP[appId]) userGameKeys.add(STEAM_APP_MAP[appId]);
                        }
                    } catch (err) {
                        // Игры нет на аккаунте или профиль закрыт
                    }
                }));
            } catch (e) {
                console.error('Ошибка проверки игр:', e.message);
            }
        }

        // Формируем итоговый массив (содержит и текстовые ключи "JPP6", и числовые AppID)
        const finalGamesArray = [...Array.from(userGameKeys), ...Array.from(rawAppIds)];

        const userData = {
            isLoggedIn: true,
            steamId: steamId,
            name: playerName,
            games: finalGamesArray
        };

        res.send(`
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <title>Авторизация успешна</title>
                <style>
                    body { background: #0b0b0d; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .card { background: #151518; border: 1px solid #27272e; padding: 30px; border-radius: 4px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                    button { display: inline-block; margin-top: 20px; background: #e62335; color: white; padding: 10px 20px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 14px; }
                    button:hover { opacity: 0.9; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>Авторизация через Steam прошла успешно!</h2>
                    <p>Добро пожаловать, <b>${playerName}</b>!</p>
                    <button id="returnBtn">Вернуться на сайт TJM</button>
                </div>
                <script>
                    const userData = ${JSON.stringify(userData)};
                    localStorage.setItem('steamUser', JSON.stringify(userData));

                    document.getElementById('returnBtn').addEventListener('click', () => {
                        const returnUrl = sessionStorage.getItem('tjm_return_url') || '/index.html';
                        window.location.href = returnUrl;
                    });
                </script>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Критическая ошибка в callback:', error.message);
        res.status(500).send('Ошибка сервера при авторизации: ' + error.message);
    }
});

app.listen(3000, () => console.log('Сервер запущен на http://localhost:3000'));