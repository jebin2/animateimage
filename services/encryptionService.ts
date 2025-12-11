// Encryption service using RSA-OAEP with hybrid AES-GCM for larger payloads
// Self-contained, no external dependencies - ready for plug and play

export interface EncryptionConfig {
    publicKeyPem: string;
}

// Default RSA Public Key for encryption (private key kept on server)
const DEFAULT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkmiMIW3fkXUnKjhAthrq
4G0esmDh0un0DJoPAqiji+rA0suGMq0pJwFOJWA5zLNk/Ial9+16PkswIxOaIpU/
2yoX1WhFblU3YwfuGwxcfgHDFRZ1CGDWoEHZ7+Q8CHeW3N4Jt1YOPXXx9WeNFQQs
65CX7FU9XBrh++2gx+CObGi+iGSmK1+d6hPnNIClmxzXtW9qEBUo7JP6qfWFPjYx
CPjW8Rgmmz1luyAROfe3PKbBDG/doHTJK+Wxq8FQMkQthmWwEQsHB8MMzN/CLQwC
9Ux3JDj8lVx37PvZs3bUTwHkQ5QZhgycaMa9afghcG67vey2rDYxq4undL0dN4XT
LQIDAQAB
-----END PUBLIC KEY-----`;

let currentPublicKeyPem = DEFAULT_PUBLIC_KEY_PEM;

// Configure encryption with custom public key
export function configureEncryption(config: EncryptionConfig): void {
    currentPublicKeyPem = config.publicKeyPem;
}

// Convert PEM to CryptoKey
async function importPublicKey(): Promise<CryptoKey> {
    const pemContents = currentPublicKeyPem
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s/g, '');

    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    return await crypto.subtle.importKey(
        'spki',
        binaryDer.buffer,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt']
    );
}

// Encrypt data with RSA-OAEP (hybrid encryption with AES-GCM for larger payloads)
export async function encryptData(data: string): Promise<string> {
    const publicKey = await importPublicKey();
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);

    // If data is too large for RSA (max ~190 bytes for 2048-bit key with OAEP-SHA256)
    // Use hybrid encryption with AES
    if (dataBytes.length > 190) {
        // Generate random AES key
        const aesKey = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt']
        );

        // Encrypt data with AES
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedData = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            dataBytes
        );

        // Export and encrypt AES key with RSA
        const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
        const encryptedAesKey = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            publicKey,
            rawAesKey
        );

        // Combine: encryptedKey + iv + encryptedData
        const combined = {
            type: 'hybrid',
            key: btoa(String.fromCharCode(...new Uint8Array(encryptedAesKey))),
            iv: btoa(String.fromCharCode(...iv)),
            data: btoa(String.fromCharCode(...new Uint8Array(encryptedData)))
        };

        return btoa(JSON.stringify(combined));
    } else {
        // Direct RSA encryption for small data
        const encrypted = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            publicKey,
            dataBytes
        );

        const combined = {
            type: 'direct',
            data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
        };

        return btoa(JSON.stringify(combined));
    }
}

// Utility: Check if encryption service is ready
export function isEncryptionReady(): boolean {
    return !!currentPublicKeyPem;
}

// Utility: Get current public key (for debugging/verification)
export function getCurrentPublicKey(): string {
    return currentPublicKeyPem;
}
