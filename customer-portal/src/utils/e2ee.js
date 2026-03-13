import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

const KEY_ID = 'v1';
const STORAGE_PREFIX = 'e2ee:keypair:';
const UPLOAD_PREFIX = 'e2ee:publicKeyUploaded:';

const toBase64 = (bytes) => naclUtil.encodeBase64(bytes);
const fromBase64 = (text) => naclUtil.decodeBase64(text);
const toString = (bytes) => naclUtil.encodeUTF8(bytes);
const fromString = (text) => naclUtil.decodeUTF8(text);
const textEncoder = new TextEncoder();
const KDF_ITERATIONS = 100000;

const deriveKeyFromPassword = async (password, salt) => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
};

export const encryptPrivateKeyWithPassword = async ({ privateKey, password }) => {
  await ensureSodium();
  const salt = nacl.randomBytes(16);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const key = await deriveKeyFromPassword(password, salt);
  const cipher = nacl.secretbox(fromBase64(privateKey), nonce, key);
  return {
    encryptedPrivateKey: toBase64(cipher),
    encryptedPrivateKeyNonce: toBase64(nonce),
    encryptedPrivateKeySalt: toBase64(salt),
    encryptedPrivateKeyAlgo: 'secretbox-pbkdf2',
  };
};

export const decryptPrivateKeyWithPassword = async ({
  encryptedPrivateKey,
  encryptedPrivateKeyNonce,
  encryptedPrivateKeySalt,
  password,
}) => {
  if (!encryptedPrivateKey || !encryptedPrivateKeyNonce || !encryptedPrivateKeySalt) {
    return null;
  }
  await ensureSodium();
  const salt = fromBase64(encryptedPrivateKeySalt);
  const nonce = fromBase64(encryptedPrivateKeyNonce);
  const key = await deriveKeyFromPassword(password, salt);
  const opened = nacl.secretbox.open(fromBase64(encryptedPrivateKey), nonce, key);
  if (!opened) return null;
  return toBase64(opened);
};

const getStoredKeyPair = (userId) => {
  const storageKey = `${STORAGE_PREFIX}${userId}`;
  const stored = localStorage.getItem(storageKey);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (parsed?.publicKey && parsed?.privateKey && parsed?.keyId) {
      return parsed;
    }
  } catch (error) {
    return null;
  }
  return null;
};

export const ensureSodium = async () => nacl;

export const getOrCreateKeyPair = async (userId) => {
  await ensureSodium();
  const storageKey = `${STORAGE_PREFIX}${userId}`;
  const stored = localStorage.getItem(storageKey);

  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.publicKey && parsed?.privateKey && parsed?.keyId === KEY_ID) {
        return parsed;
      }
    } catch (error) {
      // ignore parse errors and regenerate
    }
  }

  const keyPair = nacl.box.keyPair();
  const payload = {
    keyId: KEY_ID,
    publicKey: toBase64(keyPair.publicKey),
    privateKey: toBase64(keyPair.secretKey),
  };
  localStorage.setItem(storageKey, JSON.stringify(payload));
  return payload;
};

export const ensurePublicKeyRegistered = async (userId, updateKeys) => {
  const keyPair = await getOrCreateKeyPair(userId);
  const uploadedKey = `${UPLOAD_PREFIX}${userId}`;
  const lastUploadedRaw = localStorage.getItem(uploadedKey);
  let lastUploadedKeyId = null;
  let lastUploadedPublicKey = null;

  if (lastUploadedRaw) {
    try {
      const parsed = JSON.parse(lastUploadedRaw);
      if (parsed && typeof parsed === 'object') {
        lastUploadedKeyId = parsed.keyId || null;
        lastUploadedPublicKey = parsed.publicKey || null;
      } else {
        lastUploadedKeyId = lastUploadedRaw;
      }
    } catch (error) {
      lastUploadedKeyId = lastUploadedRaw;
    }
  }

  if (lastUploadedKeyId !== keyPair.keyId || lastUploadedPublicKey !== keyPair.publicKey) {
    await updateKeys({ publicKey: keyPair.publicKey, keyId: keyPair.keyId });
    localStorage.setItem(uploadedKey, JSON.stringify({
      keyId: keyPair.keyId,
      publicKey: keyPair.publicKey,
    }));
  }

  return keyPair;
};

export const ensureKeypairSynced = async ({ userId, password, updateKeys, getPrivateKey }) => {
  let keyPair = getStoredKeyPair(userId);

  if (!keyPair && password && getPrivateKey) {
    try {
      const remote = await getPrivateKey();
      const restored = await decryptPrivateKeyWithPassword({
        encryptedPrivateKey: remote?.encryptedPrivateKey,
        encryptedPrivateKeyNonce: remote?.encryptedPrivateKeyNonce,
        encryptedPrivateKeySalt: remote?.encryptedPrivateKeySalt,
        password,
      });
      if (restored && remote?.publicKey) {
        keyPair = {
          keyId: remote.keyId || KEY_ID,
          publicKey: remote.publicKey,
          privateKey: restored,
        };
        localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(keyPair));
      }
    } catch (error) {
      // ignore and fall back to local keypair
    }
  }

  if (!keyPair) {
    keyPair = await getOrCreateKeyPair(userId);
  }

  if (password && updateKeys) {
    const encryptedBundle = await encryptPrivateKeyWithPassword({
      privateKey: keyPair.privateKey,
      password,
    });
    await updateKeys({
      publicKey: keyPair.publicKey,
      keyId: keyPair.keyId,
      ...encryptedBundle,
    });
    localStorage.setItem(`${UPLOAD_PREFIX}${userId}`, JSON.stringify({
      keyId: keyPair.keyId,
      publicKey: keyPair.publicKey,
    }));
  } else if (updateKeys) {
    await ensurePublicKeyRegistered(userId, updateKeys);
  }

  return keyPair;
};

export const encryptForRecipients = async ({ plaintext, recipients, senderUserId, attachments = [] }) => {
  await ensureSodium();
  const senderKeys = await getOrCreateKeyPair(senderUserId);
  const messageKey = nacl.randomBytes(nacl.secretbox.keyLength);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const cipherText = nacl.secretbox(fromString(plaintext), nonce, messageKey);

  const recipientList = recipients.filter((r) => r?.publicKey && r?.keyId && r?.userId);
  const sealedKeys = recipientList.map((recipient) => {
    const epk = nacl.box.keyPair();
    const nonceKey = nacl.randomBytes(nacl.box.nonceLength);
    const sealedKey = nacl.box(
      messageKey,
      nonceKey,
      fromBase64(recipient.publicKey),
      epk.secretKey
    );
    return {
      user: recipient.userId,
      keyId: recipient.keyId,
      sealedKey: toBase64(sealedKey),
      nonce: toBase64(nonceKey),
      epk: toBase64(epk.publicKey),
    };
  });

  // Include sender as a recipient so they can decrypt history
  const senderNonce = nacl.randomBytes(nacl.box.nonceLength);
  const senderSealedKey = {
    user: senderUserId,
    keyId: senderKeys.keyId,
    sealedKey: toBase64(
      nacl.box(
        messageKey,
        senderNonce,
        fromBase64(senderKeys.publicKey),
        fromBase64(senderKeys.privateKey)
      )
    ),
    nonce: toBase64(senderNonce),
    epk: senderKeys.publicKey,
  };

  const encryptedAttachments = attachments.map((attachment) => {
    const attachmentNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const bytes = attachment.data instanceof Uint8Array
      ? attachment.data
      : new Uint8Array(attachment.data);
    const encrypted = nacl.secretbox(bytes, attachmentNonce, messageKey);
    return {
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      cipherText: toBase64(encrypted),
      nonce: toBase64(attachmentNonce),
      algo: 'secretbox',
    };
  });

  return {
    encrypted: {
      cipherText: toBase64(cipherText),
      nonce: toBase64(nonce),
      algo: 'secretbox',
    },
    encryptedKeys: [senderSealedKey, ...sealedKeys],
    encryptedAttachments,
  };
};

export const decryptMessage = async ({ message, userId }) => {
  if (!message?.encrypted?.cipherText || !message?.encryptedKeys?.length) {
    return message;
  }

  await ensureSodium();
  const keyPair = await getOrCreateKeyPair(userId);
  const keyEntry = message.encryptedKeys.find((entry) => {
    const entryUser = entry?.user?._id || entry?.user;
    return String(entryUser) === String(userId);
  });

  if (!keyEntry?.sealedKey) {
    return message;
  }

  try {
    const messageKey = nacl.box.open(
      fromBase64(keyEntry.sealedKey),
      fromBase64(keyEntry.nonce),
      fromBase64(keyEntry.epk),
      fromBase64(keyPair.privateKey)
    );

    if (!messageKey) {
      return { ...message, content: '🔒 Encrypted message' };
    }

    const plaintextBytes = nacl.secretbox.open(
      fromBase64(message.encrypted.cipherText),
      fromBase64(message.encrypted.nonce),
      messageKey
    );

    if (!plaintextBytes) {
      return { ...message, content: '🔒 Encrypted message' };
    }

    const plaintext = toString(plaintextBytes);
    const attachments = (message.encryptedAttachments || []).map((attachment) => {
      try {
        const decrypted = nacl.secretbox.open(
          fromBase64(attachment.cipherText),
          fromBase64(attachment.nonce),
          messageKey
        );
        if (!decrypted) {
          return { ...attachment, dataUrl: null };
        }
        const base64 = toBase64(decrypted);
        return {
          ...attachment,
          dataUrl: `data:${attachment.mimeType};base64,${base64}`,
        };
      } catch (error) {
        return { ...attachment, dataUrl: null };
      }
    });
    return { ...message, content: plaintext, attachments };
  } catch (error) {
    return { ...message, content: '🔒 Encrypted message' };
  }
};

export const decryptMessages = async ({ messages, userId }) => {
  const decrypted = await Promise.all(
    (messages || []).map((message) => decryptMessage({ message, userId }))
  );
  return decrypted;
};
