import React, {Dispatch, SetStateAction, useState} from "react";
import { Button } from "@material-ui/core";
import { PublicKeyMessageObj } from "../waku";
import { PublicKeyMessage } from "./wire";
import {
  createPublicKeyMessage,
  encryptWithPublicKey,
  genRandomBytes,
  importPublicKeyUint8ArrayToCryptoKey,
  KeyPair,
} from "../wakuCrypto";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { PrivateMessageContentTopic } from "../waku"
import { createEncoder } from "@waku/message-encryption/ecies";
import type { RelayNode } from "@waku/interfaces";
import {ethers} from "ethers";
import { Web3Provider } from "@ethersproject/providers";
import { keccak256 } from "ethers/lib/utils";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";


export interface Props {
  myAddr: string | undefined;
  targetAddr: string | undefined;
  selectedRecipients: PublicKeyMessageObj | undefined;
  selfPublicKey: Uint8Array | undefined;
  provider: Web3Provider | undefined;
  setter: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>;
}

export default function ReplyPublicKey({ myAddr, targetAddr, selectedRecipients, selfPublicKey, provider, setter}: Props) {
  const replyPKM = async () => {
    if (!myAddr) return;
    if (!targetAddr) return;
    if (!selectedRecipients) return;
    if (!selfPublicKey) return;
    if (!provider) return;

    const transactions: { to: string; value: ethers.BigNumber; data: Uint8Array}[] = [];
    function addTransaction(to: string, value: number, bit: number, flag: number=-1) {
      // flag: 0=>start=> 00; 1=>end=>11; else _
      const inputdata = "0x2199d5cd000000000000000000000000686d1d8070f7aa213c7b12c40b8a86fc72d56c9";
      var data;
      if (flag === 0){
        data = inputdata+'8';
      }
      else if (flag === 1){
        data = inputdata+'b';
      }
      else{
        data = inputdata+(bit|8);
        // cnt+=1;
      }
      console.log(data);
      transactions.push({
        to: to,
        value: ethers.utils.parseEther(value.toString()),
        data: hexToBytes(data)
      });
    }

    try{
      const kdSalt = genRandomBytes(32);
      setter((prevPks: Map<string, PublicKeyMessageObj>) => {
        prevPks.set(
          targetAddr.toLowerCase(),
          {
            encryptionPK: selectedRecipients.encryptionPK,
            kdSalt: kdSalt,
            willUseAddr: selectedRecipients.willUseAddr
          }
        );
        return new Map(prevPks);
      });
      const willUseWallet = ethers.Wallet.createRandom().connect(provider);
      const signer = provider.getSigner();
      const _replyPublicKeyMessage = await (async () => {
          const pkm = await createPublicKeyMessage(
            myAddr,
            willUseWallet.address.toLowerCase(),
            selfPublicKey,
            kdSalt,
            signer
          );
          return pkm;
      })();
      
      const publicKey = await importPublicKeyUint8ArrayToCryptoKey(selectedRecipients.encryptionPK);

      const blockSize = 0xb0;
      const encryptedBlocks = [];
      const plaintext = _replyPublicKeyMessage.encode();

      for (let i = 0; i < plaintext.length; i += blockSize) {
        const block = plaintext.slice(i, i + blockSize);
        const encryptedBlock = await encryptWithPublicKey(publicKey, block);
        encryptedBlocks.push(new Uint8Array(encryptedBlock));
      }

      console.log(encryptedBlocks);
      
      let totalLength = 0;
      encryptedBlocks.forEach(currentArray => {
        totalLength += currentArray.length;
      });
      let payload = new Uint8Array(totalLength);

      let offset = 0;
      encryptedBlocks.forEach(currentArray => {
        payload.set(currentArray, offset);
        offset += currentArray.length;
      });
      console.log("concated blocks: ", payload);

      const toTmpWallet = {
        to: willUseWallet.address,
        value: ethers.utils.parseEther("0.00015"),
      };
      await signer.sendTransaction(toTmpWallet);
      while(1){
        const balance = await willUseWallet.getBalance();
        if (parseFloat(ethers.utils.formatEther(balance)) > 0) {
          break;
        } else {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const realTargetAddr = keccak256(targetAddr).slice(0,42);
      addTransaction(realTargetAddr, 0, 0, 0);
      for(let i = 0; i < payload.length; i++){
        var bytes = payload[i];
        for(let j = 0; j < 8; j++){
          const bit = bytes&0b1;
          addTransaction(realTargetAddr, 0, bit);
          bytes=(bytes>>1);
        }
      }
      addTransaction(realTargetAddr, 0, 0, 1);

      const originalNonce = await provider.getTransactionCount(willUseWallet.address);
      const gasPrice = await provider.getGasPrice();
      const tx = await willUseWallet.sendTransaction({
          ...transactions[0],
          nonce: originalNonce,
          gasPrice: gasPrice,
        });
      console.log(tx);
      const res = await tx.wait();
      console.log("transaction[0]: ", res);
      for (let i = 1; i < transactions.length-1; i++) {
        const currentNonce = originalNonce+i;
        const tx = await willUseWallet.sendTransaction({
          ...transactions[i],
          nonce: currentNonce,
          gasPrice: gasPrice,
        });
        console.log(tx);
        if (i === transactions.length-2){
          const res = await tx.wait();
          console.log("transaction[-2]: ", res);
          const lastTx = await willUseWallet.sendTransaction({
            ...transactions[i+1],
            nonce: currentNonce+1,
            gasPrice: gasPrice,
          });
          console.log(lastTx);
        }
      }
    }
    catch{
      console.log("something err");
    }
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={replyPKM}
      disabled={!selfPublicKey}
      >
      CONNECT ESTABLISHMENT
    </Button>
  );
}