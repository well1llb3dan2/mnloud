import mongoose from 'mongoose';

const concentrateTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  nameLower: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
}, {
  timestamps: true,
});

export default mongoose.model('ConcentrateType', concentrateTypeSchema);
