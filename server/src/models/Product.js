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
};

// Bulk Flower - weighed at sale, tier-based pricing
const bulkFlowerSchema = new mongoose.Schema({
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
  priceTier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PriceTier',
    required: true,
  },
}, {
  timestamps: true,
});

// Pre-packaged Flower
const packagedFlowerSchema = new mongoose.Schema({
  ...baseProductFields,
  brand: {
    type: String,
    required: true,
    trim: true,
  },
  packagingType: {
    type: String,
    enum: ['bag', 'jar', 'pre-roll'],
    required: true,
    trim: true,
  },
  strain: {
    type: String,
    required: true,
    trim: true,
  },
  strainType: {
    type: String,
    enum: ['sativa', 'indica', 'hybrid-s', 'hybrid-i'],
  },
  weight: {
    type: String, // e.g., "3.5g", "7g"
    required: true,
    trim: true,
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
  price: {
    type: Number,
    required: true,
    min: 0,
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
const BulkFlower = mongoose.model('BulkFlower', bulkFlowerSchema);
const PackagedFlower = mongoose.model('PackagedFlower', packagedFlowerSchema);
const ConcentrateBase = mongoose.model('ConcentrateBase', concentrateBaseSchema);
const ConcentrateStrain = mongoose.model('ConcentrateStrain', concentrateStrainSchema);
const Edible = mongoose.model('Edible', edibleSchema);

export {
  BulkFlower,
  PackagedFlower,
  ConcentrateBase,
  ConcentrateStrain,
  Edible,
};
