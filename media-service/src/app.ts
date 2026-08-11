import express from 'express';
import cors from 'cors';
import config from 'config';
import logError from './middlewares/error/log-error';
import respondError from './middlewares/error/error-responder';
import notFound from './middlewares/not-found';
import authEnforce from './middlewares/auth-enforce';
import uploadsRouter from './routers/uploads';
import mediaRouter from './routers/media';
import { createAppBucketIfNotExists, createAvatarsBucketIfNotExists, seedAvatarsToS3 } from './aws/aws';

const port = config.get<number>('app.port');
const name = config.get<string>('app.name');

(async () => {
    const app = express();
    app.use('/', cors())
    app.use('/', authEnforce)
    app.use('/uploads', uploadsRouter)
    app.use('/media', mediaRouter)

    app.use('/', notFound)

    app.use('/', logError)
    app.use('/', respondError)

    await createAppBucketIfNotExists()
    await createAvatarsBucketIfNotExists()
    await seedAvatarsToS3()

    app.listen(port, () => {
        console.log(`app ${name} is running on port ${port}`);
    });
})();
