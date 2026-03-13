import express from 'express';
import { authenticate } from '../middleware/index.js';
import {
	getStrains,
	getStrainsFromAi,
	getStrainMatchesFromAi,
	getStrainFilters,
} from '../controllers/strainsControllerV2.js';

const router = express.Router();

router.use(authenticate);
router.get('/ai', getStrainsFromAi);
router.get('/ai/search', getStrainMatchesFromAi);
router.get('/ai/details', getStrainsFromAi);
router.get('/filters', getStrainFilters);
router.get('/', getStrains);

export default router;
