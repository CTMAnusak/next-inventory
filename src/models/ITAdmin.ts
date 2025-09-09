import mongoose, { Document, Schema } from 'mongoose';

export interface IITAdmin extends Document {
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const ITAdminSchema = new Schema<IITAdmin>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    }
  },
  {
    timestamps: true
  }
);

// Create index for email for faster lookups
ITAdminSchema.index({ email: 1 });

const ITAdmin = mongoose.models.ITAdmin || mongoose.model<IITAdmin>('ITAdmin', ITAdminSchema);

export default ITAdmin;
