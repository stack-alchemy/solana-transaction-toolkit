import {
  Connection,
  GetVersionedTransactionConfig,
  Finality,
  TransactionResponse,
} from "@solana/web3.js";
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

  public async getTransaction(signature: string): Promise<TransactionResponse> {
    try {
      const config: GetVersionedTransactionConfig = {
        commitment: "confirmed" as Finality,
        maxSupportedTransactionVersion: 0,
      };
      const transaction = await this.connection.getTransaction(
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
}

export const solanaWeb3Service = new SolanaWeb3Service(RPC_ENDPOINT);
