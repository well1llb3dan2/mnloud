import mongoose from 'mongoose';

const edibleTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  nameLower: {
    type: String,
    required: true,
    trim: true,
  },
}, {
  timestamps: true,
});

edibleTypeSchema.index({ nameLower: 1 }, { unique: true });

export default mongoose.model('EdibleType', edibleTypeSchema);
