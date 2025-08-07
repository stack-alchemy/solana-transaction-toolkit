import {
  ApiV3PoolInfoStandardItem,
  makeAMMSwapInstruction,
  AmmV4Keys,
  AmmV5Keys,
  AmmRpcData,
  Raydium,
} from "@raydium-io/raydium-sdk-v2";
import { raydiumInstance } from "./config";
import { SLIPPAGE_TOLERANCE } from "../../config/constant";
import BN from "bn.js";
import { isValidAmm } from "./utils";
import { TransactionInstruction, PublicKey } from "@solana/web3.js";

export class RaydiumAMMSwap {
  private poolInfo: ApiV3PoolInfoStandardItem | undefined;
  private poolKeys: AmmV4Keys | AmmV5Keys | undefined;
  private rpcData: AmmRpcData | undefined;
  private raydium: Raydium | undefined;

  constructor() {}

  public async init(inputMint: string, poolId: string): Promise<void> {
    try {
      const raydium = await raydiumInstance.getInstance();

      const [data, poolKeys, rpcData] = await Promise.all([
        raydium.api.fetchPoolById({ ids: poolId }),
        raydium.liquidity.getAmmPoolKeys(poolId),
        raydium.liquidity.getRpcPoolInfo(poolId),
      ]);
      const poolInfo = data[0] as ApiV3PoolInfoStandardItem;

      if (!isValidAmm(poolInfo.programId))
        throw new Error("target pool is not AMM pool");

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
      throw new Error(`Error in Raydium AMM init: ${error.message}`);
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
        throw new Error("Raydium AMM not initialized");
      }

      const inputAmount = new BN(amount);
      const baseIn = inputMint === this.poolInfo.mintA.address;

      const [mintIn, mintOut] = baseIn
        ? [this.poolInfo.mintA, this.poolInfo.mintB]
        : [this.poolInfo.mintB, this.poolInfo.mintA];

      const mintInTokenAccount = tokenAccounts.get(mintIn.address);
      const mintOutTokenAccount = tokenAccounts.get(mintOut.address);
      if (!mintInTokenAccount || !mintOutTokenAccount) {
        throw new Error(
          "Associated token accounts not found for the pool mints"
        );
      }

      const out = await this.raydium.liquidity.computeAmountOut({
        poolInfo: {
          ...this.poolInfo,
          baseReserve: this.rpcData.baseReserve,
          quoteReserve: this.rpcData.quoteReserve,
          status: this.rpcData.status.toNumber(),
          version: 4,
        },
        amountIn: inputAmount,
        mintIn: mintIn.address,
        mintOut: mintOut.address,
        slippage: SLIPPAGE_TOLERANCE, // range: 1 ~ 0.0001, means 100% ~ 0.01%
      });

      let version = 4;
      if (this.poolInfo.pooltype.includes("StablePool")) version = 5;

      const instruction = await makeAMMSwapInstruction({
        version,
        poolKeys: this.poolKeys,
        userKeys: {
          tokenAccountIn: mintInTokenAccount!,
          tokenAccountOut: mintOutTokenAccount!,
          owner: this.raydium.owner?.publicKey!,
        },
        amountIn: inputAmount,
        amountOut: out.minAmountOut,
        fixedSide: "in",
      });

      return {
        innerInstructions: [instruction],
        outAmount: out.amountOut.toNumber(),
      };
    } catch (error: any) {
      throw new Error(`Error in Raydium AMM swap: ${error.message}`)
    }
  }
}