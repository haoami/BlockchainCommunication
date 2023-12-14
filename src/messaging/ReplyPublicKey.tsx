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
import {ethers} from "ethers";
import { Web3Provider } from "@ethersproject/providers";


export interface Props {
  address: string | undefined;
  selectedRecipients: PublicKeyMessageObj | undefined;
  selfPublicKey: Uint8Array | undefined;
  waku: RelayNode | undefined;
  provider: Web3Provider | undefined;
}

export default function ReplyPublicKey({ address, selectedRecipients, selfPublicKey, waku, provider}: Props) {
  const replyPK = async () => {
    if (!selectedRecipients) return;
    if (!address) return;
    if (!selfPublicKey) return;
    if (!waku) return;
    if (!provider) return;
    selectedRecipients.kdSalt = genRandomBytes(32);
    const willUseWallet = ethers.Wallet.createRandom().connect(provider);
    const _replyPublicKeyMessage = await (async () => {
        const pkm = await createPublicKeyMessage(
          address,
          willUseWallet.address,
          selfPublicKey,
          selectedRecipients.kdSalt,
          provider.getSigner()
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