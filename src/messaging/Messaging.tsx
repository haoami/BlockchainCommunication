import Messages, { Message } from "./Messages";
import type { RelayNode } from "@waku/interfaces";
import SendMessage from "./SendMessage";
import { makeStyles } from "@material-ui/core";
import { PublicKeyMessageObj } from "../waku";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { sign } from "crypto";

const useStyles = makeStyles((t)=>({
  root: {
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    margin: "5px",
    justifyContent: 'space-between', // 或者使用 'space-around'，具体根据需要选择
    height: '100%',
  }
  // root: {
  //   display: 'flex',
  //   flexDirection: 'column',
  //   alignItems: 'center', // 居中对齐
  // }
}));

interface Props {
  waku: RelayNode | undefined;
  recipients: Map<string, PublicKeyMessageObj>;
  messages: Message[];
  publicKey: Uint8Array | undefined;
  address: string | undefined;
  signer: TypedDataSigner | undefined;
}

export default function Messaging({ waku, recipients, messages, publicKey, address, signer}: Props) {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <SendMessage recipients={recipients} waku={waku} publicKey={publicKey} address={address} signer={signer} />
      <Messages messages={messages} />
    </div>
  );
}
