import {
  ApiV3PoolInfoConcentratedItem,
  ClmmKeys,
  ComputeClmmPoolInfo,
  PoolUtils,
  ReturnTypeFetchMultiplePoolTickArrays,
} from "@raydium-io/raydium-sdk-v2";
import { raydiumInstance, TX_VERSION } from "./config";
import { SLIPPAGE_TOLERANCE } from "../../config/constant";
import BN from "bn.js";
import { isValidClmm } from "./utils";
import { TransactionInstruction } from "@solana/web3.js";

export const swap = async (
  inputMint: string,
  poolId: string,
  amount: number
): Promise<{
  innerInstructions: TransactionInstruction[];
  alts: string[];
  outAmount: number;
}> => {
  const raydium = await raydiumInstance.getInstance();
  const inputAmount = new BN(amount);

  let poolInfo: ApiV3PoolInfoConcentratedItem | undefined;
  let tickCache: ReturnTypeFetchMultiplePoolTickArrays;

  const data = await raydium.api.fetchPoolById({ ids: poolId });
  poolInfo = data[0] as ApiV3PoolInfoConcentratedItem;

  if (!isValidClmm(poolInfo.programId))
    throw new Error("target pool is not CLMM pool");

  const [clmmPoolInfo, poolKeys] = await Promise.all([
    PoolUtils.fetchComputeClmmInfo({
      connection: raydium.connection,
      poolInfo,
    }),
    raydium.clmm.getClmmPoolKeys(poolInfo.id),
  ]);

  tickCache = await PoolUtils.fetchMultiplePoolTickArrays({
    connection: raydium.connection,
    poolKeys: [clmmPoolInfo],
  });

  if (
    poolInfo.mintA.address !== inputMint &&
    poolInfo.mintB.address !== inputMint
  )
    throw new Error("input mint does not match pool");

  const baseIn = inputMint === poolInfo.mintA.address;

  const { minAmountOut, remainingAccounts } =
    await PoolUtils.computeAmountOutFormat({
      poolInfo: clmmPoolInfo,
      tickArrayCache: tickCache[poolId],
      amountIn: inputAmount,
      tokenOut: poolInfo[baseIn ? "mintB" : "mintA"],
      slippage: SLIPPAGE_TOLERANCE,
      epochInfo: await raydium.fetchEpochInfo(),
    });

  const { builder } = await raydium.clmm.swap({
    poolInfo,
    poolKeys,
    inputMint: poolInfo[baseIn ? "mintA" : "mintB"].address,
    amountIn: inputAmount,
    amountOutMin: minAmountOut.amount.raw,
    observationId: clmmPoolInfo.observationId,
    ownerInfo: {
      useSOLBalance: false, // if wish to use existed wsol token account, pass false
    },
    remainingAccounts,
    associatedOnly: true,
    checkCreateATAOwner: false,
    txVersion: TX_VERSION,
  });

  const innerInstructions: TransactionInstruction[] =
    builder.AllTxData.instructions;
  const alts: string[] = builder.AllTxData.lookupTableAddress;
  const outAmount = minAmountOut.amount.raw.toNumber();

  return { innerInstructions, alts, outAmount };
};
