import { apiRequest } from '../domains/shared/apiClient';
import { isTauriNative } from './nativePlatform';
import { createOfflineUpload, removeOfflineUpload, updateOfflineUpload } from './offlineCache';
import { getMediaFileKind, isBrowserCompressibleImage } from './mediaFile';

export type CloudinaryResourceType = 'image' | 'video' | 'raw';

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
const DEFAULT_NATIVE_SIGNING_BASE_URL = 'https://afri.afrisell.app';

export const isCloudinaryReady = () => Boolean(configuredCloudName);

const getCloudinarySignUploadEndpoint = () => {
  const explicitEndpoint = (import.meta.env.VITE_CLOUDINARY_SIGN_UPLOAD_URL as string | undefined)?.trim();

  if (!isTauriNative()) return '/api/cloudinary/sign-upload';
  if (explicitEndpoint) return explicitEndpoint;

  const nativeBaseUrl = (
    (import.meta.env.VITE_AFRISELL_MEDIA_API_URL as string | undefined) ||
    (import.meta.env.VITE_AFRISELL_API_BASE_URL as string | undefined) ||
    DEFAULT_NATIVE_SIGNING_BASE_URL
  ).trim().replace(/\/$/, '');

  return `${nativeBaseUrl}/api/cloudinary/sign-upload`;
};

const getResourceType = (file: File): CloudinaryResourceType => {
  const mediaKind = getMediaFileKind(file);
  if (mediaKind) return mediaKind;
  throw new Error('Le fichier doit être une image ou une video.');
};

const getUploadResourceType = (file: File, allowRaw: boolean): CloudinaryResourceType => {
  const mediaKind = getMediaFileKind(file);
  if (mediaKind) return mediaKind;
  if (allowRaw) return 'raw';
  throw new Error('Le fichier doit être une image ou une video.');
};

const UPLOAD_ATTEMPTS = 3;
const UPLOAD_TIMEOUT_MS = 60_000;

const pause = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const waitForConnection = async (timeoutMs = 15_000) => {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return true;

  return new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    const finish = (connected: boolean) => {
      window.clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      resolve(connected);
    };
    const onOnline = () => finish(true);
    window.addEventListener('online', onOnline, { once: true });
  });
};

const fetchWithUploadTimeout = async (input: RequestInfo | URL, init: RequestInit, timeoutMs = UPLOAD_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Le transfert a pris trop de temps. Vérifie ta connexion puis réessaie.');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
};

const isRetryableUploadError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return !/(invalid|format|non pris en charge|doit être|cloudinary doit)/.test(message);
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

    const response = await fetchWithUploadTimeout(`https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/${resourceType}/upload`, {
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
  if (!isBrowserCompressibleImage(file) || file.size <= maxBytes) return file;

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

async function uploadCloudinaryFile(file: File, ownerId: string, resourceType: CloudinaryResourceType): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryReady()) {
    throw new Error('Cloudinary doit avoir VITE_CLOUDINARY_CLOUD_NAME configuré.');
  }

  const safeFile = resourceType === 'image' ? await compressImageForCloudinary(file) : file;
  const signedUpload = await apiRequest<SignedUploadPayload>(getCloudinarySignUploadEndpoint(), {
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

      const response = await fetchWithUploadTimeout(`https://api.cloudinary.com/v1_1/${signedUpload.cloudName}/${resourceType}/upload`, {
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

async function uploadWithRecovery(file: File, ownerId: string, resourceType: CloudinaryResourceType): Promise<CloudinaryUploadResult> {
  const uploadId = await createOfflineUpload({
    ownerId,
    resourceType,
    file,
    fileName: file.name || `${resourceType}-${Date.now()}`,
    mimeType: file.type || 'application/octet-stream'
  });
  let lastError: unknown;

  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt += 1) {
    const connected = await waitForConnection();
    if (!connected) {
      lastError = new Error('Connexion indisponible. Le fichier reste prêt à être renvoyé.');
    } else {
      await updateOfflineUpload(uploadId, { status: 'uploading', attempts: attempt, lastError: '' });
      try {
        // A new signature is obtained on every attempt because Cloudinary signatures expire.
        const result = await uploadCloudinaryFile(file, ownerId, resourceType);
        await removeOfflineUpload(uploadId);
        return result;
      } catch (error) {
        lastError = error;
      }
    }

    await updateOfflineUpload(uploadId, {
      status: 'failed',
      attempts: attempt,
      lastError: lastError instanceof Error ? lastError.message : 'Transfert impossible'
    });

    if (attempt < UPLOAD_ATTEMPTS && isRetryableUploadError(lastError)) {
      await pause(attempt * 900);
      continue;
    }
    break;
  }

  const detail = lastError instanceof Error ? lastError.message : 'Transfert impossible.';
  throw new Error(`${detail} Le fichier est conservé localement pour une nouvelle tentative.`);
}

export async function uploadMediaToCloudinary(file: File, ownerId: string): Promise<CloudinaryUploadResult> {
  return uploadWithRecovery(file, ownerId, getResourceType(file));
}

export async function uploadDigitalAssetToCloudinary(file: File, ownerId: string): Promise<CloudinaryUploadResult> {
  return uploadWithRecovery(file, ownerId, getUploadResourceType(file, true));
}

type UploadBatchOptions = {
  concurrency?: number;
  onProgress?: (completed: number, total: number) => void;
};

const uploadBatch = async (
  files: File[],
  upload: (file: File) => Promise<CloudinaryUploadResult>,
  options: UploadBatchOptions = {}
) => {
  const results = new Array<CloudinaryUploadResult>(files.length);
  const concurrency = Math.max(1, Math.min(options.concurrency || 2, 2));
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (cursor < files.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await upload(files[index]);
      completed += 1;
      options.onProgress?.(completed, files.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, () => worker()));
  return results;
};

export const uploadMediaBatchToCloudinary = (files: File[], ownerId: string, options?: UploadBatchOptions) => (
  uploadBatch(files, (file) => uploadMediaToCloudinary(file, ownerId), options)
);

export const uploadDigitalAssetBatchToCloudinary = (files: File[], ownerId: string, options?: UploadBatchOptions) => (
  uploadBatch(files, (file) => uploadDigitalAssetToCloudinary(file, ownerId), options)
);
