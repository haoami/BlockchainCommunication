import { Button, TextField } from "@material-ui/core";
import { LoadKeyPair } from "./LoadKeyPair";
import { SaveKeyPair } from "./SaveKeyPair";
import React, { useState } from "react";
import { generateEncryptionKeyPair, KeyPair } from "../wakuCrypto";
import { makeStyles } from "@material-ui/core/styles";
import PasswordInput from "./PasswordInput";

const useStyles = makeStyles({
  root: {
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    flexDirection: "column",
    margin: "5px",
  },
  generate: { margin: "5px" },
  storage: {
    margin: "5px",
  },
  loadSave: {
    display: "flex",
    flexDirection: "row",
    margin: "5px",
  },
  loadSaveButton: {
    margin: "5px",
  },
});

export interface Props {
  encryptionKeyPair: KeyPair | undefined;
  setEncryptionKeyPair: (keyPair: KeyPair) => void;
}

export default function KeyPairHandling({
  encryptionKeyPair,
  setEncryptionKeyPair,
}: Props) {
  const classes = useStyles();

  const [password, setPassword] = useState<string>();

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
        disabled={!!encryptionKeyPair}
      >
        Generate Encryption Key Pair
      </Button>
    </div>
  );
}
