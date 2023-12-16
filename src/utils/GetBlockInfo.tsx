import type { RelayNode } from "@waku/interfaces";
import {
    FormControl,
    makeStyles,
    Select,
    MenuItem,
    Button,
    InputLabel
} from "@material-ui/core";
import { PublicKeyMessageObj } from "../waku";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { sign } from "crypto";
import {ChangeEvent, useState, Dispatch, SetStateAction} from "react";
import { Web3Provider } from "@ethersproject/providers";
import { Block, TransactionResponse } from "@ethersproject/abstract-provider";
import { keccak256 } from "ethers/lib/utils";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";
import { PublicKeyMessage } from "../messaging/wire";
import { equals } from "uint8arrays/equals";
import { validatePublicKeyMessage } from "../wakuCrypto";

class AsyncQueue {
  private queue: { task: () => Promise<number>; blockNum: number }[] = [];
  private processing = false;

  constructor() {}

  enqueue(task: () => Promise<number>, blockNum: number) {
    this.queue.push({ task, blockNum });
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing) {
      return;
    }
    this.processing = true;

    this.queue.sort((a, b) => a.blockNum - b.blockNum);
    while (this.queue.length > 0) {
      const { task } = this.queue.shift()!;
      await task();
    }
    this.processing = false;
  }
}



var receiving = false;
var secretMap: Map<number, number> = new Map();

const blockQueue = new AsyncQueue();
const transactionsQueue = new AsyncQueue();

async function dealWithPKM(payload: Uint8Array, myAddress: string, setter: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>) {
  console.log("start dealWithPKM");
  console.log(payload);
  const publicKeyMsg = PublicKeyMessage.decode(payload);
  if (!publicKeyMsg) return;
  if (!publicKeyMsg.ethAddress) return;
  if (myAddress && equals(publicKeyMsg.ethAddress, hexToBytes(myAddress)))
    return;
  const res = validatePublicKeyMessage(publicKeyMsg);
  console.log("Is Public Key Message valid?", res);

  if (res) {
    setter((prevPks: Map<string, PublicKeyMessageObj>) => {
      prevPks.set(
        bytesToHex(publicKeyMsg.ethAddress),
        {
          encryptionPK: publicKeyMsg.encryptionPublicKey,
          kdSalt: publicKeyMsg.randomSeed          
        }
      );
      return new Map(prevPks);
    });
  }
}

async function processBlockNumber(blockNum: number, provider: Web3Provider,
  setter: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>, myAddr: string, broadCastAddr: string): Promise<number>{
  
  const block = await provider.getBlock(blockNum);
  // console.log('start processing ', blockNum);
  for (const transactionHash of block.transactions){
    const transaction = await provider.getTransaction(transactionHash);
    if (!transaction)  continue;
    if (!transaction.to) continue;
    if (transaction.to.toLowerCase() === broadCastAddr.toLowerCase()){
      try{
        console.log('nonce: ', transaction.nonce);
        const data = transaction.data;
        const keyData = hexToBytes(data.slice(-2))[0];
        const last2bit = keyData&0b11;
        if (last2bit === 0b11 && receiving){
          receiving = false;
          const secret: number[] = [];
          console.log("accept down");
          console.log(secretMap);
          for(let i = 1; i <= secretMap.size; i+=8){
            var oneByte = 0;
            for(let j = i; j < i+8; j++){
              const bit = secretMap.get(j);
              if (bit === undefined){
                console.log("not key: ", j);
                return Promise.resolve(-1);
              }
              oneByte += bit<<((j-1)%8);
            }
            secret.push(oneByte);
          }
          console.log(secret);
          dealWithPKM(Uint8Array.from(secret), myAddr, setter);
          secretMap.clear();
        }
        if (receiving){
          secretMap.set(transaction.nonce, last2bit&0b1);
          console.log(secretMap);
        }
        if (last2bit === 0b00 && !receiving){
          console.log("start accepting");
          receiving = true;
          secretMap.clear();
        }
      }
      catch{
        console.log("something err");
      }
      // transactionsQueue.enqueue(() => processTransaction(transaction.nonce, transaction.data,setter, myAddr));
    }
  }
  // console.log("block ", blockNum, "down");
  return Promise.resolve(blockNum);
}

export async function processBlock(myAddr: string, broadCastAddr: string,
  provider: Web3Provider, setter: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>, blockNumber: number | undefined) {
  if (!blockNumber) return;
  if (!myAddr) return;
  if (!broadCastAddr) return;
  blockQueue.enqueue(() => processBlockNumber(blockNumber, provider, setter, myAddr, broadCastAddr), blockNumber);
}


export function stringToBinary(str: string): string {
  let binary = '';
  for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i).toString(2);
      binary += '00000000'.slice(charCode.length) + charCode;
  }
  return binary;
}

export function binaryToString(binary: string): string {
  let str = '';
  for (let i = 0; i < binary.length; i += 8) {
    const byte = binary.slice(i, i + 8);
    str += String.fromCharCode(parseInt(byte, 2));
  }
  return str;
}