import { Button, TextField } from "@material-ui/core";
import React, { useState, ChangeEvent } from "react";
import {
  createPublicKeyMessage,
  genRandomBytes,
  KeyPair,
  PublicKeyMessageEncryptionKey,
} from "./wakuCrypto";
import { PublicKeyMessage } from "./messaging/wire";
import type { RelayNode } from "@waku/interfaces";
import { createEncoder } from "@waku/message-encryption/symmetric";
import type { TypedDataSigner } from "@ethersproject/abstract-signer";
import { Wallet, ethers } from "ethers"
import { isAddress } from "ethers/lib/utils";
import { Web3Provider } from "@ethersproject/providers";
import { stringToBinary } from "./utils/GetBlockInfo"
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";
import { keccak256 } from "ethers/lib/utils";

interface Props {
  encryptionKeyPair: KeyPair | undefined;
  waku: RelayNode | undefined;
  address: string | undefined;
  provider: Web3Provider | undefined;
}

// var cnt = 0;

export default function BroadcastPublicKey({
  encryptionKeyPair,
  waku,
  address,
  provider,
}: Props) {
  const [publicKeyMsg, setPublicKeyMsg] = useState<PublicKeyMessage>();
  const [targetAddr, setTargetAddr] = useState<string>();

  const handleMessageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTargetAddr(event.target.value);
  };
  
  const broadcastPublicKey = async () => {
    
    if (!encryptionKeyPair) return;
    if (!address) return;
    if (!waku) return;
    if (!provider) return;
    if (!targetAddr) return;
    if (!isAddress(targetAddr)) return;
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

      const willUseWallet = ethers.Wallet.createRandom().connect(provider);
      const signer = provider.getSigner();
      const _publicKeyMessage = await (async () => {
        if (!publicKeyMsg) {
          const pkm = await createPublicKeyMessage(
            address,
            willUseWallet.address.toLowerCase(),
            encryptionKeyPair.publicKey,
            new Uint8Array(32),
            signer
          );

          setPublicKeyMsg(pkm);
          return pkm;
        }
      return publicKeyMsg;
      })();
      const payload = _publicKeyMessage.encode(); // protobuf encode
      // const payload = new Uint8Array([0x41, 0x42, 0x43, 0x44]);
      console.log(payload);
      console.log(bytesToHex(payload));

      if(!willUseWallet) return;
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

      const realTargetAddr = keccak256(targetAddr).slice(0, 42);
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
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      }}>
      <TextField
          id="address-input"
          label="TARGET ADDR"
          variant="filled"
          onChange={handleMessageChange}
          value={targetAddr}
          disabled={!encryptionKeyPair || !waku || !address || !provider}
        />
      <Button
        variant="contained"
        color="primary"
        onClick={broadcastPublicKey}
        disabled={!encryptionKeyPair || !waku || !address || !provider || !targetAddr}
      >
        Broadcast Encryption Public Key
      </Button>
    </div>
  );
}
