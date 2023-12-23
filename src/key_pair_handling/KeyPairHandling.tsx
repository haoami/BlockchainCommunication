import { Button, TextField } from "@material-ui/core";
import React, { useState } from "react";
import { generateEncryptionKeyPair, KeyPair } from "../wakuCrypto";
import { makeStyles } from "@material-ui/core/styles";
import { Web3Provider } from "@ethersproject/providers";

const useStyles = makeStyles({
  root: {
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    margin: "5px",
  },
  generate: { margin: "5px" }
});

export interface Props {
  encryptionKeyPair: KeyPair | undefined;
  setEncryptionKeyPair: (keyPair: KeyPair) => void;
  provider: Web3Provider | undefined;
}

export default function KeyPairHandling({
  encryptionKeyPair,
  setEncryptionKeyPair,
  provider,
}: Props) {
  const classes = useStyles();

  const generateKeyPair = () => {
    if (encryptionKeyPair) return;

    generateEncryptionKeyPair()
      .then((keyPair) => {
        setEncryptionKeyPair(keyPair);
      })
      .catch((e) => {
        console.error("Failed to generate Key Pair", e);
      });
  };

  return (
    <div className={classes.root}>
      <Button
        className={classes.generate}
        variant="contained"
        color="primary"
        onClick={generateKeyPair}
        disabled={!!encryptionKeyPair || !provider}
      >
        Generate Encryption Key Pair
      </Button>
    </div>
  );
}
