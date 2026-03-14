import express from 'express';
import { authenticate, managerOnly, optionalAuthenticate, upload, handleUploadError } from '../middleware/index.js';
import {
  // Flower
  getFlowers,
  createFlower,
  updateFlower,
  deleteFlower,
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
  // Disposables
  getDisposableBases,
  createDisposableBase,
  updateDisposableBase,
  deleteDisposableBase,
  addDisposableStrain,
  updateDisposableStrain,
  deleteDisposableStrain,
  getDisposableTypes,
  createDisposableType,
  deleteDisposableType,
  // Edibles
  getEdibleTypes,
  createEdibleType,
  deleteEdibleType,
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
router.get('/flower', optionalAuthenticate, getFlowers);
router.get('/concentrates', optionalAuthenticate, getConcentrateBases);
router.get('/disposables', optionalAuthenticate, getDisposableBases);
router.get('/edibles', optionalAuthenticate, getEdibles);

// =====================
// PROTECTED ROUTES (Manager only)
// =====================

router.use(authenticate, managerOnly);

// Concentrate Types
router.get('/concentrate-types', getConcentrateTypes);
router.post('/concentrate-types', createConcentrateType);
router.delete('/concentrate-types/:id', deleteConcentrateType);

// Disposable Types
router.get('/disposable-types', getDisposableTypes);
router.post('/disposable-types', createDisposableType);
router.delete('/disposable-types/:id', deleteDisposableType);

// Edible Types
router.get('/edible-types', getEdibleTypes);
router.post('/edible-types', createEdibleType);
router.delete('/edible-types/:id', deleteEdibleType);

// Flower
router.post('/flower', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, createFlower);
router.patch('/flower/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, updateFlower);
router.delete('/flower/:id', deleteFlower);

// Concentrates
router.post('/concentrates', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, createConcentrateBase);
router.patch('/concentrates/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, updateConcentrateBase);
router.delete('/concentrates/:id', deleteConcentrateBase);

// Concentrate Strains
router.post('/concentrates/:baseId/strains', addConcentrateStrain);
router.patch('/concentrates/strains/:strainId', updateConcentrateStrain);
router.delete('/concentrates/strains/:strainId', deleteConcentrateStrain);

// Disposables
router.post('/disposables', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, createDisposableBase);
router.patch('/disposables/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), handleUploadError, updateDisposableBase);
router.delete('/disposables/:id', deleteDisposableBase);

// Disposable Strains
router.post('/disposables/:baseId/strains', addDisposableStrain);
router.patch('/disposables/strains/:strainId', updateDisposableStrain);
router.delete('/disposables/strains/:strainId', deleteDisposableStrain);

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
