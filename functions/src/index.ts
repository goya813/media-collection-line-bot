import * as functions from 'firebase-functions';
import * as express from 'express';
import * as Line from '@line/bot-sdk';
import * as firebase_admin from 'firebase-admin';
import * as moment from 'moment';
import axios from 'axios';


firebase_admin.initializeApp();
const bucket = firebase_admin.storage().bucket();

const channelAccessToken: string = process.env.ACCESS_TOKEN!;
const channelSecret: string = process.env.CHANNEL_SECRET!;

const config: Line.ClientConfig = {
    channelAccessToken: channelAccessToken,
    channelSecret: channelSecret,
};

const app: express.Express = express();

app.post('/webhook', Line.middleware(<Line.MiddlewareConfig>config), (req, res) => {
    console.log('/webhook/ received');
    Promise
        .all(req.body.events.map(handleEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});

const client = new Line.Client(config);
async function handleEvent(event: Line.WebhookEvent) {
    if (event.type !== 'message') {
        console.log(`event.type=>(${event.type})`);
        return Promise.resolve(null);
    }
    if (event.message.type !== 'text') {
        console.log(`event.message.type=>(${event.message.type})`);

        if (event.message.type === 'image' && event.message.contentProvider.type === 'line') {
            console.log(`image binary url: https://api-data.line.me/v2/bot/message/${event.message.id}/content`);
            const image = await fetch_posted_image(event.message.id);

            await upload_posted_image(image);
        }

        return Promise.resolve(null);
    }

    console.log(`Received message: ${event.message.text}`);

    const echo: Line.TextMessage = { type: 'text', text: event.message.text };

    return client.replyMessage(event.replyToken, echo);
}

async function fetch_posted_image(message_id: string) {
    const res = await axios.get(`https://api-data.line.me/v2/bot/message/${message_id}/content`, {
         responseType: 'arraybuffer',
         headers: {'Authorization': `Bearer ${channelAccessToken}`}
    });

    return res.data;
}

async function upload_posted_image(image: any) {
    const now = moment();
    const ext = 'png';  // 一旦png
    const file = bucket.file(`${now.format('YYYY-MM-DDTHH:mm:ss.SSSZ')}.${ext}`);

    file.save(image, err => {
        if (err) {
            file.deleteResumableCache();
        }
    });
}

const api = functions.https.onRequest(app);
module.exports = { api };
