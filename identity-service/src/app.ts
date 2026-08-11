import express from 'express';
import cors from 'cors';
import config from 'config';
import logError from './middlewares/error/log-error';
import respondError from './middlewares/error/error-responder';
import notFound from './middlewares/not-found';
import authEnforce from './middlewares/auth-enforce';
import authRouter from './routers/auth';
import usersRouter from './routers/users';
import followsRouter from './routers/follows';
import profileRouter from './routers/profile';
import sequelize, { ensureDatabaseExists } from './db/sequelize';
import { seedUsersAndFollowsIfEmpty } from './db/seed-loader';
import { syncSeedAvatarUrls } from './db/seed-avatar-sync';
import { startOutboxPoller } from './mq/outbox';

const port = config.get<number>('app.port');
const name = config.get<string>('app.name');

(async () => {
    const app = express();
    app.use('/', cors())
    app.use('/auth', authRouter)
    app.use('/', authEnforce)
    app.use('/users', usersRouter)
    app.use('/follows', followsRouter)
    app.use('/profile', profileRouter)

    app.use('/', notFound)

    app.use('/', logError)
    app.use('/', respondError)

    await ensureDatabaseExists()
    await sequelize.sync()

    await seedUsersAndFollowsIfEmpty()
    await syncSeedAvatarUrls()

    app.listen(port, () => {
        console.log(`app ${name} is running on port ${port}`);
    });

    startOutboxPoller()
})();
