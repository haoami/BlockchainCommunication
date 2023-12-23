import "@ethersproject/shims";

import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import { KeyPair } from "./wakuCrypto";
import Messages, { Message } from "./messaging/Messages";
import "fontsource-roboto";
import { AppBar, Button, IconButton, Toolbar, Typography } from "@material-ui/core";
import KeyPairHandling from "./key_pair_handling/KeyPairHandling";
import {
  createMuiTheme,
  ThemeProvider,
  makeStyles,
} from "@material-ui/core/styles";
import { teal, purple, green } from "@material-ui/core/colors";
import WifiIcon from "@material-ui/icons/Wifi";
import BroadcastPublicKey from "./BroadcastPublicKey";
import Connecting from "./messaging/Connecting";
import { Web3Provider } from "@ethersproject/providers/src.ts/web3-provider";
import ConnectWallet from "./ConnectWallet";
import {PublicKeyMessageObj} from "./wakuCrypto";
import SendPrivateMessage from "./utils/SendPrivateMessage";
import { handlePublicKeyorPrivateMessage } from "./utils/HandlePublicKeyMessage"
import { Wallet } from "ethers";


const theme = createMuiTheme({
  palette: {
    primary: {
      main: purple[500],
    },
    secondary: {
      main: teal[600],
    },
  },
});

const useStyles = makeStyles({
  root: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  },
  appBar: {
    // height: '200p',
  },
  container: {
    display: "flex",
    flex: 1,
  },
  main: {
    flex: 1,
    margin: "10px",
  },
  wakuStatus: {
    marginRight: theme.spacing(2),
  },
  title: {
    flexGrow: 1,
  },
  peers: {},
  buttonleft: {
    marginRight: theme.spacing(2),
  },
  buttonright: {
    marginLeft: theme.spacing(2),
  },
});

function App() {
  const [provider, setProvider] = useState<Web3Provider>();
  const [encryptionKeyPair, setEncryptionKeyPair] = useState<
    KeyPair | undefined
  >();
  const [publicKeys, setPublicKeys] = useState<Map<string, PublicKeyMessageObj>>(
    new Map()
  );
  const [sendSessionKeys, setSendSessionKeys] = useState<Map<string, Uint8Array>>(
    new Map()
  );
  const [receiveSessionKeys, setReceiveSessionKeys] = useState<Map<string, Uint8Array>>(
    new Map()
  );
  const [walletsToSend, setWalletsToSend] = useState<Map<string, Wallet>>(
    new Map()
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [address, setAddress] = useState<string>();

  const classes = useStyles();
  const updataedReceiveSessionKeys = useRef(receiveSessionKeys);

  let addressDisplay = "";
  if (address) {
    addressDisplay =
      address;
      // address.substr(0, 6) + "..." + address.substr(address.length - 4, 4);
  }

  useEffect(() => {
    console.log("Updated receiveSessionKeys", receiveSessionKeys);
    updataedReceiveSessionKeys.current = receiveSessionKeys;
  }, [receiveSessionKeys]);

  const handleBlockEvent = (blockNumber: number | undefined) => {
    if (!provider || !address || !encryptionKeyPair) return;
    handlePublicKeyorPrivateMessage(
      address,
      provider,
      encryptionKeyPair.privateKey,
      publicKeys,
      updataedReceiveSessionKeys.current,
      setReceiveSessionKeys,
      setMessages,
      setPublicKeys,
      blockNumber
    );
  };

  const startListen = async () => {
    if (!provider) return;
    provider.on('block', handleBlockEvent);
    console.log("start listen");
  }
  const stopListen = async () => {
    if (!provider) return;
    provider.removeAllListeners('block');
    console.log("stop listen");
  }

  return (
    <ThemeProvider theme={theme}>
      <div className={classes.root}>
        <AppBar className={classes.appBar} position="static">
          <Toolbar>
            <IconButton
              edge="start"
              className={classes.wakuStatus}
              aria-label="waku-status"
            >
              <WifiIcon
                color={provider ? undefined : "disabled"}
                style={provider ? { color: green[500] } : {}}
              />
            </IconButton>
            <Typography variant="h6" className={classes.title}>
            Blockchain covert communication(by kk/ay/f0)
            </Typography>
            <Typography>{addressDisplay}</Typography>
          </Toolbar>
        </AppBar>

        <div className={classes.container}>
          <main className={classes.main}>
            <fieldset>
              <legend>Wallet</legend>
              <Button
                variant="contained"
                color="primary"
                className={classes.buttonleft}
                onClick={startListen}
                disabled={!provider}
                >
                START LISTEN
              </Button>
              <ConnectWallet
                setAddress={setAddress}
                setProvider={setProvider}
              />
              <Button
                variant="contained"
                color="primary"
                className={classes.buttonright}
                onClick={stopListen}
                disabled={!provider}
                >
                STOP LISTEN
              </Button>
            </fieldset>
            <fieldset>
              <legend>Encryption Key Pair</legend>
              <KeyPairHandling
                encryptionKeyPair={encryptionKeyPair}
                setEncryptionKeyPair={setEncryptionKeyPair}
                provider={provider}
              />
              <BroadcastPublicKey
                address={address}
                encryptionKeyPair={encryptionKeyPair}
                provider={provider}
                setter={setWalletsToSend}
              />
            </fieldset>
            <fieldset>
              <legend>Connecting</legend>
              <Connecting
                recipients={publicKeys}
                messages={messages}
                publicKey={encryptionKeyPair?.publicKey}
                address={address}
                provider={provider}
                setter={setPublicKeys}
                setWalletsToSend={setWalletsToSend}
              />
            </fieldset>
            <fieldset>
              <legend>Messaging</legend>
              <SendPrivateMessage
                recipients={publicKeys}
                provider={provider}
                walletsToSend={walletsToSend}
                sessionKeys={sendSessionKeys}
                setter={setSendSessionKeys}
              />
              <Messages messages={messages} />
            </fieldset>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
