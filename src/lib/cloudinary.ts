import { apiRequest } from '../domains/shared/apiClient';

export type CloudinaryResourceType = 'image' | 'video';

export interface CloudinaryUploadResult {
  provider: 'cloudinary';
  mediaUrl: string;
  secureUrl: string;
  publicId: string;
  resourceType: CloudinaryResourceType;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
}

interface SignedUploadPayload {
  cloudName: string;
  apiKey: string;
  signature: string;
  timestamp: number;
  folder: string;
  publicId: string;
  resourceType: CloudinaryResourceType;
  error?: string;
  detail?: string;
}

const configuredCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';

export const isCloudinaryReady = () => Boolean(configuredCloudName);

const getResourceType = (file: File): CloudinaryResourceType => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  throw new Error('Le fichier doit être une image ou une video.');
};

export async function uploadMediaToCloudinary(file: File, ownerId: string): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryReady()) {
    throw new Error('Cloudinary doit avoir VITE_CLOUDINARY_CLOUD_NAME configuré.');
  }

  const resourceType = getResourceType(file);
  const signedUpload = await apiRequest<SignedUploadPayload>('/api/cloudinary/sign-upload', {
    service: 'media',
    method: 'POST',
    body: JSON.stringify({ ownerId, resourceType })
  });

  if (
    !signedUpload?.cloudName ||
    !signedUpload.apiKey ||
    !signedUpload.signature ||
    !signedUpload.timestamp ||
    !signedUpload.folder ||
    !signedUpload.publicId
  ) {
    const detail = signedUpload?.detail ? ` (${signedUpload.detail})` : '';
    throw new Error(`${signedUpload?.error || 'Signature Cloudinary impossible.'}${detail}`);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signedUpload.apiKey);
  formData.append('timestamp', String(signedUpload.timestamp));
  formData.append('signature', signedUpload.signature);
  formData.append('folder', signedUpload.folder);
  formData.append('public_id', signedUpload.publicId);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData
  });

  const payload = await response.json().catch(() => null) as {
    secure_url?: string;
    public_id?: string;
    resource_type?: CloudinaryResourceType;
    format?: string;
    bytes?: number;
    width?: number;
    height?: number;
    duration?: number;
    error?: { message?: string } | string;
  } | null;

  if (!response.ok || !payload?.secure_url || !payload.public_id) {
    const cloudinaryError = typeof payload?.error === 'string'
      ? payload.error
      : payload?.error?.message;
    throw new Error(cloudinaryError || 'Upload Cloudinary impossible.');
  }

  return {
    provider: 'cloudinary',
    mediaUrl: payload.secure_url,
    secureUrl: payload.secure_url,
    publicId: payload.public_id,
    resourceType: payload.resource_type || resourceType,
    format: payload.format,
    bytes: payload.bytes,
    width: payload.width,
    height: payload.height,
    duration: payload.duration
  };
}
