import { Router } from 'express';
import { getPresignedUploadUrl } from '../controllers/uploads/controller';

const uploadsRouter = Router();

uploadsRouter.get('/presign', getPresignedUploadUrl);

export default uploadsRouter;
