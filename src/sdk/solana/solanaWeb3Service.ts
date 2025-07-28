import {
  Connection,
  GetVersionedTransactionConfig,
  Finality,
  Keypair,
  ParsedTransactionWithMeta,
  PublicKey,
  AddressLookupTableAccount,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  AccountLayout,
  createAssociatedTokenAccount,
  MintLayout,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import bs58 from "bs58";
import { RPC_ENDPOINT, PRIVATE_KEY } from "../../config/config";
import { PROCESSED, CONFIRMED, FINALIZED } from "../../config/constant";

class SolanaWeb3Service {
  private keypair: Keypair;
  public connection: Connection;

  constructor(rpcEndpoint: string) {
    this.keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
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

  public async getComputeBudgetInstruction(): Promise<
    TransactionInstruction[]
  > {
    const instructions = [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 250000,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 10000,
      }),
    ];

    return instructions;
  }

  public async getTransaction(
    signature: string
  ): Promise<ParsedTransactionWithMeta> {
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

  public async getTokenDecimals(mintAddress: string): Promise<number> {
    try {
      const mintPubkey = new PublicKey(mintAddress);
      const mintInfo = await this.connection.getAccountInfo(mintPubkey);

      if (mintInfo === null) {
        throw new Error(`Mint account with address ${mintAddress} not found.`);
      }

      const mintData = MintLayout.decode(mintInfo.data);
      return mintData.decimals;
    } catch (error: any) {
      throw new Error(`Error fetching token decimals: ${error.message}`);
    }
  }

  public async getTokenAccount(
    tokenAddress: string,
    ownerAddress: string
  ): Promise<string> {
    try {
      const tokenPubkey = new PublicKey(tokenAddress);
      const ownerPubkey = new PublicKey(ownerAddress);
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenPubkey,
        ownerPubkey
      );

      return associatedTokenAddress.toBase58();
    } catch (error: any) {
      throw new Error(`Error fetching token account: ${error.message}`);
    }
  }

  public async getAddressLookupTable(
    account: PublicKey
  ): Promise<AddressLookupTableAccount> {
    try {
      const lookupTable = await this.connection.getAddressLookupTable(account);
      if (!lookupTable || !lookupTable.value) {
        throw new Error(
          `Lookup table for account ${account.toBase58()} not found.`
        );
      }
      return lookupTable.value;
    } catch (error: any) {
      throw new Error(`Error fetching address lookup table: ${error.message}`);
    }
  }

  public async sendTransaction(
    instructions: TransactionInstruction[],
    alts: AddressLookupTableAccount[]
  ): Promise<string> {
    try {
      const blockhash = (await this.connection.getLatestBlockhash(FINALIZED))
        .blockhash;
      const messageV0 = new TransactionMessage({
        payerKey: this.keypair.publicKey,
        recentBlockhash: blockhash,
        instructions: instructions,
      }).compileToV0Message(alts);

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([this.keypair]);

      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: true, preflightCommitment: FINALIZED, maxRetries: 3 }
      );

      return signature;
    } catch (error: any) {
      throw new Error(`Error sending transaction: ${error.message}`);
    }
  }

  public async createTokenAccount(tokenAddress: string): Promise<string> {
    try {
      const tokenPubkey = new PublicKey(tokenAddress);
      const ownerPubkey = this.keypair.publicKey;
      const tokenAccount = await getAssociatedTokenAddress(
        tokenPubkey,
        ownerPubkey
      );
      const accountInfo = await this.connection.getAccountInfo(tokenAccount);
      if (accountInfo) {
        throw new Error("Token account already exists.");
      }

      const newTokenAccount = await createAssociatedTokenAccount(
        this.connection,
        this.keypair,
        tokenPubkey,
        ownerPubkey
      );

      return newTokenAccount.toBase58();
    } catch (error: any) {
      throw new Error(
        `Error creating a token account for ${tokenAddress}: ${error.message}`
      );
    }
  }
}

export const solanaWeb3Service = new SolanaWeb3Service(RPC_ENDPOINT);
