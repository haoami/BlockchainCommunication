import { Button } from "@material-ui/core";
import React from "react";
import { ethers } from "ethers";
import { Web3Provider } from "@ethersproject/providers/src.ts/web3-provider";
import { keccak256 } from "ethers/lib/utils";

declare let window: any;

interface Props {
  setAddress: (address: string) => void;
  setProvider: (provider: Web3Provider) => void;
  setbroadCastAddress: (broadCastAddress: string) => void;
}

export default function ConnectWallet({ setAddress, setProvider, setbroadCastAddress }: Props) {
  const connectWallet = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAddress(accounts[0]);
      setbroadCastAddress(keccak256(accounts[0]).slice(0,42));
      setProvider(provider);
    } catch (e) {
      console.error("No web3 provider available", e);
    }
  };

  return (
    <Button variant="contained" color="primary" onClick={connectWallet}>
      Connect Wallet
    </Button>
  );
}
