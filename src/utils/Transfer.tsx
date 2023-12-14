import type { RelayNode } from "@waku/interfaces";
import {
    FormControl,
    makeStyles,
    Select,
    MenuItem,
    Button,
    InputLabel,
    TextField
} from "@material-ui/core";
import { PublicKeyMessageObj } from "../waku";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { sign } from "crypto";
import {ChangeEvent, useState, KeyboardEvent } from "react";
import { Web3Provider } from "@ethersproject/providers"
import { BigNumber, ethers } from "ethers";
import { stringToBinary, binaryToString } from "./GetBlockInfo";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";
import { keccak256 } from "ethers/lib/utils";


const useStyles = makeStyles((theme)=>({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  button: {
    margin: theme.spacing(1),
    minWidth: 120,
    minHeight: 50,
  }
}));

interface Props {
  recipients: Map<string, PublicKeyMessageObj>;
  provider: Web3Provider | undefined;
}

export default function Transfer({ recipients, provider}: Props) {
  const classes = useStyles();
  const [message, setMessage] = useState<string>();
  const [recipient, setRecipient] = useState<string>("");

  const items = Array.from(recipients.keys()).map((recipient) => {
    return (
      <MenuItem key={recipient} value={recipient}>
        {recipient}
      </MenuItem>
    );
  });

  const handleRecipientChange = (
    event: ChangeEvent<{ name?: string; value: unknown }>
  ) => {
    setRecipient(event.target.value as string);
  };

  const handleMessageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setMessage(event.target.value);
  };

  const keyDownHandler = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === "Enter" &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.shiftKey
    ) {
      if (!recipient) return;
      if (!message) return;

      sendMsg();
    }
  };

  const testButton = async () => {
    // if (!provider) return;
    // if (!message) return;
    // const testPayload = new Uint8Array([0x1a]);
    // console.log(keccak256("0x2B9f9B521B160184E5B747538698D43071209796"));
  //   const toTmpWallet = {
  //     to: "0x2B9f9B521B160184E5B747538698D43071209796",
  //     value: ethers.utils.parseEther("0"),
  //     data: hexToBytes("2199d5cd000000000000000000000000686d1d8070f7aa213c7b12c40b8a86fc72d56c99")
  // };
  //   await provider?.getSigner().sendTransaction(toTmpWallet);
  }

  const sendMsg = async () => {
    if (!provider) return;
    if (!message) return;
    const transactions: { to: string; value: ethers.BigNumber;}[] = [];

    function addTransaction(to: string, value: number) {
      transactions.push({
        to: to,
        value: ethers.utils.parseEther(value.toString())
      });
    }

    try{
      const tmpWalletConnected = ethers.Wallet.createRandom().connect(provider);
      console.log(tmpWalletConnected.privateKey);
      console.log(tmpWalletConnected.address);
      const signer = provider.getSigner();
      const toTmpWallet = {
        to: tmpWalletConnected.address,
        value: ethers.utils.parseEther("0.00015"),
      };
      await signer.sendTransaction(toTmpWallet);
      
      while(1){
        const balance = await tmpWalletConnected.getBalance();
        if (parseFloat(ethers.utils.formatEther(balance)) > 0) {
          break;
        } else {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      var binaryMsg = stringToBinary(message);
      // while(1){
      //   const processMsg = binaryMsg.slice(0,2);
      //   const lastMsg = binaryMsg.slice(2);
        
      //   while(1){
      //     const addrWallet = ethers.Wallet.createRandom().connect(provider);
      //     const comAddr = parseInt(addrWallet.address.slice(-1), 16)&0b11;
      //     if(comAddr === ){
      //       break;
      //     }
      //   }

      //   addTransaction(addrMap.get(parseInt(processMsg, 2)), 0);

      //   binaryMsg = lastMsg;
      //   if (!binaryMsg)
      //     break;
      // }

      const originalNonce = await provider.getTransactionCount(tmpWalletConnected.address);
      const gasPrice = await provider.getGasPrice();
      for (let i = 0; i < transactions.length; i++) {
        const currentNonce = originalNonce+i;
        const tx = await tmpWalletConnected.sendTransaction({
          ...transactions[i],
          nonce: currentNonce,
          gasPrice: gasPrice
        });
        console.log(tx);
      }


    }
    catch{
      console.log("something err");
      return;
    }
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      }}>
      <FormControl className={classes.formControl}>
        <InputLabel id="select-recipient-label">Recipient</InputLabel>
        <Select
          labelId="select-recipient"
          id="select-recipient"
          value={recipient}
          onChange={handleRecipientChange}
        >
          {items}
        </Select>
      </FormControl>
      <TextField
        id="message-input"
        label="Message"
        variant="filled"
        onChange={handleMessageChange}
        onKeyDown={keyDownHandler}
        value={message}
        disabled={!recipient}
      />
      <Button className={classes.button}
        variant="contained"
        color="primary"
        onClick={testButton}
        // disabled={!recipient}
        >
        testbutton
      </Button>

    </div>
  );
}