import mongoose from 'mongoose';

const strainMatchSchema = new mongoose.Schema({
  query: {
    type: String,
    required: true,
    trim: true,
  },
  queryLower: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  matches: {
    type: [
      {
        name: String,
        aliases: [String],
        variety: String,
      },
    ],
    default: [],
  },
}, {
  timestamps: true,
});

export default mongoose.model('StrainMatch', strainMatchSchema);
