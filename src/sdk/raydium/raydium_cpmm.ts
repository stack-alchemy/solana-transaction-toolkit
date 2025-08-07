import {
  ApiV3PoolInfoStandardItemCpmm,
  CurveCalculator,
  makeSwapCpmmBaseInInstruction,
  CpmmKeys,
  CpmmRpcData,
  Raydium,
} from "@raydium-io/raydium-sdk-v2";
import { raydiumInstance } from "./config";
import BN from "bn.js";
import { isValidCpmm, getPdaObservationId } from "./utils";
import { TransactionInstruction, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export class RaydiumCPMMSwap {
  private poolInfo: ApiV3PoolInfoStandardItemCpmm | undefined;
  private poolKeys: CpmmKeys | undefined;
  private rpcData: CpmmRpcData | undefined;
  private raydium: Raydium | undefined;

  constructor() {}

  public async init(inputMint: string, poolId: string): Promise<void> {
    try {
      const raydium = await raydiumInstance.getInstance();

      const [data, poolKeys, rpcData] = await Promise.all([
        raydium.api.fetchPoolById({ ids: poolId }),
        raydium.cpmm.getCpmmPoolKeys(poolId),
        raydium.cpmm.getRpcPoolInfo(poolId, true),
      ]);
      const poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm;

      if (!isValidCpmm(poolInfo.programId))
        throw new Error("target pool is not CPMM pool");

      if (
        poolInfo.mintA.address !== inputMint &&
        poolInfo.mintB.address !== inputMint
      )
        throw new Error("input mint does not match pool");

      this.poolInfo = poolInfo;
      this.poolKeys = poolKeys;
      this.rpcData = rpcData;
      this.raydium = raydium;

      return;
    } catch (error: any) {
      throw new Error(`Error in Raydium CPMM init: ${error.message}`);
    }
  }

  public async swap(
    amount: number,
    inputMint: string,
    tokenAccounts: Map<string, PublicKey>
  ): Promise<{
    innerInstructions: TransactionInstruction[];
    outAmount: number;
  }> {
    try {
      if (!this.poolInfo || !this.poolKeys || !this.rpcData || !this.raydium) {
        throw new Error("Raydium CPMM not initialized");
      }

      const inputAmount = new BN(amount);

      const mintA = new PublicKey(this.poolInfo.mintA.address);
      const mintB = new PublicKey(this.poolInfo.mintB.address);

      const mintATokenAccount = tokenAccounts.get(this.poolInfo.mintA.address);
      const mintBTokenAccount = tokenAccounts.get(this.poolInfo.mintB.address);

      if (!mintATokenAccount || !mintBTokenAccount) {
        throw new Error(
          "Associated token accounts not found for the pool mints"
        );
      }

      const baseIn = inputMint === this.poolInfo.mintA.address;

      const swapResult = await CurveCalculator.swap(
        inputAmount,
        baseIn ? this.rpcData.baseReserve : this.rpcData.quoteReserve,
        baseIn ? this.rpcData.quoteReserve : this.rpcData.baseReserve,
        this.rpcData.configInfo!.tradeFeeRate
      );

      const instruction: TransactionInstruction =
        await makeSwapCpmmBaseInInstruction(
          new PublicKey(this.poolInfo.programId),
          this.raydium.owner?.publicKey!,
          new PublicKey(this.poolKeys.authority),
          new PublicKey(this.poolKeys.config.id),
          new PublicKey(this.poolInfo.id),
          baseIn ? mintATokenAccount! : mintBTokenAccount!,
          baseIn ? mintBTokenAccount! : mintATokenAccount!,
          new PublicKey(this.poolKeys.vault[baseIn ? "A" : "B"]),
          new PublicKey(this.poolKeys.vault[baseIn ? "B" : "A"]),
          new PublicKey(
            this.poolInfo[baseIn ? "mintA" : "mintB"].programId ??
              TOKEN_PROGRAM_ID
          ),
          new PublicKey(
            this.poolInfo[baseIn ? "mintB" : "mintA"].programId ??
              TOKEN_PROGRAM_ID
          ),
          baseIn ? mintA : mintB,
          baseIn ? mintB : mintA,
          getPdaObservationId(
            new PublicKey(this.poolInfo.programId),
            new PublicKey(this.poolInfo.id)
          ).publicKey,
          inputAmount,
          new BN(0)
        );

      const innerInstructions: TransactionInstruction[] = [instruction];
      const outAmount = swapResult.destinationAmountSwapped.toNumber();

      return { innerInstructions, outAmount };
    } catch (error: any) {
      throw new Error(`Error in Raydium CPMM swap: ${error.message}`)
    }
  }
}
