import { Message } from "./Messages";
import type { RelayNode } from "@waku/interfaces";
import SendMessage from "./SendMessage";
import { makeStyles } from "@material-ui/core";
import { PublicKeyMessageObj } from "../waku";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { sign } from "crypto";
import { Web3Provider } from "@ethersproject/providers";
import { Dispatch, SetStateAction } from "react";

const useStyles = makeStyles((t)=>({
  root: {
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    margin: "5px",
    justifyContent: 'space-between', // 或者使用 'space-around'，具体根据需要选择
    height: '100%',
  }
}));

interface Props {
  recipients: Map<string, PublicKeyMessageObj>;
  messages: Message[];
  publicKey: Uint8Array | undefined;
  address: string | undefined;
  provider: Web3Provider | undefined;
  setter: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>;
}

export default function Messaging({ recipients, messages, publicKey, address, provider, setter}: Props) {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <SendMessage recipients={recipients} publicKey={publicKey} address={address} provider={provider} setter={setter} />
      {/* <Messages messages={messages} /> */}
    </div>
  );
}
