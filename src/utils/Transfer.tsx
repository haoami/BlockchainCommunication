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
import { ethers } from "ethers";

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

  const sendEth = async () => {
    if (!provider) return;

    try{
      const bnum = await provider.getBlockNumber();
      const balance = await provider.getBalance("ethers.eth");
      const signer = provider.getSigner()
      console.log(bnum);
      console.log(balance);
      console.log(ethers.utils.formatEther(balance));
          
      const tx = await signer.sendTransaction({
        to: recipient,
        value: ethers.utils.parseEther("0.0001")
      });
      // export type TransactionRequest = {
      //   to?: string,
      //   from?: string,
      //   nonce?: BigNumberish,
    
      //   gasLimit?: BigNumberish,
      //   gasPrice?: BigNumberish,
    
      //   data?: BytesLike,
      //   value?: BigNumberish,
      //   chainId?: number
    
      //   type?: number;
      //   accessList?: AccessListish;
    
      //   maxPriorityFeePerGas?: BigNumberish;
      //   maxFeePerGas?: BigNumberish;
    
      //   customData?: Record<string, any>;
      //   ccipReadEnabled?: boolean;
      // }
      console.log(tx);
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
      <Button className={classes.button}
        
        variant="contained"
        color="primary"
        onClick={sendEth}
        disabled={!recipient}
        >
        send
      </Button>

    </div>
  );
}
