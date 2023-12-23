import { PublicKeyMessageObj } from "../wakuCrypto";
import { Dispatch, SetStateAction} from "react";
import { Web3Provider } from "@ethersproject/providers";
import { keccak256 } from "ethers/lib/utils";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";
import { PublicKeyMessage } from "../messaging/wire";
import { equals } from "uint8arrays/equals";
import { decryptCBC, decryptWithPrivateKey, generateDeriveKey, importAESKeyUint8ArrayToCryptoKey, importPrivateKeyUint8ArrayToCryptoKey, importPublicKeyUint8ArrayToCryptoKey, validatePublicKeyMessage } from "../wakuCrypto";
import { Message } from "../messaging/Messages";
class AsyncQueue {
  private queue: { task: () => Promise<number>; blockNum: number }[] = [];
  private processing = false;

  constructor() {}

  enqueue(task: () => Promise<number>, blockNum: number) {
    const newTask = { task, blockNum };

    let low = 0,
      high = this.queue.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.queue[mid].blockNum < blockNum) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    this.queue.splice(low, 0, newTask);
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing) {
      return;
    }
    this.processing = true;

    while (this.queue.length > 0) {
      const { task } = this.queue.shift()!;
      await task();
    }
    this.processing = false;
  }
}

class Semaphore {
  private count: number;
  private queue: (() => void)[];

  constructor(initialCount: number) {
    this.count = initialCount;
    this.queue = [];
  }

  async acquire() {
    if (this.count > 0){
      this.count--;
    }
    else {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }
  }

  release() {
    this.count++;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

class AsyncMutex {
  private isLocked: boolean = false;
  private waitingQueue: (() => void)[] = [];

  async lock(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const onUnlock = () => {
        this.isLocked = false;
        const next = this.waitingQueue.shift();
        if (next) {
          setTimeout(() => {
            this.lock().then(resolve);
            next();
          }, 0);
        } else {
          resolve(() => {});
        }
      };

      const lockAttempt = () => {
        if (!this.isLocked) {
          this.isLocked = true;
          resolve(onUnlock);
        } else {
          this.waitingQueue.push(lockAttempt);
        }
      };
      lockAttempt();
    });
  }

  unlock(onUnlock: () => void): void {
    setTimeout(() => {
      onUnlock();
    }, 0);
  }
}


const mutex = new AsyncMutex();


var receiving = false;
var secretMap: Map<number, number> = new Map();
var mapSecretMap: Map<string, Map<number, number>> = new Map();
var mapReceiving: string[] = [];
const blockQueue = new AsyncQueue();

async function handlePKMwithNoEncrypt(encrypted: Uint8Array, myAddress: string, setter: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>): Promise<boolean> {
  console.log("start handlePKMwithNoEncrypt");
  const key = await importAESKeyUint8ArrayToCryptoKey(hexToBytes(myAddress.slice(2, 34)));
  const iv = hexToBytes(myAddress.slice(-33, -1));
  const payload = await decryptCBC(key, iv, encrypted);
  const publicKeyMsg = PublicKeyMessage.decode(payload);
  if (!publicKeyMsg) return Promise.reject(false);
  if (!publicKeyMsg.ethAddress) return Promise.reject(false);
  if (myAddress && equals(publicKeyMsg.ethAddress, hexToBytes(myAddress)))
    return Promise.reject(false);
  const res = validatePublicKeyMessage(publicKeyMsg);
  console.log("Is Public Key Message valid?", res);

  if (res) {
    setter((prevPks: Map<string, PublicKeyMessageObj>) => {
      prevPks.set(
        '0x'+bytesToHex(publicKeyMsg.ethAddress).toLowerCase(),
        {
          encryptionPK: publicKeyMsg.encryptionPublicKey,
          kdSalt: publicKeyMsg.randomSeed,
          willUseAddr: publicKeyMsg.willUseAddr
        }
      );
      return new Map(prevPks);
    });
  }
  return Promise.resolve(true);
}

async function handlePKMwithPKEncrypt(payload: Uint8Array, myAddress: string, setter: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>, privateKey: Uint8Array): Promise<boolean> {
  console.log("start handlePKMwithPKEncrypt");

  let offset = 0;
  const blockSize = 256;
  let decryptedBlocks = [];
  while (offset < payload.length) {
    const block = new Uint8Array(payload.slice(offset, offset + blockSize));
    const p = await importPrivateKeyUint8ArrayToCryptoKey(privateKey);
    const decrypted = await decryptWithPrivateKey(p, block);
    decryptedBlocks.push(decrypted);
    offset += blockSize;
  }
  const tot = decryptedBlocks.length*0xb0;
  const decryptedArray = new Uint8Array(tot);
  offset = 0;
  for( const value of decryptedBlocks){
    decryptedArray.set(value, offset);
    offset+=0xb0;
  }
  
  const publicKeyMsg = PublicKeyMessage.decode(decryptedArray);
  if (!publicKeyMsg) return Promise.reject(false);
  if (!publicKeyMsg.ethAddress) return Promise.reject(false);
  if (myAddress && equals(publicKeyMsg.ethAddress, hexToBytes(myAddress)))
    return Promise.reject(false);
  const res = validatePublicKeyMessage(publicKeyMsg);
  console.log("Is Public Key Message valid?", res);

  if (res) {
    setter((prevPks: Map<string, PublicKeyMessageObj>) => {
      prevPks.set(
        '0x'+bytesToHex(publicKeyMsg.ethAddress).toLowerCase(),
        {
          encryptionPK: publicKeyMsg.encryptionPublicKey,
          kdSalt: publicKeyMsg.randomSeed,
          willUseAddr: publicKeyMsg.willUseAddr
        }
      );
      return new Map(prevPks);
    });
  }
  return Promise.resolve(true);
}

async function handleEncryptedMsg(payload: Uint8Array,
  myAddr: string,
  realFromAddr: string,
  salt: Uint8Array,
  privateKey: Uint8Array,
  receiveSessionKeys: Map<string, Uint8Array>,
  setReceiveSessionKeys: Dispatch<SetStateAction<Map<string, Uint8Array>>>): Promise<string>{
    console.log("start handleEncryptedMsg");

    // let offset = 0;
    // const blockSize = 256;
    // let decryptedBlocks = [];
    // while (offset < payload.length) {
    //   const block = new Uint8Array(payload.slice(offset, offset + blockSize));
    //   const p = await importPrivateKeyUint8ArrayToCryptoKey(privateKey);
    //   const decrypted = await decryptWithPrivateKey(p, block);
    //   decryptedBlocks.push(decrypted);
    //   offset += blockSize;
    // }
    // const tot = decryptedBlocks.length*0xb0;
    // const decryptedArray = new Uint8Array(tot);
    // offset = 0;
    // for( const value of decryptedBlocks){
    //   decryptedArray.set(value, offset);
    //   offset+=0xb0;
    // }

    const sessionKey: Uint8Array = new Uint8Array(16);
    
    console.log("LastsessionKeys", receiveSessionKeys.get(realFromAddr));
    if (receiveSessionKeys.has(realFromAddr)){
      const lastSessionKey = receiveSessionKeys.get(realFromAddr);
      if (!lastSessionKey) return Promise.reject("fail");
      sessionKey.set(await generateDeriveKey(bytesToHex(lastSessionKey), bytesToHex(salt)));
    }
    else{
      sessionKey.set(await generateDeriveKey((realFromAddr+myAddr).toLowerCase(), bytesToHex(salt)));
    }
    console.log("NowsessionKey", sessionKey);
    setReceiveSessionKeys((prevSessionKey: Map<string, Uint8Array>) => {
      prevSessionKey.set(
        realFromAddr,
        sessionKey
      );
      return new Map(prevSessionKey);
    });
    const decoder = new TextDecoder();
    const key = await importAESKeyUint8ArrayToCryptoKey(sessionKey);
    const iv = hexToBytes(myAddr.slice(-33, -1));

    /**
     * uncomment if using rsa
     */       
    // const aesDecrypted = await decryptCBC(key, iv, decryptedArray);

    /**
     * uncomment if for test, without rsa could be faster
     */
    console.log("info");
    console.log("receiveSessionKeys", receiveSessionKeys);
    console.log(sessionKey);
    console.log("salt", salt);
    console.log("info");
    const aesDecrypted = await decryptCBC(key, iv, payload);


    console.log("aesDecrypted: ", aesDecrypted);
    const decoded = decoder.decode(aesDecrypted);
    console.log(decoded);

    return Promise.resolve(decoded);
}

async function processBlockNumber(
  blockNum: number,
  myAddr: string,
  provider: Web3Provider,
  privateKey: Uint8Array,
  publicKeys: Map<string, PublicKeyMessageObj>,
  receiveSessionKeys: Map<string, Uint8Array>,
  setReceiveSessionKeys: Dispatch<SetStateAction<Map<string, Uint8Array>>>,
  setMessages: Dispatch<SetStateAction<Message[]>>,
  setPublicKeys: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>): Promise<number>{
  
  const broadCastAddr = keccak256(myAddr).slice(0,42).toLowerCase();
  const block = await provider.getBlock(blockNum);
  console.log('start processing ', blockNum);
  const MAX_CONCURRENT_REQUESTS = 20;
  const semaphore = new Semaphore(MAX_CONCURRENT_REQUESTS);
  await Promise.all(block.transactions.map(async (transactionHash) => {
    await semaphore.acquire();
    try{
      const transaction = await provider.getTransaction(transactionHash);
      if (!transaction)  return Promise.resolve();
      if (!transaction.to) return Promise.resolve();
      if (!transaction.from) return Promise.resolve();
      const fromAddress = transaction.from;
      const toAddress = transaction.to;
      if (transaction.to.toLowerCase() === broadCastAddr.toLowerCase()){
        try{
          const data = transaction.data;
          const keyData = hexToBytes(data.slice(-2))[0];
          const last2bit = keyData&0b11;
          if (last2bit === 0b11 && receiving){
            receiving = false;
            const secret: number[] = [];
            console.log("accept publicKey done");
            console.log(secretMap);
            const keys = Array.from(secretMap.keys());
            const minKey = Math.min(...keys);

            for(let i = minKey; i < secretMap.size; i+=8){
              var oneByte = 0;
              for(let j = i; j < i+8; j++){
                const bit = secretMap.get(j);
                if (bit === undefined){
                  console.log("not key: ", j);
                  return Promise.resolve(-1);
                }
                oneByte += bit<<((j-minKey)%8);
              }
              secret.push(oneByte);
            }
            console.log(secret);
            handlePKMwithNoEncrypt(Uint8Array.from(secret), myAddr, setPublicKeys)
              .then(() => {
                console.log("Successfully decrypt with no encrypt");
              })
              .catch((error) => {
                console.log("Fail to decrypt with no encrypt: ", error);
                handlePKMwithPKEncrypt(Uint8Array.from(secret), myAddr, setPublicKeys, privateKey)
                .then(() => {
                  console.log("Successfully decrypt with privateKey");
                })
                .catch((error) => {
                  console.log("Fail to decrypt with privateKey:", error);
                });
              });
            secretMap.clear();
          }
          if (receiving){
            secretMap.set(transaction.nonce, last2bit&0b1);
            console.log(secretMap);
          }
          if (last2bit === 0b00 && !receiving){
            console.log("start accepting publicKey");
            receiving = true;
            secretMap.clear();
          }
        }
        catch{
          console.log("something err");
        }
      }

      publicKeys.forEach(async (PKMObj, realFromAddr) => {
        if (PKMObj.willUseAddr.toString() === hexToBytes(fromAddress).toString()){
          // console.log(PKMObj);
          console.log('nonce: ', transaction.nonce);
          const keyData = hexToBytes(toAddress.slice(-2))[0];
          const last2bit = keyData&0b11;
          // console.log('last2bit: ', last2bit);
          if (last2bit === 0b11 && mapReceiving.includes(fromAddress)){
            const secret: number[] = [];
            const secretMap = mapSecretMap.get(fromAddress);
            if (secretMap === undefined) return;
            
            console.log("accept privateMessage done");
            console.log(secretMap);
            const keys = Array.from(secretMap.keys());
            const minKey = Math.min(...keys);
            for(let i = minKey; i < minKey+secretMap.size; i+=8){
              var oneByte = 0;
              for(let j = i; j < i+8; j++){
                const bit = secretMap.get(j);
                if (bit === undefined){
                  console.log("not key: ", j);
                  return Promise.resolve(-1);
                }
                oneByte += bit<<((j-minKey)%8);
              }
              secret.push(oneByte);
            }
            console.log(secret);

            const message = await handleEncryptedMsg(Uint8Array.from(secret),
              myAddr,
              realFromAddr,
              PKMObj.kdSalt,
              privateKey,
              receiveSessionKeys,
              setReceiveSessionKeys);
            const timestamp = new Date();
            const msg = fromAddress.substr(0, 4) + "..." + fromAddress.substr(fromAddress.length - 4, 4)+": "+message;
            setMessages((prevMsgs: Message[]) => {
              const copy = prevMsgs.slice();
              copy.push({
                text: msg,
                timestamp: timestamp,
              });
              return copy;
            });
            

            mapSecretMap.get(fromAddress)?.clear();
            mapReceiving = mapReceiving.filter(value => value !== fromAddress);
          }
          if (mapReceiving.includes(fromAddress)){
            const secretMap = mapSecretMap.get(fromAddress);
            if (secretMap === undefined) return;
            secretMap.set(transaction.nonce, last2bit&0b1);
            mapSecretMap.set(fromAddress, secretMap);
            console.log(mapSecretMap);
          }
          if (last2bit === 0b00 && !mapReceiving.includes(fromAddress)){
            console.log("start accepting privateMessage");
            mapReceiving.push(fromAddress);
            const emptyMap: Map<number, number> = new Map();
            mapSecretMap.set(fromAddress, emptyMap);
          }
        }
      });
    }
    catch{
      console.log("something err");
    }
    finally{
      semaphore.release();
    }
  }));
  console.log("block ", blockNum, "done");
  return Promise.resolve(blockNum);
}

export async function handlePublicKeyorPrivateMessage(
  myAddr: string,
  provider: Web3Provider,
  privateKey: Uint8Array,
  publicKeys: Map<string, PublicKeyMessageObj>,
  receiveSessionKeys: Map<string, Uint8Array>,
  setReceiveSessionKeys: Dispatch<SetStateAction<Map<string, Uint8Array>>>,
  setMessages: Dispatch<SetStateAction<Message[]>>,
  setPublicKeys: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>,
  blockNumber: number | undefined) {
  
  if (!blockNumber) return;
  if (!myAddr) return;
  if (!privateKey) return;

    /**
     * below is for test faster
     */
      var a = {};
      var b = {};
      if (myAddr.toLowerCase() === "xxx"){
        const secret: number[] = [];
        for (const key in a) {
          const value: number = a[key as keyof typeof a];
          secret.push(value);
        }
        console.log(secret);
        const encrypted = Uint8Array.from(secret);
        const key = await importAESKeyUint8ArrayToCryptoKey(hexToBytes(myAddr.slice(2, 34)));
        const iv = hexToBytes(myAddr.slice(-33, -1));
        const payload = await decryptCBC(key, iv, encrypted);

        const publicKeyMsg = PublicKeyMessage.decode(payload);
        if (!publicKeyMsg) return;
        if (!publicKeyMsg.ethAddress) return;
        if (myAddr && equals(publicKeyMsg.ethAddress, hexToBytes(myAddr)))
          return;
        const res = validatePublicKeyMessage(publicKeyMsg);
        console.log("Is Public Key Message valid?", res);

        if (res) {
          setPublicKeys((prevPks: Map<string, PublicKeyMessageObj>) => {
            prevPks.set(
              '0x'+bytesToHex(publicKeyMsg.ethAddress).toLowerCase(),
              {
                encryptionPK: publicKeyMsg.encryptionPublicKey,
                kdSalt: publicKeyMsg.randomSeed,
                willUseAddr: publicKeyMsg.willUseAddr
              }
            );
            return new Map(prevPks);
          });
        }
      }
      if (myAddr.toLowerCase() === "xxx"){
        const secret: number[] = [];
        for (const key in b) {
          const value: number = b[key as keyof typeof b];
          secret.push(value);
        }
        const encrypted = Uint8Array.from(secret);
        let offset = 0;
        const blockSize = 256;
        let decryptedBlocks = [];
        while (offset < encrypted.length) {
          const block = new Uint8Array(encrypted.slice(offset, offset + blockSize));
          const p = await importPrivateKeyUint8ArrayToCryptoKey(privateKey);
          const decrypted = await decryptWithPrivateKey(p, block);
          decryptedBlocks.push(decrypted);
          offset += blockSize;
        }
        const tot = decryptedBlocks.length*0xb0;
        const payload = new Uint8Array(tot);
        offset = 0;
        for( const value of decryptedBlocks){
          payload.set(value, offset);
          offset+=0xb0;
        }

        const publicKeyMsg = PublicKeyMessage.decode(payload);
        if (!publicKeyMsg) return;
        if (!publicKeyMsg.ethAddress) return;
        if (myAddr && equals(publicKeyMsg.ethAddress, hexToBytes(myAddr)))
          return;
        const res = validatePublicKeyMessage(publicKeyMsg);
        console.log("Is Public Key Message valid?", res);

        if (res) {
          setPublicKeys((prevPks: Map<string, PublicKeyMessageObj>) => {
            prevPks.set(
              '0x'+bytesToHex(publicKeyMsg.ethAddress).toLowerCase(),
              {
                encryptionPK: publicKeyMsg.encryptionPublicKey,
                kdSalt: publicKeyMsg.randomSeed,
                willUseAddr: publicKeyMsg.willUseAddr
              }
            );
            return new Map(prevPks);
          });
        }
      }

  blockQueue.enqueue(() => processBlockNumber(
    blockNumber,
    myAddr,
    provider,
    privateKey,
    publicKeys,
    receiveSessionKeys,
    setReceiveSessionKeys,
    setMessages,
    setPublicKeys), blockNumber);
}