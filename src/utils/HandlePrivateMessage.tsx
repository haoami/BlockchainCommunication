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
import { decryptCBC, decryptWithPrivateKey, importAESKeyUint8ArrayToCryptoKey, importPrivateKeyUint8ArrayToCryptoKey, importPublicKeyUint8ArrayToCryptoKey, validatePublicKeyMessage } from "../wakuCrypto";
import { AddRounded } from "@material-ui/icons";

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
var flag: string[] = [];
var myPrivateKey: Uint8Array = new Uint8Array(0);

const blockQueue = new AsyncQueue();

export async function handlePrivateMessage(
  myAddr: string,
  provider: Web3Provider,
  privateKey: Uint8Array,
  setter: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>,
  blockNumber: number | undefined) {
  
  if (!blockNumber) return;
  if (!myAddr) return;
  if (!privateKey) return;
  if (!myPrivateKey)
    myPrivateKey = new Uint8Array(myPrivateKey);

//   blockQueue.enqueue(() => processBlockNumber(blockNumber, provider, setter, myAddr, broadCastAddr, privateKey), blockNumber);
}