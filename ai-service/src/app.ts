import express from 'express';
import cors from 'cors';
import config from 'config';
import logError from './middlewares/error/log-error';
import respondError from './middlewares/error/error-responder';
import notFound from './middlewares/not-found';
import authEnforce from './middlewares/auth-enforce';
import draftsRouter from './routers/drafts';

const port = config.get<number>('app.port');
const name = config.get<string>('app.name');

const app = express();
app.use('/', cors())
app.use('/', authEnforce)
app.use('/drafts', draftsRouter)

app.use('/', notFound)

app.use('/', logError)
app.use('/', respondError)

app.listen(port, () => {
    console.log(`app ${name} is running on port ${port}`);
});
