import {
  Raydium,
  TxVersion,
  parseTokenAccountResp,
} from "@raydium-io/raydium-sdk-v2";
import { PublicKey, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { FINALIZED } from "../../config/constant";
import { solanaWeb3Service } from "../solana/solanaWeb3Service";
import { PRIVATE_KEY } from "../../config/config";
import bs58 from "bs58"

export const TX_VERSION = TxVersion.V0;

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

  public async fetchTokenAccountData(pubkey: PublicKey) {
    try {
      const connection = solanaWeb3Service.connection;
      const [solAccountResp, tokenAccountResp, token2022Resp] =
        await Promise.all([
          connection.getAccountInfo(pubkey),
          connection.getTokenAccountsByOwner(pubkey, {
            programId: TOKEN_PROGRAM_ID,
          }),
          connection.getTokenAccountsByOwner(pubkey, {
            programId: TOKEN_2022_PROGRAM_ID,
          }),
        ]);
      const tokenAccountData = parseTokenAccountResp({
        owner: pubkey,
        solAccountResp,
        tokenAccountResp: {
          context: tokenAccountResp.context,
          value: [...tokenAccountResp.value, ...token2022Resp.value],
        },
      });
      return tokenAccountData;
    } catch (error: any) {
      throw new Error(
        `Error getting token accounts for ${pubkey.toBase58()}: ${
          error.message
        }`
      );
    }
  }
}

export const raydiumInstance = new RaydiumSDK();
