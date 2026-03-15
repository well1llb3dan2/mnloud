import { 
  Flower, 
  ConcentrateBase, 
  ConcentrateStrain, 
  DisposableBase,
  DisposableStrain,
  Edible,
  Strain,
  ConcentrateType,

  EdibleType,
} from '../models/index.js';
import { emitToRoom } from '../socket/bus.js';
import { storeUpload, deleteMedia, getSignedMediaUrl, isR2Active } from '../utils/storage.js';
import { stripAudio } from '../utils/stripAudio.js';
// Helper to attach signed media URLs
const attachMediaUrls = async (product, role = 'customer') => {
  if (!product) return product;
  if (!isR2Active(role)) return product;
  const imageUrl = await getSignedMediaUrl(product.image, { role });
  const videoUrl = await getSignedMediaUrl(product.video, { role });
  return { ...product, imageUrl, videoUrl };
};

const parseListField = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
};

const parseNumberField = (value, isInt = false) => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = isInt ? parseInt(value, 10) : parseFloat(value);
  return Number.isNaN(num) ? undefined : num;
};

const parseBooleanField = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = String(value).trim().toLowerCase();
  if (text === 'true' || text === '1' || text === 'yes') return true;
  if (text === 'false' || text === '0' || text === 'no') return false;
  return undefined;
};

const deriveStrainType = (variety) => {
  if (!variety) return undefined;
  const text = String(variety).toLowerCase();
  if (text.includes('hybrid')) {
    if (text.includes('sativa')) return 'hybrid-s';
    if (text.includes('indica')) return 'hybrid-i';
    return 'hybrid-s';
  }
  if (text.includes('sativa')) return 'sativa';
  if (text.includes('indica')) return 'indica';
  return undefined;
};

const normalizeStrainPayload = (data) => {
  const effects = parseListField(data.effects);
  if (effects) data.effects = effects;

  const flavors = parseListField(data.flavors);
  if (flavors) data.flavors = flavors;

  const mayRelieve = parseListField(data.may_relieve);
  if (mayRelieve) data.may_relieve = mayRelieve;

  const terpenes = parseListField(data.terpenes);
  if (terpenes) data.terpenes = terpenes;

  const thcPercent = parseNumberField(data.thc_percent);
  if (thcPercent !== undefined) {
    data.thc_percent = thcPercent;
    if (data.thcPercentage === undefined || data.thcPercentage === '') {
      data.thcPercentage = thcPercent;
    }
  }

  if (data.lineage !== undefined && data.lineage !== null) {
    data.lineage = String(data.lineage).trim();
  }

  if (!data.strainType && data.variety) {
    const derived = deriveStrainType(data.variety);
    if (derived) data.strainType = derived;
  }
};

const compactStrainPayload = (data) => {
  const payload = {};
  const setIfDefined = (key, value) => {
    if (value === undefined || value === null || value === '') return;
    payload[key] = value;
  };

  setIfDefined('name', data.name || data.strain);
  setIfDefined('variety', data.variety);
  setIfDefined('thc_percent', data.thc_percent);
  if (Array.isArray(data.effects) && data.effects.length) payload.effects = data.effects;
  if (Array.isArray(data.flavors) && data.flavors.length) payload.flavors = data.flavors;
  if (Array.isArray(data.may_relieve) && data.may_relieve.length) payload.may_relieve = data.may_relieve;
  if (Array.isArray(data.terpenes) && data.terpenes.length) payload.terpenes = data.terpenes;
  setIfDefined('lineage', data.lineage);
  setIfDefined('description', data.description);

  if (payload.name) {
    payload.nameLower = String(payload.name).trim().toLowerCase();
  }

  return payload;
};

const upsertStrainRecord = async (data) => {
  const payload = compactStrainPayload(data);
  if (!payload.name || !payload.nameLower) return;
  try {
    const { nameLower, ...setPayload } = payload;
    await Strain.findOneAndUpdate(
      { nameLower },
      { $set: setPayload, $setOnInsert: { nameLower } },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.warn('Strain upsert failed:', error);
  }
};

// =====================
// FLOWER
// =====================

export const getFlowers = async (req, res) => {
  try {
    const { active } = req.query;
    const filter = active === 'true' ? { isActive: true } : {};
    const sort = { createdAt: -1, _id: -1 };
    
    const flowers = await Flower.find(filter)
      .populate('priceTier')
      .sort(sort);
    
    const role = req.user?.role || 'customer';
    const products = await Promise.all(
      flowers.map((flower) => attachMediaUrls(flower.toObject(), role))
    );

    res.json({ products });
  } catch (error) {
    console.error('Get flowers error:', error);
    res.status(500).json({ message: 'Server error fetching flowers' });
  }
};

export const createFlower = async (req, res) => {
  try {
    const data = req.body;

    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    if (data.isActive === undefined) {
      data.isActive = true;
    }

    if (data.isActive === true) {
      data.lastActivatedAt = new Date();
    }

    const parsedIsPrePack = parseBooleanField(data.isPrePack);
    if (parsedIsPrePack !== undefined) {
      data.isPrePack = parsedIsPrePack;
    }

    normalizeStrainPayload(data);
    if (!data.name && data.strain) {
      data.name = data.strain;
    }
    
    const imageFile = req.files?.image?.[0] || req.file;
    const videoFile = req.files?.video?.[0];
    if (imageFile) {
      data.image = await storeUpload(imageFile, { role: 'manager' });
    }
    if (videoFile) {
      const mutedVideo = await stripAudio(videoFile);
      data.video = await storeUpload(mutedVideo, { role: 'manager' });
    }
    
    const flower = new Flower(data);
    await flower.save();

    await upsertStrainRecord(data);
    
    const populated = await flower.populate('priceTier');
    const product = await attachMediaUrls(populated.toObject(), 'manager');
    
    res.status(201).json({ product });
  } catch (error) {
    console.error('Create flower error:', error);
    res.status(500).json({ message: 'Server error creating flower' });
  }
};

export const updateFlower = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    normalizeStrainPayload(data);
    if (!data.name && data.strain) {
      data.name = data.strain;
    }
    
    const flower = await Flower.findById(id);
    
    if (!flower) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const wasActive = flower.isActive;
    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    const parsedIsPrePack = parseBooleanField(data.isPrePack);
    if (parsedIsPrePack !== undefined) {
      data.isPrePack = parsedIsPrePack;
    }

    if (wasActive === false && data.isActive === true) {
      data.lastActivatedAt = new Date();
    }
    
    const imageFile = req.files?.image?.[0] || req.file;
    const videoFile = req.files?.video?.[0];
    if (imageFile) {
      await deleteMedia(flower.image, { role: 'manager' });
      data.image = await storeUpload(imageFile, { role: 'manager' });
    }
    if (videoFile) {
      await deleteMedia(flower.video, { role: 'manager' });
      const mutedVideo = await stripAudio(videoFile);
      data.video = await storeUpload(mutedVideo, { role: 'manager' });
    }
    
    Object.assign(flower, data);
    await flower.save();

    await upsertStrainRecord({ ...flower.toObject(), ...data });
    
    const populated = await flower.populate('priceTier');
    const product = await attachMediaUrls(populated.toObject(), 'manager');
    
    if (wasActive || flower.isActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'flower',
        id: flower._id,
        name: flower.strain || flower.name || 'Flower',
        isActive: flower.isActive,
        action: wasActive !== flower.isActive
          ? (flower.isActive ? 'activated' : 'deactivated')
          : 'updated',
      });
    }

    res.json({ product });
  } catch (error) {
    console.error('Update flower error:', error);
    res.status(500).json({ message: 'Server error updating flower' });
  }
};

export const deleteFlower = async (req, res) => {
  try {
    const { id } = req.params;
    
    const flower = await Flower.findById(id);
    
    if (!flower) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const wasActive = flower.isActive;
    const productName = flower.strain || flower.name || 'Flower';

    await deleteMedia(flower.image, { role: 'manager' });
    await deleteMedia(flower.video, { role: 'manager' });
    await flower.deleteOne();

    if (wasActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'flower',
        id,
        name: productName,
        isActive: false,
        action: 'deleted',
      });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete flower error:', error);
    res.status(500).json({ message: 'Server error deleting flower' });
  }
};

// =====================
// CONCENTRATES
// =====================

export const getConcentrateBases = async (req, res) => {
  try {
    const { active } = req.query;
    const filter = active === 'true' ? { isActive: true } : {};
    const sort = { createdAt: -1, _id: -1 };
    
    const bases = await ConcentrateBase.find(filter)
      .sort(sort);
    
    // Get strains for each base
    const role = req.user?.role || 'customer';
    const basesWithStrains = await Promise.all(
      bases.map(async (base) => {
        const strainFilter = active === 'true' 
          ? { concentrateBase: base._id, isActive: true }
          : { concentrateBase: base._id };
        
        const strains = await ConcentrateStrain.find(strainFilter)
          .sort({ createdAt: -1, _id: -1 });
        
        const enriched = await attachMediaUrls(base.toObject(), role);
        return {
          ...enriched,
          strains,
        };
      })
    );
    
    res.json({ products: basesWithStrains });
  } catch (error) {
    console.error('Get concentrate bases error:', error);
    res.status(500).json({ message: 'Server error fetching concentrates' });
  }
};

export const createConcentrateBase = async (req, res) => {
  try {
    const data = req.body;

    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    if (data.isActive === undefined) {
      data.isActive = false;
    }

    if (data.isActive === true) {
      data.lastActivatedAt = new Date();
    }

    if (!data.name && data.productType) {
      data.name = data.brand ? `${data.brand} - ${data.productType}` : data.productType;
    }
    
    const imageFile = req.files?.image?.[0] || req.file;
    const videoFile = req.files?.video?.[0];
    if (imageFile) {
      data.image = await storeUpload(imageFile, { role: 'manager' });
    }
    if (videoFile) {
      const mutedVideo = await stripAudio(videoFile);
      data.video = await storeUpload(mutedVideo, { role: 'manager' });
    }
    
    const base = new ConcentrateBase(data);
    await base.save();
    
    const enriched = await attachMediaUrls(base.toObject(), 'manager');
    res.status(201).json({ product: { ...enriched, strains: [] } });
  } catch (error) {
    console.error('Create concentrate base error:', error);
    res.status(500).json({ message: 'Server error creating concentrate' });
  }
};

export const updateConcentrateBase = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (!data.name && data.productType) {
      data.name = data.brand ? `${data.brand} - ${data.productType}` : data.productType;
    }
    
    const base = await ConcentrateBase.findById(id);
    
    if (!base) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const wasActive = base.isActive;
    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    if (wasActive === false && data.isActive === true) {
      data.lastActivatedAt = new Date();
    }
    
    const imageFile = req.files?.image?.[0] || req.file;
    const videoFile = req.files?.video?.[0];
    if (imageFile) {
      await deleteMedia(base.image, { role: 'manager' });
      data.image = await storeUpload(imageFile, { role: 'manager' });
    }
    if (videoFile) {
      await deleteMedia(base.video, { role: 'manager' });
      const mutedVideo = await stripAudio(videoFile);
      data.video = await storeUpload(mutedVideo, { role: 'manager' });
    }
    
    Object.assign(base, data);
    await base.save();
    
    const strains = await ConcentrateStrain.find({ concentrateBase: id });
    
    if (wasActive || base.isActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'concentrate',
        id: base._id,
        name: base.name || 'Concentrate',
        isActive: base.isActive,
        action: wasActive !== base.isActive
          ? (base.isActive ? 'activated' : 'deactivated')
          : 'updated',
      });
    }

    const enriched = await attachMediaUrls(base.toObject(), 'manager');
    res.json({ product: { ...enriched, strains } });
  } catch (error) {
    console.error('Update concentrate base error:', error);
    res.status(500).json({ message: 'Server error updating concentrate' });
  }
};

export const deleteConcentrateBase = async (req, res) => {
  try {
    const { id } = req.params;
    
    const base = await ConcentrateBase.findById(id);
    
    if (!base) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const wasActive = base.isActive;
    const productName = base.name || 'Concentrate';

    // Delete all associated strains
    await ConcentrateStrain.deleteMany({ concentrateBase: id });
    
    await deleteMedia(base.image, { role: 'manager' });
    await deleteMedia(base.video, { role: 'manager' });
    await base.deleteOne();

    if (wasActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'concentrate',
        id,
        name: productName,
        isActive: false,
        action: 'deleted',
      });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete concentrate base error:', error);
    res.status(500).json({ message: 'Server error deleting concentrate' });
  }
};

// Concentrate Strains
export const addConcentrateStrain = async (req, res) => {
  try {
    const { baseId } = req.params;
    const data = req.body;

    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    if (data.isActive === undefined) {
      data.isActive = false;
    }

    if (data.isActive === true) {
      data.lastActivatedAt = new Date();
    }
    
    const base = await ConcentrateBase.findById(baseId);
    
    if (!base) {
      return res.status(404).json({ message: 'Concentrate base not found' });
    }
    
    const strain = new ConcentrateStrain({
      ...data,
      concentrateBase: baseId,
    });
    
    await strain.save();
    
    res.status(201).json({ strain });
  } catch (error) {
    console.error('Add concentrate strain error:', error);
    res.status(500).json({ message: 'Server error adding strain' });
  }
};

export const updateConcentrateStrain = async (req, res) => {
  try {
    const { strainId } = req.params;
    const data = req.body;
    
    const strain = await ConcentrateStrain.findById(strainId);
    
    if (!strain) {
      return res.status(404).json({ message: 'Strain not found' });
    }

    const wasActive = strain.isActive;
    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    if (wasActive === false && data.isActive === true) {
      data.lastActivatedAt = new Date();
    }
    
    Object.assign(strain, data);
    await strain.save();

    if (wasActive || strain.isActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'concentrate',
        id: strain._id,
        name: strain.strain || 'Concentrate strain',
        isActive: strain.isActive,
        action: wasActive !== strain.isActive
          ? (strain.isActive ? 'activated' : 'deactivated')
          : 'updated',
      });
    }

    res.json({ strain });
  } catch (error) {
    console.error('Update concentrate strain error:', error);
    res.status(500).json({ message: 'Server error updating strain' });
  }
};

export const deleteConcentrateStrain = async (req, res) => {
  try {
    const { strainId } = req.params;
    
    const strain = await ConcentrateStrain.findByIdAndDelete(strainId);
    
    if (!strain) {
      return res.status(404).json({ message: 'Strain not found' });
    }

    if (strain.isActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'concentrate',
        id: strainId,
        name: strain.strain || 'Concentrate strain',
        isActive: false,
        action: 'deleted',
      });
    }
    
    res.json({ message: 'Strain deleted successfully' });
  } catch (error) {
    console.error('Delete concentrate strain error:', error);
    res.status(500).json({ message: 'Server error deleting strain' });
  }
};

// =====================
// CONCENTRATE TYPES
// =====================

export const getConcentrateTypes = async (req, res) => {
  try {
    const types = await ConcentrateType.find().sort({ name: 1 });
    res.json({ types });
  } catch (error) {
    console.error('Get concentrate types error:', error);
    res.status(500).json({ message: 'Server error fetching concentrate types' });
  }
};

export const createConcentrateType = async (req, res) => {
  try {
    const { name } = req.body;
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const nameLower = trimmed.toLowerCase();
    const existing = await ConcentrateType.findOne({ nameLower });
    if (existing) {
      return res.status(200).json({ type: existing });
    }

    const type = await ConcentrateType.create({ name: trimmed, nameLower });
    res.status(201).json({ type });
  } catch (error) {
    console.error('Create concentrate type error:', error);
    res.status(500).json({ message: 'Server error creating concentrate type' });
  }
};

export const deleteConcentrateType = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await ConcentrateType.findById(id);
    if (!type) {
      return res.status(404).json({ message: 'Type not found' });
    }

    await type.deleteOne();
    res.json({ message: 'Type deleted' });
  } catch (error) {
    console.error('Delete concentrate type error:', error);
    res.status(500).json({ message: 'Server error deleting concentrate type' });
  }
};

// =====================
// DISPOSABLES
// =====================

export const getDisposableBases = async (req, res) => {
  try {
    const { active } = req.query;
    const filter = active === 'true' ? { isActive: true } : {};
    const sort = { createdAt: -1, _id: -1 };
    
    const bases = await DisposableBase.find(filter)
      .sort(sort);
    
    const role = req.user?.role || 'customer';
    const basesWithStrains = await Promise.all(
      bases.map(async (base) => {
        const strainFilter = active === 'true' 
          ? { disposableBase: base._id, isActive: true }
          : { disposableBase: base._id };
        
        const strains = await DisposableStrain.find(strainFilter)
          .sort({ createdAt: -1, _id: -1 });
        
        const enriched = await attachMediaUrls(base.toObject(), role);
        return {
          ...enriched,
          strains,
        };
      })
    );
    
    res.json({ products: basesWithStrains });
  } catch (error) {
    console.error('Get disposable bases error:', error);
    res.status(500).json({ message: 'Server error fetching disposables' });
  }
};

export const createDisposableBase = async (req, res) => {
  try {
    const data = req.body;

    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    if (data.isActive === undefined) {
      data.isActive = false;
    }

    if (data.isActive === true) {
      data.lastActivatedAt = new Date();
    }

    const parsedDualChamber = parseBooleanField(data.isDualChamber);
    if (parsedDualChamber !== undefined) {
      data.isDualChamber = parsedDualChamber;
    }

    if (!data.name && data.brand) {
      data.name = data.brand;
    }
    
    const imageFile = req.files?.image?.[0] || req.file;
    const videoFile = req.files?.video?.[0];
    if (imageFile) {
      data.image = await storeUpload(imageFile, { role: 'manager' });
    }
    if (videoFile) {
      const mutedVideo = await stripAudio(videoFile);
      data.video = await storeUpload(mutedVideo, { role: 'manager' });
    }
    
    const base = new DisposableBase(data);
    await base.save();
    
    const enriched = await attachMediaUrls(base.toObject(), 'manager');
    res.status(201).json({ product: { ...enriched, strains: [] } });
  } catch (error) {
    console.error('Create disposable base error:', error);
    res.status(500).json({ message: 'Server error creating disposable' });
  }
};

export const updateDisposableBase = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (!data.name && data.brand) {
      data.name = data.brand;
    }
    
    const base = await DisposableBase.findById(id);
    
    if (!base) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const wasActive = base.isActive;
    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    if (wasActive === false && data.isActive === true) {
      data.lastActivatedAt = new Date();
    }
    
    const imageFile = req.files?.image?.[0] || req.file;
    const videoFile = req.files?.video?.[0];
    if (imageFile) {
      await deleteMedia(base.image, { role: 'manager' });
      data.image = await storeUpload(imageFile, { role: 'manager' });
    }
    if (videoFile) {
      await deleteMedia(base.video, { role: 'manager' });
      const mutedVideo = await stripAudio(videoFile);
      data.video = await storeUpload(mutedVideo, { role: 'manager' });
    }
    
    Object.assign(base, data);
    await base.save();
    
    const strains = await DisposableStrain.find({ disposableBase: id });
    
    if (wasActive || base.isActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'disposable',
        id: base._id,
        name: base.name || 'Disposable',
        isActive: base.isActive,
        action: wasActive !== base.isActive
          ? (base.isActive ? 'activated' : 'deactivated')
          : 'updated',
      });
    }

    const enriched = await attachMediaUrls(base.toObject(), 'manager');
    res.json({ product: { ...enriched, strains } });
  } catch (error) {
    console.error('Update disposable base error:', error);
    res.status(500).json({ message: 'Server error updating disposable' });
  }
};

export const deleteDisposableBase = async (req, res) => {
  try {
    const { id } = req.params;
    
    const base = await DisposableBase.findById(id);
    
    if (!base) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const wasActive = base.isActive;
    const productName = base.name || 'Disposable';

    await DisposableStrain.deleteMany({ disposableBase: id });
    
    await deleteMedia(base.image, { role: 'manager' });
    await deleteMedia(base.video, { role: 'manager' });
    await base.deleteOne();

    if (wasActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'disposable',
        id,
        name: productName,
        isActive: false,
        action: 'deleted',
      });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete disposable base error:', error);
    res.status(500).json({ message: 'Server error deleting disposable' });
  }
};

// Disposable Strains
export const addDisposableStrain = async (req, res) => {
  try {
    const { baseId } = req.params;
    const data = req.body;

    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    if (data.isActive === undefined) {
      data.isActive = false;
    }

    if (data.isActive === true) {
      data.lastActivatedAt = new Date();
    }
    
    const base = await DisposableBase.findById(baseId);
    
    if (!base) {
      return res.status(404).json({ message: 'Disposable base not found' });
    }
    
    const strain = new DisposableStrain({
      ...data,
      disposableBase: baseId,
    });
    
    await strain.save();
    
    res.status(201).json({ strain });
  } catch (error) {
    console.error('Add disposable strain error:', error);
    res.status(500).json({ message: 'Server error adding strain' });
  }
};

export const updateDisposableStrain = async (req, res) => {
  try {
    const { strainId } = req.params;
    const data = req.body;
    
    const strain = await DisposableStrain.findById(strainId);
    
    if (!strain) {
      return res.status(404).json({ message: 'Strain not found' });
    }

    const wasActive = strain.isActive;
    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    if (wasActive === false && data.isActive === true) {
      data.lastActivatedAt = new Date();
    }
    
    Object.assign(strain, data);
    await strain.save();

    if (wasActive || strain.isActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'disposable',
        id: strain._id,
        name: strain.strain || 'Disposable strain',
        isActive: strain.isActive,
        action: wasActive !== strain.isActive
          ? (strain.isActive ? 'activated' : 'deactivated')
          : 'updated',
      });
    }

    res.json({ strain });
  } catch (error) {
    console.error('Update disposable strain error:', error);
    res.status(500).json({ message: 'Server error updating strain' });
  }
};

export const deleteDisposableStrain = async (req, res) => {
  try {
    const { strainId } = req.params;
    
    const strain = await DisposableStrain.findByIdAndDelete(strainId);
    
    if (!strain) {
      return res.status(404).json({ message: 'Strain not found' });
    }

    if (strain.isActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'disposable',
        id: strainId,
        name: strain.strain || 'Disposable strain',
        isActive: false,
        action: 'deleted',
      });
    }
    
    res.json({ message: 'Strain deleted successfully' });
  } catch (error) {
    console.error('Delete disposable strain error:', error);
    res.status(500).json({ message: 'Server error deleting strain' });
  }
};

// =====================
// DISPOSABLE TYPES
// =====================




// =====================
// EDIBLE TYPES
// =====================

export const getEdibleTypes = async (req, res) => {
  try {
    const types = await EdibleType.find().sort({ name: 1 });
    res.json({ types });
  } catch (error) {
    console.error('Get edible types error:', error);
    res.status(500).json({ message: 'Server error fetching edible types' });
  }
};

export const createEdibleType = async (req, res) => {
  try {
    const { name } = req.body;
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const nameLower = trimmed.toLowerCase();
    const existing = await EdibleType.findOne({ nameLower });
    if (existing) {
      return res.status(200).json({ type: existing });
    }

    const type = await EdibleType.create({ name: trimmed, nameLower });
    res.status(201).json({ type });
  } catch (error) {
    console.error('Create edible type error:', error);
    res.status(500).json({ message: 'Server error creating edible type' });
  }
};

export const deleteEdibleType = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await EdibleType.findById(id);
    if (!type) {
      return res.status(404).json({ message: 'Type not found' });
    }

    await type.deleteOne();
    res.json({ message: 'Type deleted' });
  } catch (error) {
    console.error('Delete edible type error:', error);
    res.status(500).json({ message: 'Server error deleting edible type' });
  }
};

// =====================
// EDIBLES
// =====================

export const getEdibles = async (req, res) => {
  try {
    const { active } = req.query;
    const filter = active === 'true' ? { isActive: true } : {};
    const sort = { createdAt: -1, _id: -1 };
    
    const edibles = await Edible.find(filter)
      .sort(sort);
    
    const role = req.user?.role || 'customer';
    const products = await Promise.all(
      edibles.map((edible) => attachMediaUrls(edible.toObject(), role))
    );

    res.json({ products });
  } catch (error) {
    console.error('Get edibles error:', error);
    res.status(500).json({ message: 'Server error fetching edibles' });
  }
};

export const createEdible = async (req, res) => {
  try {
    const data = req.body;

    let variants = [];
    if (data.variants) {
      try {
        const parsed = typeof data.variants === 'string'
          ? JSON.parse(data.variants)
          : data.variants;
        if (Array.isArray(parsed)) {
          variants = parsed
            .map((item, index) => ({
              name: typeof item === 'string' ? item : item?.name,
              isActive: item?.isActive !== false,
              sortOrder: typeof item?.sortOrder === 'number' ? item.sortOrder : index,
            }))
            .filter((item) => item.name && String(item.name).trim());
        }
      } catch (error) {
        // ignore parse errors
      }
    }

    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    if (data.isActive === undefined) {
      data.isActive = false;
    }

    if (data.isActive === true) {
      data.lastActivatedAt = new Date();
    }

    if (!data.name && data.edibleType) {
      data.name = data.brand ? `${data.brand} - ${data.edibleType}` : data.edibleType;
    }

    if (variants.length) {
      data.variants = variants.map((variant, index) => ({
        name: String(variant.name).trim(),
        isActive: variant.isActive !== false,
        sortOrder: typeof variant.sortOrder === 'number' ? variant.sortOrder : index,
      }));
      data.variantCount = data.variants.length;
    }
    
    const imageFile = req.files?.image?.[0] || req.file;
    const videoFile = req.files?.video?.[0];
    if (imageFile) {
      data.image = await storeUpload(imageFile, { role: 'manager' });
    }
    if (videoFile) {
      const mutedVideo = await stripAudio(videoFile);
      data.video = await storeUpload(mutedVideo, { role: 'manager' });
    }
    
    const edible = new Edible(data);
    await edible.save();
    
    const product = await attachMediaUrls(edible.toObject(), 'manager');
    res.status(201).json({ product });
  } catch (error) {
    console.error('Create edible error:', error);
    res.status(500).json({ message: 'Server error creating edible' });
  }
};

export const updateEdible = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (!data.name && data.edibleType) {
      data.name = data.brand ? `${data.brand} - ${data.edibleType}` : data.edibleType;
    }
    
    const edible = await Edible.findById(id);
    
    if (!edible) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const wasActive = edible.isActive;
    const parsedIsActive = parseBooleanField(data.isActive);
    if (parsedIsActive !== undefined) {
      data.isActive = parsedIsActive;
    }

    if (wasActive === false && data.isActive === true) {
      data.lastActivatedAt = new Date();
    }
    
    const imageFile = req.files?.image?.[0] || req.file;
    const videoFile = req.files?.video?.[0];
    if (imageFile) {
      await deleteMedia(edible.image, { role: 'manager' });
      data.image = await storeUpload(imageFile, { role: 'manager' });
    }
    if (videoFile) {
      await deleteMedia(edible.video, { role: 'manager' });
      const mutedVideo = await stripAudio(videoFile);
      data.video = await storeUpload(mutedVideo, { role: 'manager' });
    }
    
    Object.assign(edible, data);
    await edible.save();

    if (wasActive || edible.isActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'edible',
        id: edible._id,
        name: edible.name || edible.edibleType || 'Edible',
        isActive: edible.isActive,
        action: wasActive !== edible.isActive
          ? (edible.isActive ? 'activated' : 'deactivated')
          : 'updated',
      });
    }

    const product = await attachMediaUrls(edible.toObject(), 'manager');
    res.json({ product });
  } catch (error) {
    console.error('Update edible error:', error);
    res.status(500).json({ message: 'Server error updating edible' });
  }
};

export const addEdibleVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sortOrder } = req.body;

    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ message: 'Variant name is required' });
    }

    const edible = await Edible.findById(id);
    if (!edible) {
      return res.status(404).json({ message: 'Product not found' });
    }

    edible.variants.push({
      name: trimmed,
      isActive: true,
      sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : edible.variants.length,
    });
    edible.variantCount = edible.variants.length;
    await edible.save();

    res.status(201).json({ product: edible, variant: edible.variants[edible.variants.length - 1] });
  } catch (error) {
    console.error('Add edible variant error:', error);
    res.status(500).json({ message: 'Server error adding edible variant' });
  }
};

export const updateEdibleVariant = async (req, res) => {
  try {
    const { variantId } = req.params;
    const { name, isActive, sortOrder } = req.body;

    const edible = await Edible.findOne({ 'variants._id': variantId });
    if (!edible) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    const variant = edible.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    if (name !== undefined) {
      const trimmed = String(name || '').trim();
      if (!trimmed) {
        return res.status(400).json({ message: 'Variant name is required' });
      }
      variant.name = trimmed;
    }

    const wasActive = variant.isActive;

    const parsedIsActive = parseBooleanField(isActive);
    if (parsedIsActive !== undefined) {
      variant.isActive = parsedIsActive;
    }

    if (sortOrder !== undefined) {
      const nextOrder = Number(sortOrder);
      if (Number.isFinite(nextOrder)) {
        variant.sortOrder = nextOrder;
      }
    }

    await edible.save();

    if (parsedIsActive !== undefined && wasActive !== variant.isActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'edible',
        id: variant._id,
        name: variant.name || 'Edible variant',
        isActive: variant.isActive,
        action: variant.isActive ? 'activated' : 'deactivated',
      });
    }

    res.json({ product: edible, variant });
  } catch (error) {
    console.error('Update edible variant error:', error);
    res.status(500).json({ message: 'Server error updating edible variant' });
  }
};

export const deleteEdibleVariant = async (req, res) => {
  try {
    const { variantId } = req.params;
    const edible = await Edible.findOne({ 'variants._id': variantId });
    if (!edible) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    edible.variants = edible.variants.filter((variant) => String(variant._id) !== String(variantId));
    edible.variantCount = edible.variants.length || 1;
    await edible.save();

    res.json({ product: edible });
  } catch (error) {
    console.error('Delete edible variant error:', error);
    res.status(500).json({ message: 'Server error deleting edible variant' });
  }
};

export const deleteEdible = async (req, res) => {
  try {
    const { id } = req.params;
    
    const edible = await Edible.findById(id);
    
    if (!edible) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const wasActive = edible.isActive;
    const productName = edible.name || edible.edibleType || 'Edible';

    await deleteMedia(edible.image, { role: 'manager' });
    await deleteMedia(edible.video, { role: 'manager' });
    await edible.deleteOne();

    if (wasActive) {
      emitToRoom('customers', 'products:updated', {
        productType: 'edible',
        id,
        name: productName,
        isActive: false,
        action: 'deleted',
      });
    }
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete edible error:', error);
    res.status(500).json({ message: 'Server error deleting edible' });
  }
};

// =====================
// ALL PRODUCTS (for customer)
// =====================

export const getAllProducts = async (req, res) => {
  try {
    const [flowers, concentrateBases, disposableBases, edibles] = await Promise.all([
      Flower.find({ isActive: true }).populate('priceTier').sort({ createdAt: -1, _id: -1 }),
      ConcentrateBase.find({ isActive: true }).sort({ createdAt: -1, _id: -1 }),
      DisposableBase.find({ isActive: true }).sort({ createdAt: -1, _id: -1 }),
      Edible.find({ isActive: true }).sort({ createdAt: -1, _id: -1 }),
    ]);
    
    // Get strains for concentrates
    const concentratesWithStrains = await Promise.all(
      concentrateBases.map(async (base) => {
        const strains = await ConcentrateStrain.find({
          concentrateBase: base._id,
          isActive: true,
        }).sort({ createdAt: -1, _id: -1 });
        
        const enriched = await attachMediaUrls(base.toObject(), 'customer');
        return {
          ...enriched,
          strains,
        };
      })
    );

    // Get strains for disposables
    const disposablesWithStrains = await Promise.all(
      disposableBases.map(async (base) => {
        const strains = await DisposableStrain.find({
          disposableBase: base._id,
          isActive: true,
        }).sort({ createdAt: -1, _id: -1 });
        
        const enriched = await attachMediaUrls(base.toObject(), 'customer');
        return {
          ...enriched,
          strains,
        };
      })
    );

    const flowersWithMedia = await Promise.all(
      flowers.map((flower) => attachMediaUrls(flower.toObject(), 'customer'))
    );
    const ediblesWithMedia = await Promise.all(
      edibles.map((edible) => attachMediaUrls(edible.toObject(), 'customer'))
    );
    
    res.json({
      flowers: flowersWithMedia,
      concentrates: concentratesWithStrains,
      disposables: disposablesWithStrains,
      edibles: ediblesWithMedia,
    });
  } catch (error) {
    console.error('Get all products error:', error);
    res.status(500).json({ message: 'Server error fetching products' });
  }
};

// Delete product image
export const deleteProductImage = async (req, res) => {
  try {
    const { type, id } = req.params;
    
    let Model;
    switch (type) {
      case 'flower':
        Model = Flower;
        break;
      case 'concentrate':
        Model = ConcentrateBase;
        break;
      case 'disposable':
        Model = DisposableBase;
        break;
      case 'edible':
        Model = Edible;
        break;
      default:
        return res.status(400).json({ message: 'Invalid product type' });
    }
    
    const product = await Model.findById(id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    await deleteMedia(product.image, { role: 'manager' });
    product.image = null;
    await product.save();
    
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete product image error:', error);
    res.status(500).json({ message: 'Server error deleting image' });
  }
};
