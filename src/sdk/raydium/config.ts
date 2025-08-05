import {
  Raydium,
} from "@raydium-io/raydium-sdk-v2";
import { Keypair } from "@solana/web3.js";
import { FINALIZED } from "../../config/constant";
import { solanaWeb3Service } from "../solana/solanaWeb3Service";
import { PRIVATE_KEY } from "../../config/config";
import bs58 from "bs58"

class RaydiumSDK {
  private raydium: Raydium | undefined;

  constructor() {}

  private async init() {
    try {
      const connection = solanaWeb3Service.connection;
      const cluster = "mainnet";
      const owner = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));

      this.raydium = await Raydium.load({
        owner,
        connection,
        cluster,
        disableFeatureCheck: true,
        blockhashCommitment: FINALIZED, // Ensure FINALIZED is defined
      });
    } catch (error: any) {
      throw new Error(`Error loading Raydium SDK:, ${error.message}`);
    }
  }

  public async getInstance(): Promise<Raydium> {
    try {
      if (this.raydium === undefined) {
        await this.init();
      }

      return this.raydium!;
    } catch (error: any) {
      throw new Error(
        `Error getting an instance of RaydiumSDK: ${error.message}`
      );
    }
  }
}

export const raydiumInstance = new RaydiumSDK();
