// Encrypt a file using a static symmetric key.
// We use Web Crypto API (AES-GCM).


async function getKey(): Promise<CryptoKey> {
  const ENCRYPTION_KEY = import.meta.env.VITE_DOCUMENT_ENCRYPTION_KEY || '12345678901234567890123456789012'; // 32 bytes
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptFile(file: File): Promise<File> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const buffer = await file.arrayBuffer();
  
  const encryptedContent = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    buffer
  );

  // Combine IV + Encrypted Data so backend can extract IV
  const encryptedFileBuffer = new Uint8Array(iv.length + encryptedContent.byteLength);
  encryptedFileBuffer.set(iv, 0);
  encryptedFileBuffer.set(new Uint8Array(encryptedContent), iv.length);

  return new File([encryptedFileBuffer], file.name, {
    type: file.type, // keep original MIME type so backend accepts it
    lastModified: Date.now(),
  });
}
