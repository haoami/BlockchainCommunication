import "@ethersproject/shims";

import { PublicKeyMessage } from "./messaging/wire";
import { generatePrivateKey, getPublicKey } from "@waku/message-encryption";
import { keccak256, _TypedDataEncoder, recoverAddress } from "ethers/lib/utils";
import { equals } from "uint8arrays/equals";
import type { TypedDataSigner } from "@ethersproject/abstract-signer";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@waku/utils/bytes";
import { pbkdf2 } from 'pbkdf2';
import { resolve } from "path";
import { Web3Provider } from "@ethersproject/providers";
import { Wallet, ethers } from "ethers";

export type PublicKeyMessageObj = {
  encryptionPK: Uint8Array,
  kdSalt: Uint8Array,
  willUseAddr: Uint8Array
}

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/**
 * Generate new encryption key pair.
 */
export async function generateEncryptionKeyPair(): Promise<KeyPair> {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: 'SHA-256',
      },
      true,
      ['encrypt', 'decrypt']
    );
    const privateKey = arrayBufferToUint8Array(await exportPrivateCryptoKeyToBuffer(keyPair.privateKey));
    const publicKey = arrayBufferToUint8Array(await exportPublickCryptoKeyToBuffer(keyPair.publicKey));
    return { privateKey, publicKey };
}

async function exportPublickCryptoKeyToBuffer(key: CryptoKey): Promise<ArrayBuffer> {
  const exportedKey = await window.crypto.subtle.exportKey("spki", key);
  return exportedKey;
}

async function exportPrivateCryptoKeyToBuffer(key: CryptoKey): Promise<ArrayBuffer> {
  const exportedKey = await window.crypto.subtle.exportKey("pkcs8", key);
  return exportedKey;
}

function arrayBufferToUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

export async function importPublicKeyUint8ArrayToCryptoKey(uint8Array: Uint8Array): Promise<CryptoKey> {
  const keyUsages: KeyUsage[] = ['encrypt'];
  const importedKey = await window.crypto.subtle.importKey('spki', uint8Array, 
  {
    name: "RSA-OAEP",
    hash: "SHA-256",
  },
  true, keyUsages);
  return importedKey;
}

export async function importPrivateKeyUint8ArrayToCryptoKey(uint8Array: Uint8Array): Promise<CryptoKey> {
  const keyUsages: KeyUsage[] = ['decrypt'];
  const importedKey = await window.crypto.subtle.importKey('pkcs8', uint8Array,
  {
    name: "RSA-OAEP",
    hash: "SHA-256",
  },
  true, keyUsages);
  return importedKey;
}

export async function encryptWithPublicKey(publicKey: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array> {
  const encryptedBuffer = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, plaintext);
  const res = new Uint8Array(encryptedBuffer);
  return res;
}

export async function decryptWithPrivateKey(privateKey: CryptoKey, encryptedBuffer: Uint8Array): Promise<Uint8Array> {
  const decryptedBuffer = await window.crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encryptedBuffer);
  const res = new Uint8Array(decryptedBuffer);
  return res;
}

export async function importAESKeyUint8ArrayToCryptoKey(uint8Array: Uint8Array): Promise<CryptoKey> {
  const importedKey = await window.crypto.subtle.importKey(
    'raw',
    uint8Array,
    { name: 'AES-CBC' },
    true,
    ['encrypt', 'decrypt']
  );
  return importedKey;
}

export async function encryptCBC(key: CryptoKey, iv: Uint8Array, encoded: Uint8Array): Promise<Uint8Array> {
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    key,
    encoded,
  );
  const res = new Uint8Array(encryptedBuffer);
  return res;
}

export async function decryptCBC(key: CryptoKey, iv: Uint8Array, encoded: Uint8Array): Promise<Uint8Array> {
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    key,
    encoded,
  );
  const res = new Uint8Array(decryptedBuffer);
  return res;
}

/**
 * Sign the encryption public key with Web3. This can then be published to let other
 * users know to use this encryption public key to encrypt messages for the
 * Ethereum Address holder.
 */
export async function createPublicKeyMessage(
  address: string,
  willUseAddr: string,
  encryptionPublicKey: Uint8Array,
  randomSeed: Uint8Array,
  signer: TypedDataSigner
): Promise<PublicKeyMessage> {
  const signature = await signEncryptionKey(
    encryptionPublicKey,
    address,
    willUseAddr,
    randomSeed,
    signer
  );

  return new PublicKeyMessage({
    encryptionPublicKey: encryptionPublicKey,
    ethAddress: hexToBytes(address),
    willUseAddr: hexToBytes(willUseAddr),
    randomSeed: randomSeed,
    signature: hexToBytes(signature),
  });
}

function buildMsgParams(encryptionPublicKey: Uint8Array, fromAddress: string, willUseAddr: string, randomSeed: Uint8Array) {
  return {
    domain: {
      name: "Ethereum Private Message over Waku",
      version: "1",
    },
    value: {
      message:
        "By signing this message you certify that messages addressed to `ownerAddress` must be encrypted with `encryptionPublicKey`",
      encryptionPublicKey: bytesToHex(encryptionPublicKey),
      ownerAddress: fromAddress,
      willUseAddr: willUseAddr,
      randomSeed: bytesToHex(randomSeed),
    },
    // Refers to the keys of the *types* object below.
    primaryType: "PublishEncryptionPublicKey",
    types: {
      PublishEncryptionPublicKey: [
        { name: "message", type: "string" },
        { name: "encryptionPublicKey", type: "string" },
        { name: "ownerAddress", type: "string" },
        { name: "willUseAddr", type: "string" },
        { name: "randomSeed", type: "string"}
      ],
    },
  };
}

export async function signEncryptionKey(
  encryptionPublicKey: Uint8Array,
  fromAddress: string,
  willUseAddr: string,
  randomSeed: Uint8Array,
  signer: TypedDataSigner
): Promise<Uint8Array> {
  const { domain, types, value } = buildMsgParams(
    encryptionPublicKey,
    fromAddress,
    willUseAddr,
    randomSeed
  );
  const result = await signer._signTypedData(domain, types, value);

  console.log("TYPED SIGNED:" + JSON.stringify(result));

  return hexToBytes(result);
}

/**
 * Validate that the Encryption Public Key was signed by the holder of the given Ethereum address.
 */
export function validatePublicKeyMessage(msg: PublicKeyMessage): boolean {
  const { domain, types, value } = buildMsgParams(
    msg.encryptionPublicKey,
    "0x" + bytesToHex(msg.ethAddress),
    "0x" + bytesToHex(msg.willUseAddr),
    msg.randomSeed
  );

  try {
    const hash = _TypedDataEncoder.hash(domain, types, value);

    const recovered = recoverAddress(hash, msg.signature);
    console.log("Recovered", recovered);
    console.log("ethAddress", "0x" + bytesToHex(msg.ethAddress));

    return equals(hexToBytes(recovered), msg.ethAddress);
  } catch (e) {
    console.error("Could not recover public key from signature", e);
    return false;
  }
}

/**
 * derive key using pbkdf2.
 */
export async function generateDeriveKey(password: string, salt: string): Promise<Uint8Array> {
  const iterations = 50000;
  const keylen = 16;
  const digest = 'sha256';

  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
      if (err) {
        console.warn(err);
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * Generate random num bytes salt
 */
export function genRandomBytes(num: number){
    const randomBytes = new Uint8Array(num);
    window.crypto.getRandomValues(randomBytes);
    return randomBytes;
}

export async function sendMultiTransactions(provider: Web3Provider, wallet: Wallet,
  transactions: Map<number, { to: string; value: ethers.BigNumber; data?: Uint8Array}>): Promise<boolean> {
  try{
    const originalNonce = await provider.getTransactionCount(wallet.address);
    const gasPrice = await provider.getGasPrice();
    const percentageIncrease = 1;
    const increasedGasPrice = gasPrice.mul(1 + percentageIncrease);
    const tx = await wallet.sendTransaction({
        ...transactions.get(0),
        nonce: originalNonce,
        gasPrice: increasedGasPrice,
      });
    console.log(tx);
    const res = await tx.wait();
    console.log("transaction[0]: ", res);
    for (let i = 1; i < transactions.size-1; i++) {
      const currentNonce = originalNonce+i;
      const tx = await wallet.sendTransaction({
        ...transactions.get(i),
        nonce: currentNonce,
        gasPrice: increasedGasPrice,
      });
      if (i === transactions.size-2){
          const res = await tx.wait();
          console.log("transaction[-2]: ", res);
          const lastTx = await wallet.sendTransaction({
            ...transactions.get(i+1),
            nonce: currentNonce+1,
            gasPrice: increasedGasPrice,
          });
          console.log(lastTx);
      }
    }
    return Promise.resolve(true);
  }
  catch{
    console.log("something err");
    return Promise.reject(false);
  }
}