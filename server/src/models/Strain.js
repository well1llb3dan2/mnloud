import mongoose from 'mongoose';

const strainSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  nameLower: {
    type: String,
    required: true,
    unique: true,
  },
  variety: {
    type: String,
    trim: true,
  },
  thc_percent: {
    type: Number,
    min: 0,
    max: 100,
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
  description: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

const Strain = mongoose.model('Strain', strainSchema);

export default Strain;
