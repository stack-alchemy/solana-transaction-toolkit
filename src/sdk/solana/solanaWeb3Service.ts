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
  MintLayout,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  closeAccount,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import bs58 from "bs58";
import { RPC_ENDPOINT, PRIVATE_KEY } from "../../config/config";
import { CONFIRMED, FINALIZED } from "../../config/constant";

class SolanaWeb3Service {
  private keypair: Keypair;
  public tokenAccounts: Map<string, PublicKey> = new Map();
  public connection: Connection;
  public userAddress: PublicKey;

  constructor(rpcEndpoint: string) {
    this.keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
    this.userAddress = this.keypair.publicKey;
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

  public async createTokenAccount(
    mintAddress: string
  ): Promise<TransactionInstruction> {
    try {
      const mintPubkey = new PublicKey(mintAddress);
      const mintInfo = await this.connection.getAccountInfo(mintPubkey);
      if (!mintInfo) {
        throw new Error(`Mint account with address ${mintAddress} not found.`);
      }

      const owner = mintInfo.owner.toBase58();
      let programId: PublicKey;
      if (owner === TOKEN_PROGRAM_ID.toBase58()) {
        programId = TOKEN_PROGRAM_ID;
      } else if (owner === TOKEN_2022_PROGRAM_ID.toBase58()) {
        programId = TOKEN_2022_PROGRAM_ID;
      } else {
        throw new Error(`Unsupported token program: ${owner}`);
      }

      const ata = getAssociatedTokenAddressSync(
        mintPubkey,
        this.keypair.publicKey,
        false,
        programId
      );
      const instruction = createAssociatedTokenAccountIdempotentInstruction(
        this.keypair.publicKey,
        ata,
        this.keypair.publicKey,
        mintPubkey,
        programId
      );

      this.tokenAccounts.set(mintAddress, ata);
      return instruction;
    } catch (error: any) {
      throw new Error(`Error creating a token account: ${error.message}`);
    }
  }

  public async closeTokenAccount(tokenAccount: string): Promise<string> {
    try {
      const tokenAccountPubkey = new PublicKey(tokenAccount);
      const signature = await closeAccount(
        this.connection,
        this.keypair,
        tokenAccountPubkey,
        this.keypair.publicKey,
        this.keypair
      );
      return signature;
    } catch (error: any) {
      throw new Error(`Error closing token account: ${error.message}`);
    }
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

  public async getAllTokenAccounts(): Promise<void> {
    try {
      const ownerPubkey = this.keypair.publicKey;
      const accounts = await this.connection.getParsedTokenAccountsByOwner(
        ownerPubkey,
        {
          programId: TOKEN_PROGRAM_ID,
        }
      );
      // Clear previous map
      this.tokenAccounts.clear();
      // Map to include mint address for each token account and push to tokenAccounts
      accounts.value.forEach((acc: any) => {
        const mint = acc.account.data.parsed.info.mint;
        const pubkey = acc.pubkey;
        this.tokenAccounts.set(mint, pubkey);
      });
      return;
    } catch (error: any) {
      throw new Error(`Error fetching all token accounts: ${error.message}`);
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

      const res = await this.confirmTransaction(signature);
      if (res !== "") {
        throw new Error(`Transaction failed to confirm: ${signature}`);
      }

      return signature;
    } catch (error: any) {
      throw new Error(`Error sending transaction: ${error.message}`);
    }
  }

  public async confirmTransaction(
    txId: string
  ): Promise<string> {
    this.connection.getSignatureStatuses([txId]);
    return new Promise((resolve, reject) => {
      const id = setTimeout(reject, 60 * 1000);
      this.connection.onSignature(
        txId,
        (signatureResult) => {
          clearTimeout(id);
          if (!signatureResult.err) {
            resolve("");
            return;
          }
          reject(Object.assign(signatureResult.err, { txId }));
        },
        CONFIRMED
      );
    });
  }
}

export const solanaWeb3Service = new SolanaWeb3Service(RPC_ENDPOINT);
