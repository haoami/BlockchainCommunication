import {
    FormControl,
    makeStyles,
    Select,
    MenuItem,
    Button,
    InputLabel,
    TextField
} from "@material-ui/core";
import { PublicKeyMessageObj, encryptWithPublicKey, importPublicKeyUint8ArrayToCryptoKey } from "../wakuCrypto";
import {ChangeEvent, useState, KeyboardEvent, Dispatch, SetStateAction } from "react";
import { Web3Provider } from "@ethersproject/providers"
import { Wallet, ethers } from "ethers";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";
import {
  encryptCBC,
  generateDeriveKey,
  importAESKeyUint8ArrayToCryptoKey,
  sendMultiTransactions,
} from "../wakuCrypto";

let flag = true;
const useStyles = makeStyles((theme)=>({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  button: {
    margin: theme.spacing(1),
    minWidth: 120,
    minHeight: 30,
  },
}));

interface Props {
  recipients: Map<string, PublicKeyMessageObj>;
  provider: Web3Provider | undefined;
  walletsToSend: Map<string, Wallet>;
  sessionKeys: Map<string, Uint8Array>;
  setter: Dispatch<SetStateAction<Map<string, Uint8Array>>>;
}

export default function SendPrivateMessage({ recipients, provider, walletsToSend, sessionKeys, setter}: Props) {
  const classes = useStyles();
  const [message, setMessage] = useState<string>();
  const [recipient, setRecipient] = useState<string>("");

  const getTargetAddress = (length: number, value: number): string => {
    if (!provider) return "1";
    while(1){
      const offset = 0-length;
      const andbit = length===1?1:3;
      const lsbWallet = ethers.Wallet.createRandom().connect(provider);
      const comAddr = parseInt(lsbWallet.address.slice(offset), 16)&andbit;
      if(comAddr === value){
        return lsbWallet.address!;
      }
    }
    return "1";
  }

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

      sendMsg(sessionKeys, setter);
      setMessage("");
    }
  };

  const sendButton = async () => {
    if (!provider) return;

    sendMsg(sessionKeys, setter);
    setMessage("");
  }

  const sendMsg = async (sessionKeys: Map<string, Uint8Array>, setter: Dispatch<SetStateAction<Map<string, Uint8Array>>>) => {
    flag = false;
    if (!provider) return;
    if (!message) return;
    if (!provider) return;
    const myAddress = await provider.getSigner().getAddress();
    const recipientPKMobj = recipients.get(recipient);
    const tmpWalletConnected = walletsToSend.get(recipient);
    console.log(recipients);
    console.log(walletsToSend);
    if (!recipientPKMobj) return;
    if (!tmpWalletConnected) return;

    const transactions: Map<number, { to: string; value: ethers.BigNumber}> = new Map();
    function addTransaction(idx: number, to: string, value: number) {
      transactions.set(idx, {
        to: to,
        value: ethers.utils.parseEther(value.toString())
      });
    }

    try{
      
      const balance = await tmpWalletConnected.getBalance();
      if (parseFloat(ethers.utils.formatEther(balance)) < 0.0001){
        const signer = provider.getSigner();
        const toTmpWallet = {
          to: tmpWalletConnected.address,
          value: ethers.utils.parseEther("0.00015"),
        };
        await signer.sendTransaction(toTmpWallet);
      }
      
      while(1){
        const balance = await tmpWalletConnected.getBalance();
        if (parseFloat(ethers.utils.formatEther(balance)) > 0) {
          break;
        } else {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      var sessionKey: Uint8Array;
      if (sessionKeys.has(recipient)){
        const lastSessionKey = sessionKeys.get(recipient);
        if (!lastSessionKey) return;
        sessionKey = await generateDeriveKey(bytesToHex(lastSessionKey), bytesToHex(recipientPKMobj.kdSalt));
      }
      else{
        sessionKey = await generateDeriveKey((myAddress+recipient).toLowerCase(), bytesToHex(recipientPKMobj.kdSalt));
      }
      setter((prevSessionKey: Map<string, Uint8Array>) => {
        prevSessionKey.set(
          recipient.toLowerCase(),
          sessionKey
        );
        return new Map(prevSessionKey);
      });
      const encoder = new TextEncoder();
      const encoded = encoder.encode(message);
      const key = await importAESKeyUint8ArrayToCryptoKey(sessionKey);
      const iv = hexToBytes(recipient.slice(-33, -1));
      // console.log("info");
      // console.log(recipientPKMobj);
      // console.log(sessionKey);
      // console.log(recipient.slice(-33, -1));
      // console.log(encoded);
      // console.log("info");
      const aesEncrypted = await encryptCBC(key, iv, encoded);
      console.log("aesEncrypted: ", aesEncrypted);

      /**
       * rsa encrypt
       * but very slow
       */
      const publicKey = await importPublicKeyUint8ArrayToCryptoKey(recipientPKMobj.encryptionPK);
      const blockSize = 0xb0;
      const encryptedBlocks = [];
      for (let i = 0; i < aesEncrypted.length; i += blockSize) {
        const block = aesEncrypted.slice(i, i + blockSize);
        const encryptedBlock = await encryptWithPublicKey(publicKey, block);
        encryptedBlocks.push(new Uint8Array(encryptedBlock));
      }
      let totalLength = 0;
      encryptedBlocks.forEach(currentArray => {
        totalLength += currentArray.length;
      });
      let payload = new Uint8Array(totalLength);
      let offset = 0;
      encryptedBlocks.forEach(currentArray => {
        payload.set(currentArray, offset);
        offset += currentArray.length;
      });
      console.log("concated blocks: ", payload);

      /**
       * for test, without rsa could be faster
       */
      // const payload = aesEncrypted;

      addTransaction(0, getTargetAddress(2, 0b00), 0);
      const addrMap = new Map();
      addrMap.set(0, getTargetAddress(2, 0b00));
      addrMap.set(1, getTargetAddress(2, 0b01));
      for (let i = 0; i < payload.length; i++){
        var byte = payload[i];
        for (let j = 0; j < 8; j++){
          const bit = byte&0b1;
          byte = byte>>1;
          addTransaction(i*8+j+1, addrMap.get(bit), 0);
        }
      }
      addTransaction(transactions.size, getTargetAddress(2, 0b11), 0);

      await sendMultiTransactions(provider, tmpWalletConnected, transactions);
      flag = true;
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
        disabled={!recipient || !flag}
      />
      <Button className={classes.button}
        variant="contained"
        color="primary"
        onClick={sendButton}
        >
        SNED
      </Button>
    </div>
  );
}