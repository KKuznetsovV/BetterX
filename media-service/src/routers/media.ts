import { Router, json } from 'express';
import { persistImage } from '../controllers/media/controller';
import { persistImageValidator } from '../controllers/media/validator';
import validate from '../middlewares/validation';

const mediaRouter = Router();
mediaRouter.use('/', json());
mediaRouter.post('/persist-image', validate({ body: persistImageValidator }), persistImage);

export default mediaRouter;
