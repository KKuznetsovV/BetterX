import express from 'express';
import cors from 'cors';
import config from 'config';
import logError from './middlewares/error/log-error';
import respondError from './middlewares/error/error-responder';
import notFound from './middlewares/not-found';
import authEnforce from './middlewares/auth-enforce';
import notificationsRouter from './routers/notifications';
import sequelize, { ensureDatabaseExists } from './db/sequelize';
import { startEventConsumer } from './mq/consumer';

const port = config.get<number>('app.port');
const name = config.get<string>('app.name');

(async () => {
    const app = express();
    app.use('/', cors())
    app.use('/', authEnforce)
    app.use('/notifications', notificationsRouter)

    app.use('/', notFound)

    app.use('/', logError)
    app.use('/', respondError)

    await ensureDatabaseExists()
    await sequelize.sync()

    app.listen(port, () => {
        console.log(`app ${name} is running on port ${port}`);
    });

    // Never block startup on RabbitMQ being reachable yet - connectWithRetry
    // handles transient unavailability on its own.
    void startEventConsumer()
})();
