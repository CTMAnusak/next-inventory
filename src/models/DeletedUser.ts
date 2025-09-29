import mongoose, { Document, Schema } from 'mongoose';

export interface IDeletedUser extends Document {
  // Mongo ObjectId string of the user that was deleted
  userMongoId: string;
  // Business user id stored in User.user_id
  user_id?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  department?: string;
  office?: string;
  phone?: string;
  email?: string;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeletedUserSchema = new Schema<IDeletedUser>({
  userMongoId: { type: String, required: true, unique: true, index: true },
  user_id: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  nickname: { type: String },
  department: { type: String },
  office: { type: String },
  phone: { type: String },
  email: { type: String },
  deletedAt: { type: Date, required: true, default: Date.now }
}, { timestamps: true });

// Helpful index for lookup by business user id
DeletedUserSchema.index({ user_id: 1 });

// Recreate model on hot-reload
if (mongoose.models.DeletedUsers) {
  delete mongoose.models.DeletedUsers;
}

export default mongoose.model<IDeletedUser>('DeletedUsers', DeletedUserSchema);


