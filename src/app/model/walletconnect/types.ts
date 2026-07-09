import { ProposalTypes, SignClientTypes } from "@walletconnect/types";

export type WalletConnectSessionExtension = {
    // Information added by Essentials
    timestamp?: number; // Date at which the session was created
}

/******* WALLET CONNECT V2 TYPES */

export type SessionProposalEvent = Omit<SignClientTypes.BaseEventArgs<ProposalTypes.Struct>, "topic">;
export type SessionRequestEvent = SignClientTypes.BaseEventArgs<{ request: { method: string; params: any; }; chainId: string; }>;