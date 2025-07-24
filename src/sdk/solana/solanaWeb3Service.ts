import {
  Connection,
  GetVersionedTransactionConfig,
  Finality,
  ParsedTransactionWithMeta,
  PublicKey,
} from "@solana/web3.js";
import { AccountLayout } from "@solana/spl-token";
import { RPC_ENDPOINT } from "../../config/config";
import { PROCESSED, CONFIRMED, FINALIZED } from "../../config/constant";

class SolanaWeb3Service {
  private connection: Connection;

  constructor(rpcEndpoint: string) {
    this.connection = new Connection(rpcEndpoint, CONFIRMED);
  }

  public async getHealth(): Promise<boolean> {
    try {
      const slot: number = await this.connection.getSlot();
      if (slot === null || slot <= 0) {
        throw new Error("Connection is not healthy, slot is null or zero.");
      } else {
        return true;
      }
    } catch (error: any) {
      throw new Error(`Error checking connection health: ${error.message}`);
    }
  }

  public async getTransaction(signature: string): Promise<ParsedTransactionWithMeta> {
    try {
      const config: GetVersionedTransactionConfig = {
        commitment: "confirmed" as Finality,
        maxSupportedTransactionVersion: 0,
      };
      const transaction = await this.connection.getParsedTransaction(
        signature,
        config
      );

      if (!transaction) {
        throw new Error(`Transaction with signature ${signature} not found.`);
      }

      return transaction;
    } catch (error: any) {
      throw new Error(`Error fetching transaction: ${error.message}`);
    }
  }

  public async getTokenAddressAndOwnerFromTokenAccount(
    tokenAccountAddress: string
  ): Promise<{ tokenAddress: string; ownerAddress: string }> {
    try {
      const tokenAccountPubkey = new PublicKey(tokenAccountAddress);
      const accountInfo = await this.connection.getAccountInfo(
        tokenAccountPubkey
      );

      if (accountInfo === null) {
        throw new Error(
          `Token account with address ${tokenAccountAddress} not found.`
        );
      }

      const accountData = AccountLayout.decode(accountInfo.data);
      const mintAddress = new PublicKey(accountData.mint);

      const tokenAddress = mintAddress.toBase58();
      const ownerAddress = new PublicKey(accountData.owner).toBase58();

      return { tokenAddress, ownerAddress };
    } catch (error: any) {
      throw new Error(
        `Error fetching token address and owner: ${error.message}`
      );
    }
  }
}

export const solanaWeb3Service = new SolanaWeb3Service(RPC_ENDPOINT);
