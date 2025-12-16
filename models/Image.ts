import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IImage extends Document {
  url: string;
  publicId: string;
  isPresident: boolean;
  status?: string;
  createdAt: Date;
}

const ImageSchema: Schema = new Schema({
  url: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: 'approved',
  },
  isPresident: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Image: Model<IImage> =
  mongoose.models.Image || mongoose.model<IImage>('Image', ImageSchema);

export default Image;
