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

  const sendMsg = async () => {
    if (!provider) return;
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
      
      var loopFlag = true;
      while(loopFlag){
        const balance = await tmpWalletConnected.getBalance();
        if (parseFloat(ethers.utils.formatEther(balance)) > 0) {
          loopFlag = false;
        } else {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      addTransaction(recipient, 0);
      addTransaction(recipient, 0);
      addTransaction(recipient, 0);
      addTransaction(recipient, 0);
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
        onClick={sendMsg}
        disabled={!recipient}
        >
        send
      </Button>

    </div>
  );
}