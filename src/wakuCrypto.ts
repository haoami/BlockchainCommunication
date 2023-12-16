import "@ethersproject/shims";

import { PublicKeyMessage } from "./messaging/wire";
import { generatePrivateKey, getPublicKey } from "@waku/message-encryption";
import { PublicKeyContentTopic } from "./waku";
import { keccak256, _TypedDataEncoder, recoverAddress } from "ethers/lib/utils";
import { equals } from "uint8arrays/equals";
import type { TypedDataSigner } from "@ethersproject/abstract-signer";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@waku/utils/bytes";
import { pbkdf2 } from 'pbkdf2';


export const PublicKeyMessageEncryptionKey = hexToBytes(
  keccak256(utf8ToBytes(PublicKeyContentTopic))
);

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/**
 * Generate new encryption key pair.
 */
export async function generateEncryptionKeyPair(): Promise<KeyPair> {
  const privateKey = generatePrivateKey();
  const publicKey = getPublicKey(privateKey);
  return { privateKey, publicKey };
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
  const keylen = 65;
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
