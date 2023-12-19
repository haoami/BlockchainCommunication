import { Button, TextField } from "@material-ui/core";
import React, { useState, ChangeEvent, Dispatch, SetStateAction } from "react";
import {
  createPublicKeyMessage,
  encryptCBC,
  importAESKeyUint8ArrayToCryptoKey,
  KeyPair,
  sendMultiTransacationsWithData,
} from "./wakuCrypto";
import { PublicKeyMessage } from "./messaging/wire";
import { Wallet, ethers } from "ethers"
import { isAddress } from "ethers/lib/utils";
import { Web3Provider } from "@ethersproject/providers";
import { keccak256 } from "ethers/lib/utils";
import { hexToBytes } from "@waku/utils/bytes";

interface Props {
  encryptionKeyPair: KeyPair | undefined;
  address: string | undefined;
  provider: Web3Provider | undefined;
  setter: Dispatch<SetStateAction<Map<string, Wallet>>>;
}

export default function BroadcastPublicKey({
  encryptionKeyPair,
  address,
  provider,
  setter,
}: Props) {
  const [publicKeyMsg, setPublicKeyMsg] = useState<PublicKeyMessage>();
  const [targetAddr, setTargetAddr] = useState<string>();

  const handleMessageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTargetAddr(event.target.value);
  };
  
  const broadcastPublicKey = async () => {
    
    if (!encryptionKeyPair) return;
    if (!address) return;
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
      setter((prevWalletToSend: Map<string, Wallet>) => {
        prevWalletToSend.set(
          targetAddr,
          willUseWallet
        );
        return new Map(prevWalletToSend);
      });
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
      const encoded = _publicKeyMessage.encode(); // protobuf encode
      const key = await importAESKeyUint8ArrayToCryptoKey(hexToBytes(targetAddr.slice(2, 34)));
      const iv = hexToBytes(targetAddr.slice(-33, -1));
      const payload = await encryptCBC(key, iv, encoded);
      console.log(payload);

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

      sendMultiTransacationsWithData(provider, willUseWallet, transactions);
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
          disabled={!encryptionKeyPair || !address || !provider}
        />
      <Button
        variant="contained"
        color="primary"
        onClick={broadcastPublicKey}
        disabled={!encryptionKeyPair || !address || !provider || !targetAddr}
      >
        Broadcast Encryption Public Key
      </Button>
    </div>
  );
}
