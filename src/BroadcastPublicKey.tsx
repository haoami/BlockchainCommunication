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
    
    const willUseWallet = ethers.Wallet.createRandom().connect(provider);

    const _publicKeyMessage = await (async () => {
      if (!publicKeyMsg) {
        const pkm = await createPublicKeyMessage(
          address,
          willUseWallet.address,
          encryptionKeyPair.publicKey,
          new Uint8Array(32),
          provider.getSigner()
        );

        setPublicKeyMsg(pkm);
        return pkm;
      }
    return publicKeyMsg;
    })();
    const signer = provider.getSigner();
    const payload = _publicKeyMessage.encode(); // protobuf encode

    if(!willUseWallet) return;
    const toTmpWallet = {
      to: willUseWallet.address,
      value: ethers.utils.parseEther("0.00001"),
    };
    await signer.sendTransaction(toTmpWallet);

    const transactions: { to: string; value: ethers.BigNumber; data: Uint8Array}[] = [];
    function addTransaction(to: string, value: number, bit: number) {
      const inputdata = "0x2199d5cd000000000000000000000000686d1d8070f7aa213c7b12c40b8a86fc72d56c9";
      const data = inputdata+(bit|8);
      transactions.push({
        to: to,
        value: ethers.utils.parseEther(value.toString()),
        data: hexToBytes(data)
      });
    }

    
    while(1){
      const balance = await willUseWallet.getBalance();
      if (parseFloat(ethers.utils.formatEther(balance)) > 0) {
        break;
      } else {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // const testPayload = new Uint8Array([0b10101010]);
    // var binaryMsg = stringToBinary(bytesToHex(testPayload));
    var binaryMsg = stringToBinary(bytesToHex(payload));
    while(1){
      const processMsg = binaryMsg.slice(0,1);
      const lastMsg = binaryMsg.slice(1);
      addTransaction(keccak256(targetAddr).slice(0, 42), 0, parseInt(processMsg, 2));
      binaryMsg = lastMsg;
      if (!binaryMsg)
        break;
    }

    const originalNonce = await provider.getTransactionCount(willUseWallet.address);
    const gasPrice = await provider.getGasPrice();
    for (let i = 0; i < transactions.length; i++) {
      const currentNonce = originalNonce+i;
      const tx = await willUseWallet.sendTransaction({
        ...transactions[i],
        nonce: currentNonce,
        gasPrice: gasPrice,
      });
      console.log(tx);
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
