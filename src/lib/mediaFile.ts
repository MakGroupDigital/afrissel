export type MediaFileKind = 'image' | 'video';

const IMAGE_EXTENSIONS = new Set([
  'avif', 'bmp', 'gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'tif', 'tiff', 'webp'
]);

const VIDEO_EXTENSIONS = new Set([
  '3gp', '3g2', 'avi', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'mpg', 'webm'
]);

const extensionOf = (name: string) => {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/i);
  return match?.[1] || '';
};

/** Android pickers sometimes omit File.type, so filenames are a safe fallback. */
export const getMediaFileKind = (file: Pick<File, 'name' | 'type'>): MediaFileKind | null => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';

  const extension = extensionOf(file.name);
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  return null;
};

export const isImageMediaFile = (file: Pick<File, 'name' | 'type'>) => getMediaFileKind(file) === 'image';

export const isVideoMediaFile = (file: Pick<File, 'name' | 'type'>) => getMediaFileKind(file) === 'video';

export const isBrowserCompressibleImage = (file: Pick<File, 'type'>) => (
  /^image\/(jpe?g|png|webp)$/i.test(file.type)
);
