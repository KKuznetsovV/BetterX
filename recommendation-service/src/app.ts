import express from 'express';
import cors from 'cors';
import config from 'config';
import logError from './middlewares/error/log-error';
import respondError from './middlewares/error/error-responder';
import notFound from './middlewares/not-found';
import authEnforce from './middlewares/auth-enforce';
import recommendationsRouter from './routers/recommendations';
import pgvectorDb, { ensureVectorExtension } from './db/sequelize';
import { backfillMissingPostEmbeddings } from './embeddings/backfill';
import { startEventConsumer } from './mq/consumer';

const port = config.get<number>('app.port');
const name = config.get<string>('app.name');

(async () => {
    const app = express();
    app.use('/', cors())
    app.use('/', authEnforce)
    app.use('/recommendations', recommendationsRouter)

    app.use('/', notFound)

    app.use('/', logError)
    app.use('/', respondError)

    await ensureVectorExtension()
    await pgvectorDb.sync()

    app.listen(port, () => {
        console.log(`app ${name} is running on port ${port}`);
    });

    // Never block startup on content-service being reachable yet.
    void backfillMissingPostEmbeddings()

    // Never block startup on RabbitMQ being reachable yet.
    void startEventConsumer()
})();
