import mongoose, { Schema, Document, Model } from 'mongoose';

export type SettingsMode = 'UPLOAD' | 'WAITING' | 'MOSAIC';
export type MosaicEngine = 'AI' | 'CANVAS';

export interface ISettings extends Document {
  mode: SettingsMode;
  engine: MosaicEngine;
}

const SettingsSchema: Schema = new Schema({
  mode: {
    type: String,
    enum: ['UPLOAD', 'WAITING', 'MOSAIC'],
    default: 'UPLOAD',
    required: true,
  },
  engine: {
    type: String,
    enum: ['AI', 'CANVAS'],
    default: 'AI',
    required: true,
  },
});

// Prevent model recompilation error in development
const Settings: Model<ISettings> =
  mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);

export default Settings;
