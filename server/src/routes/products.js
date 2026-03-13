import express from 'express';
import { authenticate, managerOnly, optionalAuthenticate, upload, handleUploadError } from '../middleware/index.js';
import {
  // Bulk Flower
  getBulkFlowers,
  createBulkFlower,
  updateBulkFlower,
  deleteBulkFlower,
  // Packaged Flower
  getPackagedFlowers,
  createPackagedFlower,
  updatePackagedFlower,
  deletePackagedFlower,
  // Concentrates
  getConcentrateBases,
  createConcentrateBase,
  updateConcentrateBase,
  deleteConcentrateBase,
  addConcentrateStrain,
  updateConcentrateStrain,
  deleteConcentrateStrain,
  getConcentrateTypes,
  createConcentrateType,
  deleteConcentrateType,
  getEdibleTypes,
  createEdibleType,
  deleteEdibleType,
  // Edibles
  getEdibles,
  createEdible,
  updateEdible,
  deleteEdible,
  addEdibleVariant,
  updateEdibleVariant,
  deleteEdibleVariant,
  // All Products
  getAllProducts,
  deleteProductImage,
} from '../controllers/productController.js';

const router = express.Router();

// =====================
// PUBLIC ROUTES
// =====================

// Get all active products (for customers)
router.get('/', optionalAuthenticate, getAllProducts);

// Get products by category
router.get('/bulk', optionalAuthenticate, getBulkFlowers);
router.get('/packaged', optionalAuthenticate, getPackagedFlowers);
router.get('/concentrates', optionalAuthenticate, getConcentrateBases);
router.get('/edibles', optionalAuthenticate, getEdibles);

// =====================
// PROTECTED ROUTES (Manager only)
// =====================

router.use(authenticate, managerOnly);

// Concentrate Types
router.get('/concentrate-types', getConcentrateTypes);
router.post('/concentrate-types', createConcentrateType);
router.delete('/concentrate-types/:id', deleteConcentrateType);

// Edible Types
router.get('/edible-types', getEdibleTypes);
router.post('/edible-types', createEdibleType);
router.delete('/edible-types/:id', deleteEdibleType);

// Bulk Flower
router.post('/bulk', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, createBulkFlower);
router.patch('/bulk/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, updateBulkFlower);
router.delete('/bulk/:id', deleteBulkFlower);

// Packaged Flower
router.post('/packaged', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, createPackagedFlower);
router.patch('/packaged/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, updatePackagedFlower);
router.delete('/packaged/:id', deletePackagedFlower);

// Concentrates
router.post('/concentrates', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, createConcentrateBase);
router.patch('/concentrates/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, updateConcentrateBase);
router.delete('/concentrates/:id', deleteConcentrateBase);

// Concentrate Strains
router.post('/concentrates/:baseId/strains', addConcentrateStrain);
router.patch('/concentrates/strains/:strainId', updateConcentrateStrain);
router.delete('/concentrates/strains/:strainId', deleteConcentrateStrain);

// Edibles
router.post('/edibles', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, createEdible);
router.patch('/edibles/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, updateEdible);
router.delete('/edibles/:id', deleteEdible);
router.post('/edibles/:id/variants', addEdibleVariant);
router.patch('/edibles/variants/:variantId', updateEdibleVariant);
router.delete('/edibles/variants/:variantId', deleteEdibleVariant);

// Delete product image
router.delete('/:type/:id/image', deleteProductImage);

export default router;
