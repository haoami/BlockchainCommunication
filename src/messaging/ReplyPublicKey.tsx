import React, {useState} from "react";
import { Button } from "@material-ui/core";
import { PublicKeyMessageObj } from "../waku";
import { PublicKeyMessage } from "./wire";
import {
  createPublicKeyMessage,
  genRandomBytes,
  KeyPair,
} from "../wakuCrypto";
import { TypedDataSigner } from "@ethersproject/abstract-signer";
import { PrivateMessageContentTopic } from "../waku"
import { createEncoder } from "@waku/message-encryption/ecies";
import type { RelayNode } from "@waku/interfaces";


export interface Props {
  address: string | undefined;
  selectedRecipients: PublicKeyMessageObj | undefined;
  selfPublicKey: Uint8Array | undefined;
  waku: RelayNode | undefined;
  signer: TypedDataSigner | undefined;
}

export default function ReplyPublicKey({ address, selectedRecipients, selfPublicKey, waku, signer}: Props) {
  const replyPK = async () => {
    if (!selectedRecipients) return;
    if (!address) return;
    if (!selfPublicKey) return;
    if (!waku) return;
    if (!signer) return;
    selectedRecipients.kdSalt = genRandomBytes(32);
    const _replyPublicKeyMessage = await (async () => {
        const pkm = await createPublicKeyMessage(
          address,
          selfPublicKey,
          selectedRecipients.kdSalt,
          signer
        );
        return pkm;
    })();
    
    const payload = _replyPublicKeyMessage.encode();
    const replyPublicKeyMessageEncoder = createEncoder({
      contentTopic: PrivateMessageContentTopic,
      publicKey: selectedRecipients.encryptionPK,
      ephemeral: true,
    });
    await waku.relay.send(replyPublicKeyMessageEncoder, { payload });
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={replyPK}
      disabled={!selfPublicKey}
      >
      CONNECT ESTABLISHMENT
    </Button>
  );
}