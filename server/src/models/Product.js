import mongoose from 'mongoose';

// Base product schema with common fields
const baseProductFields = {
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  image: {
    type: String, // Path to uploaded image
  },
  video: {
    type: String, // Path to uploaded video
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  lastActivatedAt: {
    type: Date,
    default: null,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
};

// Flower - tier-based pricing, optional pre-pack flag
const flowerSchema = new mongoose.Schema({
  ...baseProductFields,
  strain: {
    type: String,
    required: true,
    trim: true,
  },
  strainType: {
    type: String,
    enum: ['sativa', 'indica', 'hybrid-s', 'hybrid-i'],
  },
  thcPercentage: {
    type: Number,
    min: 0,
    max: 100,
  },
  thc_percent: {
    type: Number,
    min: 0,
    max: 100,
  },
  variety: {
    type: String,
    trim: true,
  },
  effects: {
    type: [String],
    default: [],
  },
  flavors: {
    type: [String],
    default: [],
  },
  may_relieve: {
    type: [String],
    default: [],
  },
  terpenes: {
    type: [String],
    default: [],
  },
  lineage: {
    type: String,
    trim: true,
  },
  isPrePack: {
    type: Boolean,
    default: false,
  },
  priceTier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PriceTier',
    required: true,
  },
}, {
  timestamps: true,
});

// Concentrate product base (shared image across strains)
const concentrateBaseSchema = new mongoose.Schema({
  ...baseProductFields,
  brand: {
    type: String,
    trim: true,
  },
  productType: {
    type: String, // e.g., "Vape Cart", "Shatter", "Wax"
    required: true,
    trim: true,
  },
  weight: {
    type: String, // e.g., "500mg", "1g"
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
}, {
  timestamps: true,
});

// Individual concentrate strain (linked to base)
const concentrateStrainSchema = new mongoose.Schema({
  concentrateBase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ConcentrateBase',
    required: true,
  },
  strain: {
    type: String,
    required: true,
    trim: true,
  },
  strainType: {
    type: String,
    enum: ['sativa', 'indica', 'hybrid-s', 'hybrid-i'],
    required: true,
  },
  thcPercentage: {
    type: Number,
    min: 0,
    max: 100,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastActivatedAt: {
    type: Date,
    default: null,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Disposable product base (shared image across strains, same structure as concentrates)
const disposableBaseSchema = new mongoose.Schema({
  ...baseProductFields,
  brand: {
    type: String,
    trim: true,
  },
  weight: {
    type: String, // e.g., "500mg", "1g"
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
}, {
  timestamps: true,
});

// Individual disposable strain (linked to base)
const disposableStrainSchema = new mongoose.Schema({
  disposableBase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DisposableBase',
    required: true,
  },
  strain: {
    type: String,
    required: true,
    trim: true,
  },
  strainType: {
    type: String,
    enum: ['sativa', 'indica', 'hybrid-s', 'hybrid-i'],
    required: true,
  },
  thcPercentage: {
    type: Number,
    min: 0,
    max: 100,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastActivatedAt: {
    type: Date,
    default: null,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Edible
const edibleVariantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
}, { _id: true });

const edibleSchema = new mongoose.Schema({
  ...baseProductFields,
  brand: {
    type: String,
    trim: true,
  },
  edibleType: {
    type: String, // e.g., "Gummy", "Brownie", "Chocolate"
    required: true,
    trim: true,
  },
  variants: {
    type: [edibleVariantSchema],
    default: [],
  },
  variantCount: {
    type: Number,
    default: 1,
    min: 1,
  },
  weight: {
    type: String, // THC content, e.g., "100mg", "50mg"
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
}, {
  timestamps: true,
});

// Create models
const Flower = mongoose.model('Flower', flowerSchema);
const ConcentrateBase = mongoose.model('ConcentrateBase', concentrateBaseSchema);
const ConcentrateStrain = mongoose.model('ConcentrateStrain', concentrateStrainSchema);
const DisposableBase = mongoose.model('DisposableBase', disposableBaseSchema);
const DisposableStrain = mongoose.model('DisposableStrain', disposableStrainSchema);
const Edible = mongoose.model('Edible', edibleSchema);

export {
  Flower,
  ConcentrateBase,
  ConcentrateStrain,
  DisposableBase,
  DisposableStrain,
  Edible,
};
