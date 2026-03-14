import mongoose from 'mongoose';

const disposableTypeSchema = new mongoose.Schema({
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

export default mongoose.model('DisposableType', disposableTypeSchema);
