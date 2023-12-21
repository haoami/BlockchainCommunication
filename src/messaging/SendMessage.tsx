import {
  FormControl,
  InputLabel,
  makeStyles,
  MenuItem,
  Select,
} from "@material-ui/core";
import React, { ChangeEvent, Dispatch, KeyboardEvent, SetStateAction, useState } from "react";
import { PublicKeyMessageObj } from "../wakuCrypto";
import ReplyPublicKey from "./ReplyPublicKey"
import { Web3Provider } from "@ethersproject/providers";
import { Wallet } from "ethers";


const useStyles = makeStyles((theme) => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
}));

export interface Props {
  // address, public key, randoms seed
  recipients: Map<string, PublicKeyMessageObj>;
  publicKey: Uint8Array | undefined;
  address: string | undefined;
  provider: Web3Provider | undefined;
  setter: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>;
  setWalletsToSend: Dispatch<SetStateAction<Map<string, Wallet>>>;
}

export default function SendMessage({ recipients, publicKey, address, provider, setter, setWalletsToSend }: Props) {
  const classes = useStyles();
  const [recipient, setRecipient] = useState<string>("");

  const handleRecipientChange = (
    event: ChangeEvent<{ name?: string; value: unknown }>
  ) => {
    setRecipient(event.target.value as string);
  };

  const items = Array.from(recipients.keys()).map((recipient) => {
    return (
      <MenuItem key={recipient} value={recipient}>
        {recipient}
      </MenuItem>
    );
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
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
      <ReplyPublicKey
        myAddr={address}
        targetAddr={recipient}
        selectedRecipients={recipients.get(recipient)}
        selfPublicKey={publicKey}
        provider={provider}
        setter={setter}
        setWalletsToSend={setWalletsToSend}
      />
    </div>
  );
}