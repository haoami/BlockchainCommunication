import {
  FormControl,
  InputLabel,
  makeStyles,
  MenuItem,
  Select,
  TextField,
} from "@material-ui/core";
import React, { ChangeEvent, Dispatch, KeyboardEvent, SetStateAction, useState } from "react";
import type { RelayNode } from "@waku/interfaces";
import { createEncoder } from "@waku/message-encryption/ecies";
import { PrivateMessage } from "./wire";
import { PublicKeyMessageObj, PrivateMessageContentTopic, PrivateMessageContentTopicPwd } from "../waku";
import { hexToBytes, bytesToHex } from "@waku/utils/bytes";
import {generateDeriveKey} from "../wakuCrypto";
import ReplyPublicKey from "./ReplyPublicKey"
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { Web3Provider } from "@ethersproject/providers";


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
}

export default function SendMessage({ recipients, publicKey, address, provider, setter }: Props) {
  const classes = useStyles();
  const [recipient, setRecipient] = useState<string>("");
  // const [message, setMessage] = useState<string>();

  const handleRecipientChange = (
    event: ChangeEvent<{ name?: string; value: unknown }>
  ) => {
    setRecipient(event.target.value as string);
  };

  // const handleMessageChange = (event: ChangeEvent<HTMLInputElement>) => {
  //   setMessage(event.target.value);
  // };

  const items = Array.from(recipients.keys()).map((recipient) => {
    return (
      <MenuItem key={recipient} value={recipient}>
        {recipient}
      </MenuItem>
    );
  });

  // const keyDownHandler = async (event: KeyboardEvent<HTMLInputElement>) => {
  //   if (
  //     event.key === "Enter" &&
  //     !event.altKey &&
  //     !event.ctrlKey &&
  //     !event.shiftKey
  //   ) {
  //     if (!waku) return;
  //     if (!recipient) return;
  //     if (!message) return;
  //     const publicKey = recipients.get(recipient)?.encryptionPK;
  //     const salt = recipients.get(recipient)?.kdSalt;
  //     if (!publicKey) return;
  //     if (!salt) return;

  //     // 按下回车键发送消息
  //     sendMessage(waku, recipient, publicKey, salt, message, (res) => {
  //       if (res) {
  //         console.log("callback called with", res);
  //         setMessage("");
  //       }
  //     });
  //   }
  // };

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
      />
      {/* <TextField
        id="message-input"
        label="Message"
        variant="filled"
        onChange={handleMessageChange}
        onKeyDown={keyDownHandler}
        value={message}
        disabled={!recipients.get(recipient)?.kdSalt}
      /> */}
    </div>
  );
}

async function sendMessage(
  waku: RelayNode,
  recipientAddress: string,
  recipientPublicKey: Uint8Array,
  salt: Uint8Array,
  message: string,
  callback: (res: boolean) => void
) {
  const privateMessage = new PrivateMessage({
    toAddress: hexToBytes(recipientAddress),
    message: message,
  });
  const payload = privateMessage.encode();


  const encoder = createEncoder({
    contentTopic: PrivateMessageContentTopic,
    publicKey: recipientPublicKey,
    ephemeral: true,
  });
  // TODO: use key derive!
  // ######################################################
  try {
    const password = bytesToHex(recipientPublicKey);
    const derivedKey = await generateDeriveKey(password, bytesToHex(salt));
    console.log('Derived Key:', derivedKey);
    const encoder = createEncoder({
      contentTopic: PrivateMessageContentTopic,
      publicKey: derivedKey,
      ephemeral: true,
    });
    // ######################################################
  
    console.log("pushing");
    const res = await waku.relay.send(encoder, { payload });
    console.log("Message sent", res);
    callback(Boolean(res.recipients.length));
  } catch (error) {
    console.error('Error generating derived key:', error);
  }
}
