export type ShareLinkInput = {
  url: string;
  title: string;
  text?: string;
};

const copyWithLegacyFallback = async (value: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  input.remove();

  if (!copied) throw new Error('Copie du lien impossible.');
};

export const toAbsoluteShareURL = (value: string) => {
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
};

export async function shareLink({ url, title, text }: ShareLinkInput): Promise<'shared' | 'copied'> {
  const absoluteURL = toAbsoluteShareURL(url);

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url: absoluteURL });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
    }
  }

  await copyWithLegacyFallback(absoluteURL);
  return 'copied';
}
