import express from 'express';
import cors from 'cors';
import config from 'config';
import logError from './middlewares/error/log-error';
import respondError from './middlewares/error/error-responder';
import notFound from './middlewares/not-found';
import authEnforce from './middlewares/auth-enforce';
import postsRouter from './routers/posts';
import feedRouter from './routers/feed';
import commentsRouter from './routers/comments';
import sequelize, { ensureDatabaseExists } from './db/sequelize';
import { seedPostsAndCommentsIfEmpty } from './db/seed-loader';
import { syncPostImageUrlsToS3 } from './db/seed-post-image-sync';
import { startOutboxPoller } from './mq/outbox';

const port = config.get<number>('app.port');
const name = config.get<string>('app.name');

(async () => {
    const app = express();
    app.use('/', cors())
    app.use('/', authEnforce)
    app.use('/posts', postsRouter)
    app.use('/feed', feedRouter)
    app.use('/comments', commentsRouter)

    app.use('/', notFound)

    app.use('/', logError)
    app.use('/', respondError)

    await ensureDatabaseExists()
    await sequelize.sync()

    await seedPostsAndCommentsIfEmpty()
    await syncPostImageUrlsToS3()

    app.listen(port, () => {
        console.log(`app ${name} is running on port ${port}`);
    });

    startOutboxPoller()
})();
