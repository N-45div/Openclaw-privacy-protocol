export type OpenclawPrivacyProtocol = {
  "version": "0.1.0",
  "name": "openclaw_privacy_protocol",
  "instructions": [
    {
      "name": "initializeProtocol",
      "accounts": [
        {
          "name": "protocolConfig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "registerAgent",
      "accounts": [
        {
          "name": "agent",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "protocolConfig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "agentName",
          "type": "string"
        },
        {
          "name": "encryptionPubkey",
          "type": {
            "array": ["u8", 32]
          }
        },
        {
          "name": "capabilities",
          "type": {
            "vec": "string"
          }
        }
      ]
    },
    {
      "name": "createPrivateChannel",
      "accounts": [
        {
          "name": "channel",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "protocolConfig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "channelId",
          "type": "string"
        },
        {
          "name": "participants",
          "type": {
            "vec": "pubkey"
          }
        },
        {
          "name": "encryptedMetadata",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "sendEncryptedMessage",
      "accounts": [
        {
          "name": "message",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sender",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "channel",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "messageId",
          "type": "string"
        },
        {
          "name": "encryptedContent",
          "type": "bytes"
        },
        {
          "name": "recipient",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeShieldedBalance",
      "accounts": [
        {
          "name": "shieldedBalance",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "mint",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "shieldedTransfer",
      "accounts": [
        {
          "name": "senderBalance",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "recipientBalance",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "sender",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "amountCommitment",
          "type": {
            "array": ["u8", 32]
          }
        },
        {
          "name": "nullifier",
          "type": {
            "array": ["u8", 32]
          }
        },
        {
          "name": "proof",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "updateAgentCapabilities",
      "accounts": [
        {
          "name": "agent",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "newCapabilities",
          "type": {
            "vec": "string"
          }
        }
      ]
    },
    {
      "name": "closePrivateChannel",
      "accounts": [
        {
          "name": "channel",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "creator",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "ProtocolConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "initialized",
            "type": "bool"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "totalAgents",
            "type": "u64"
          },
          {
            "name": "totalChannels",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "Agent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "encryptionPubkey",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "encryptionNonce",
            "type": "u64"
          },
          {
            "name": "capabilities",
            "type": {
              "vec": "string"
            }
          },
          {
            "name": "reputationScore",
            "type": "i64"
          },
          {
            "name": "totalTasksCompleted",
            "type": "u64"
          },
          {
            "name": "registeredAt",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "PrivateChannel",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "channelId",
            "type": "string"
          },
          {
            "name": "participants",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "encryptedMetadata",
            "type": "bytes"
          },
          {
            "name": "messageCount",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "EncryptedMessage",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "channel",
            "type": "pubkey"
          },
          {
            "name": "messageId",
            "type": "string"
          },
          {
            "name": "sender",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "encryptedContent",
            "type": "bytes"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "delivered",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "ShieldedBalance",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "commitment",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "pendingTransfers",
            "type": {
              "vec": {
                "defined": "ShieldedTransferRecord"
              }
            }
          },
          {
            "name": "nonce",
            "type": "u64"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "ShieldedTransferRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amountCommitment",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "nullifier",
            "type": {
              "array": ["u8", 32]
            }
          },
          {
            "name": "from",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "ProtocolInitialized",
      "fields": [
        {
          "name": "authority",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "AgentRegistered",
      "fields": [
        {
          "name": "agent",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "owner",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "name",
          "type": "string",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "PrivateChannelCreated",
      "fields": [
        {
          "name": "channel",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "creator",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "participants",
          "type": {
            "vec": "pubkey"
          },
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "EncryptedMessageSent",
      "fields": [
        {
          "name": "message",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "channel",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "sender",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "recipient",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "messageId",
          "type": "string",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "ShieldedBalanceInitialized",
      "fields": [
        {
          "name": "balanceAccount",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "owner",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "mint",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "ShieldedTransferExecuted",
      "fields": [
        {
          "name": "senderBalance",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "recipientBalance",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "nullifier",
          "type": {
            "array": ["u8", 32]
          },
          "index": false
        },
        {
          "name": "amountCommitment",
          "type": {
            "array": ["u8", 32]
          },
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "AgentCapabilitiesUpdated",
      "fields": [
        {
          "name": "agent",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "owner",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "capabilities",
          "type": {
            "vec": "string"
          },
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "PrivateChannelClosed",
      "fields": [
        {
          "name": "channel",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "creator",
          "type": "pubkey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ProtocolPaused",
      "msg": "Protocol is paused"
    },
    {
      "code": 6001,
      "name": "NameTooLong",
      "msg": "Name too long"
    },
    {
      "code": 6002,
      "name": "TooManyCapabilities",
      "msg": "Too many capabilities"
    },
    {
      "code": 6003,
      "name": "ChannelIdTooLong",
      "msg": "Channel ID too long"
    },
    {
      "code": 6004,
      "name": "InvalidParticipants",
      "msg": "Invalid number of participants"
    },
    {
      "code": 6005,
      "name": "MetadataTooLarge",
      "msg": "Metadata too large"
    },
    {
      "code": 6006,
      "name": "NotAParticipant",
      "msg": "Not a participant in this channel"
    },
    {
      "code": 6007,
      "name": "InvalidRecipient",
      "msg": "Invalid recipient"
    },
    {
      "code": 6008,
      "name": "ChannelInactive",
      "msg": "Channel is inactive"
    },
    {
      "code": 6009,
      "name": "MessageIdTooLong",
      "msg": "Message ID too long"
    },
    {
      "code": 6010,
      "name": "MessageTooLarge",
      "msg": "Message too large"
    },
    {
      "code": 6011,
      "name": "ProofTooLarge",
      "msg": "Proof too large"
    },
    {
      "code": 6012,
      "name": "NonceOverflow",
      "msg": "Nonce overflow"
    },
    {
      "code": 6013,
      "name": "Unauthorized",
      "msg": "Unauthorized operation"
    }
  ]
}