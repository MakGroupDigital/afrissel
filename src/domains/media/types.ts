export type MediaResourceType = 'image' | 'video';

export type MediaAssetContract = {
  id: string;
  ownerId: string;
  provider: 'cloudinary';
  publicId: string;
  secureUrl: string;
  resourceType: MediaResourceType;
  bytes?: number;
  duration?: number;
  createdAt: number;
};
