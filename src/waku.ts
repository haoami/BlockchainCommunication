import { Dispatch, SetStateAction } from "react";
import type { RelayNode } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { PrivateMessage, PublicKeyMessage } from "./messaging/wire";
import { validatePublicKeyMessage } from "./wakuCrypto";
import { Message } from "./messaging/Messages";
import { equals } from "uint8arrays/equals";
import { waitForRemotePeer, createRelayNode } from "@waku/sdk";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";
import type { DecodedMessage } from "@waku/message-encryption";

export const PublicKeyContentTopic = "/eth-pm/1/public-key/proto";
export const PrivateMessageContentTopic = "/eth-pm/1/private-message/proto";
export const PrivateMessageContentTopicPwd = "/eth-pm/1/private-message/protoPwd";

export type PublicKeyMessageObj = {
  encryptionPK: Uint8Array,
  kdSalt: Uint8Array
}

export async function initWaku(): Promise<RelayNode> {
  const waku = await createRelayNode({ defaultBootstrap: true });
  await waku.start();
  await waitForRemotePeer(waku, [Protocols.Relay]);

  return waku;
}

export function handlePublicKeyMessage(
  myAddress: string | undefined,
  setter: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>,
  msg: DecodedMessage
) {
  console.log("Public Key Message received:", msg);
  if (!msg.payload) return;
  const publicKeyMsg = PublicKeyMessage.decode(msg.payload);
  if (!publicKeyMsg) return;
  if (myAddress && equals(publicKeyMsg.ethAddress, hexToBytes(myAddress)))
    return;
  const res = validatePublicKeyMessage(publicKeyMsg);
  console.log("Is Public Key Message valid?", res);

  if (res) {
    setter((prevPks: Map<string, PublicKeyMessageObj>) => {
      prevPks.set(
        bytesToHex(publicKeyMsg.ethAddress),
        {
          encryptionPK: publicKeyMsg.encryptionPublicKey,
          kdSalt: publicKeyMsg.randomSeed
        }
      );
      return new Map(prevPks);
    });
  }
}

export async function handlePrivateMessage(
  setterPublicKeys: Dispatch<SetStateAction<Map<string, PublicKeyMessageObj>>>,
  setterMessages: Dispatch<SetStateAction<Message[]>>,
  address: string,
  wakuMsg: DecodedMessage
) {
  console.log("Private Message received:", wakuMsg);
  if (!wakuMsg.payload) return;
  const privateMessage = PrivateMessage.decode(wakuMsg.payload);
  if (!privateMessage) {
    console.log("Failed to decode Private Message");
    return;
  }
  if (!equals(privateMessage.toAddress, hexToBytes(address))){
    const replyPublicKeyMessage = PublicKeyMessage.decode(wakuMsg.payload);
    if (!replyPublicKeyMessage){
      console.log("Failed to decode replyPublicKey Message");
      return;
    }
    console.log("from address:", bytesToHex(replyPublicKeyMessage.ethAddress));
    setterPublicKeys((prevPks: Map<string, PublicKeyMessageObj>) => {
      prevPks.set(
        bytesToHex(replyPublicKeyMessage.ethAddress),
        {
          encryptionPK: replyPublicKeyMessage.encryptionPublicKey,
          kdSalt: replyPublicKeyMessage.randomSeed
        }
      );
      return new Map(prevPks);
    });
  }
  else{
    const timestamp = wakuMsg.timestamp ? wakuMsg.timestamp : new Date();
    console.log("Message decrypted:", privateMessage.message);
    setterMessages((prevMsgs: Message[]) => {
      const copy = prevMsgs.slice();
      copy.push({
        text: privateMessage.message,
        timestamp: timestamp,
      });
      return copy;
    });
  }
}