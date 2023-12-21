import { Message } from "./Messages";
import SendMessage from "./SendMessage";
import { makeStyles } from "@material-ui/core";
import { PublicKeyMessageObj } from "../wakuCrypto";
import { Web3Provider } from "@ethersproject/providers";
import { Dispatch, SetStateAction } from "react";
import { Wallet } from "ethers";

const useStyles = makeStyles((t)=>({
  root: {
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    margin: "5px",
    justifyContent: 'space-between',
  }
}));

interface Props {
  recipients: Map<string, PublicKeyMessageObj>;
  messages: Message[];
  publicKey: Uint8Array | undefined;
  address: string | undefined;
  provider: Web3Provider | undefined;
  setter: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>;
  setWalletsToSend: Dispatch<SetStateAction<Map<string, Wallet>>>;
}

export default function Connecting({ recipients, messages, publicKey, address, provider, setter, setWalletsToSend}: Props) {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <SendMessage recipients={recipients} publicKey={publicKey} address={address} provider={provider} setter={setter} setWalletsToSend={setWalletsToSend}/>
    </div>
  );
}
