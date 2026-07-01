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

const uploadChunkedToCloudinary = async (
  file: File,
  signedUpload: SignedUploadPayload,
  resourceType: CloudinaryResourceType
) => {
  const chunkSize = 6 * 1024 * 1024;
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let lastPayload: {
    secure_url?: string;
    public_id?: string;
    resource_type?: CloudinaryResourceType;
    format?: string;
    bytes?: number;
    width?: number;
    height?: number;
    duration?: number;
    error?: { message?: string } | string;
  } | null = null;

  for (let start = 0; start < file.size; start += chunkSize) {
    const end = Math.min(start + chunkSize, file.size);
    const formData = new FormData();
    formData.append('file', file.slice(start, end), file.name);
    formData.append('api_key', signedUpload.apiKey);
    formData.append('timestamp', String(signedUpload.timestamp));
    formData.append('signature', signedUpload.signature);
    formData.append('folder', signedUpload.folder);
    formData.append('public_id', signedUpload.publicId);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/${resourceType}/upload`, {
      method: 'POST',
      headers: {
        'X-Unique-Upload-Id': uploadId,
        'Content-Range': `bytes ${start}-${end - 1}/${file.size}`
      },
      body: formData
    });

    lastPayload = await response.json().catch(() => null);
    if (!response.ok) {
      const cloudinaryError = typeof lastPayload?.error === 'string'
        ? lastPayload.error
        : lastPayload?.error?.message;
      throw new Error(cloudinaryError || 'Upload Cloudinary lourd impossible.');
    }
  }

  return lastPayload;
};

export async function compressImageForCloudinary(file: File, maxBytes = 9 * 1024 * 1024): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= maxBytes) return file;

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Compression image impossible.'));
      image.src = objectUrl;
    });

    const maxDimension = 2200;
    const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * ratio));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * ratio));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = 0.86;
    let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    while (blob && blob.size > maxBytes && quality > 0.48) {
      quality -= 0.1;
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    }

    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadMediaToCloudinary(file: File, ownerId: string): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryReady()) {
    throw new Error('Cloudinary doit avoir VITE_CLOUDINARY_CLOUD_NAME configuré.');
  }

  const safeFile = await compressImageForCloudinary(file);
  const resourceType = getResourceType(safeFile);
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

  const payload = safeFile.size > 9 * 1024 * 1024
    ? await uploadChunkedToCloudinary(safeFile, signedUpload, resourceType)
    : await (async () => {
      const formData = new FormData();
      formData.append('file', safeFile);
      formData.append('api_key', signedUpload.apiKey);
      formData.append('timestamp', String(signedUpload.timestamp));
      formData.append('signature', signedUpload.signature);
      formData.append('folder', signedUpload.folder);
      formData.append('public_id', signedUpload.publicId);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/${resourceType}/upload`, {
        method: 'POST',
        body: formData
      });

      const nextPayload = await response.json().catch(() => null) as {
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

      if (!response.ok) {
        const cloudinaryError = typeof nextPayload?.error === 'string'
          ? nextPayload.error
          : nextPayload?.error?.message;
        throw new Error(cloudinaryError || 'Upload Cloudinary impossible.');
      }

      return nextPayload;
    })();

  const typedPayload = payload as {
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

  if (!typedPayload?.secure_url || !typedPayload.public_id) {
    const cloudinaryError = typeof typedPayload?.error === 'string'
      ? typedPayload.error
      : typedPayload?.error?.message;
    throw new Error(cloudinaryError || 'Upload Cloudinary impossible.');
  }

  return {
    provider: 'cloudinary',
    mediaUrl: typedPayload.secure_url,
    secureUrl: typedPayload.secure_url,
    publicId: typedPayload.public_id,
    resourceType: typedPayload.resource_type || resourceType,
    format: typedPayload.format,
    bytes: typedPayload.bytes,
    width: typedPayload.width,
    height: typedPayload.height,
    duration: typedPayload.duration
  };
}
