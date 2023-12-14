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
import {ChangeEvent, useState} from "react";
import { Web3Provider } from "@ethersproject/providers";
import { Block, TransactionResponse } from "@ethersproject/abstract-provider";

export function GetBlockInfo(provider: Web3Provider | undefined, blockNumber: number | undefined) {
  if (!provider) return;
  if (!blockNumber) return;
  provider.getBlock(blockNumber)
    .then((result: Block) => {
      result.transactions.forEach((transactionHash) => {
        provider.getTransaction(transactionHash)
        .then(async (detail: TransactionResponse) => {
          if (detail.from === await provider.getSigner().getAddress()
            || detail.to === await provider.getSigner().getAddress())
            console.log(transactionHash + "\nfrom: " + detail.from + "\nto: "+detail.to+"\n");
        })
        .catch((error) => {
          console.log("err getting transaction: ", error);
        })
      })
    })
    .catch((error) => {
      console.log("err getting block: ", error);
    })
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