import {
  ApiV3PoolInfoConcentratedItem,
  ClmmKeys,
  ComputeClmmPoolInfo,
  PoolUtils,
  ReturnTypeFetchMultiplePoolTickArrays,
  ClmmInstrument,
  MIN_SQRT_PRICE_X64,
  MAX_SQRT_PRICE_X64,
  Raydium,
} from "@raydium-io/raydium-sdk-v2";
import { raydiumInstance } from "./config";
import { SLIPPAGE_TOLERANCE } from "../../config/constant";
import BN from "bn.js";
import { isValidClmm } from "./utils";
import { TransactionInstruction, PublicKey } from "@solana/web3.js";

export class RaydiumCLMMSwap {
  private raydium: Raydium | undefined;
  private poolInfo: ApiV3PoolInfoConcentratedItem | undefined;
  private poolKeys: ClmmKeys | undefined;
  private clmmPoolInfo: ComputeClmmPoolInfo | undefined;
  private tickCache: ReturnTypeFetchMultiplePoolTickArrays | undefined;
  private poolId: string | undefined;

  constructor() {}

  public async init(inputMint: string, poolId: string): Promise<void> {
    try {
      this.raydium = await raydiumInstance.getInstance();

      const data = await this.raydium.api.fetchPoolById({ ids: poolId });
      this.poolInfo = data[0] as ApiV3PoolInfoConcentratedItem;

      if (!isValidClmm(this.poolInfo.programId))
        throw new Error("target pool is not CLMM pool");

      [this.clmmPoolInfo, this.poolKeys] = await Promise.all([
        PoolUtils.fetchComputeClmmInfo({
          connection: this.raydium.connection,
          poolInfo: this.poolInfo,
        }),
        this.raydium.clmm.getClmmPoolKeys(this.poolInfo.id),
      ]);

      this.tickCache = await PoolUtils.fetchMultiplePoolTickArrays({
        connection: this.raydium.connection,
        poolKeys: [this.clmmPoolInfo],
      });

      if (
        this.poolInfo.mintA.address !== inputMint &&
        this.poolInfo.mintB.address !== inputMint
      )
        throw new Error("input mint does not match pool");

      this.poolId = poolId;

      return;
    } catch (error: any) {
      throw new Error(`Error in Raydium CLMM init: ${error.message}`);
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
      if (
        !this.poolInfo ||
        !this.poolKeys ||
        !this.clmmPoolInfo ||
        !this.tickCache ||
        !this.poolId ||
        !this.raydium
      ) {
        throw new Error("Raydium CLMM not initialized");
      }

      const inputAmount = new BN(amount);
      const baseIn = inputMint === this.poolInfo.mintA.address;
      const tokenAccountA = tokenAccounts.get(this.poolInfo.mintA.address);
      const tokenAccountB = tokenAccounts.get(this.poolInfo.mintB.address);
      if (!tokenAccountA || !tokenAccountB) {
        throw new Error(
          "Associated token accounts not found for the pool mints"
        );
      }

      const sqrtPriceLimitX64 = baseIn
        ? MIN_SQRT_PRICE_X64.add(new BN(1))
        : MAX_SQRT_PRICE_X64.sub(new BN(1));

      const { minAmountOut, remainingAccounts } =
        await PoolUtils.computeAmountOutFormat({
          poolInfo: this.clmmPoolInfo,
          tickArrayCache: this.tickCache[this.poolId],
          amountIn: inputAmount,
          tokenOut: this.poolInfo[baseIn ? "mintB" : "mintA"],
          slippage: SLIPPAGE_TOLERANCE,
          epochInfo: await this.raydium.fetchEpochInfo(),
        });

      const { instructions } = await ClmmInstrument.makeSwapBaseInInstructions({
        poolInfo: this.poolInfo,
        poolKeys: this.poolKeys,
        observationId: this.clmmPoolInfo.observationId,
        ownerInfo: {
          wallet: this.raydium.owner?.publicKey!,
          tokenAccountA: tokenAccountA!,
          tokenAccountB: tokenAccountB!,
        },
        inputMint: new PublicKey(inputMint),
        amountIn: inputAmount,
        amountOutMin: minAmountOut.amount.raw,
        sqrtPriceLimitX64: sqrtPriceLimitX64,
        remainingAccounts,
      });

      const innerInstructions: TransactionInstruction[] = instructions;
      const outAmount = minAmountOut.amount.raw.toNumber();

      return { innerInstructions, outAmount };
    } catch (error: any) {
      throw new Error(`Error in Raydium CLMM swap: ${error.message}`)
    }
  }
}
