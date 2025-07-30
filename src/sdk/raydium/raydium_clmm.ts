import {
  ApiV3PoolInfoConcentratedItem,
  ClmmKeys,
  ComputeClmmPoolInfo,
  PoolUtils,
  ReturnTypeFetchMultiplePoolTickArrays,
  ClmmInstrument,
  MIN_SQRT_PRICE_X64,
  MAX_SQRT_PRICE_X64,
} from "@raydium-io/raydium-sdk-v2";
import { raydiumInstance, TX_VERSION } from "./config";
import { SLIPPAGE_TOLERANCE } from "../../config/constant";
import BN from "bn.js";
import { isValidClmm } from "./utils";
import { TransactionInstruction, PublicKey } from "@solana/web3.js";
import { solanaWeb3Service } from "../solana/solanaWeb3Service";

export const swap = async (
  inputMint: string,
  poolId: string,
  amount: number
): Promise<{
  innerInstructions: TransactionInstruction[];
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
  const sqrtPriceLimitX64 = baseIn
    ? MIN_SQRT_PRICE_X64.add(new BN(1))
    : MAX_SQRT_PRICE_X64.sub(new BN(1));
  const tokenAccountA = solanaWeb3Service.tokenAccounts.get(
    poolInfo.mintA.address
  );
  const tokenAccountB = solanaWeb3Service.tokenAccounts.get(
    poolInfo.mintB.address
  );
  if (!tokenAccountA || !tokenAccountB) {
    throw new Error("Associated token accounts not found for the pool mints");
  }

  const { minAmountOut, remainingAccounts } =
    await PoolUtils.computeAmountOutFormat({
      poolInfo: clmmPoolInfo,
      tickArrayCache: tickCache[poolId],
      amountIn: inputAmount,
      tokenOut: poolInfo[baseIn ? "mintB" : "mintA"],
      slippage: SLIPPAGE_TOLERANCE,
      epochInfo: await raydium.fetchEpochInfo(),
    });

  const { instructions } = ClmmInstrument.makeSwapBaseInInstructions({
    poolInfo,
    poolKeys,
    observationId: clmmPoolInfo.observationId,
    ownerInfo: {
      wallet: raydium.owner?.publicKey!,
      tokenAccountA: tokenAccountA!,
      tokenAccountB: tokenAccountB!,
    },
    inputMint: new PublicKey(inputMint),
    amountIn: inputAmount,
    amountOutMin: minAmountOut.amount.raw,
    sqrtPriceLimitX64,
    remainingAccounts,
  });

  const innerInstructions: TransactionInstruction[] = instructions;
  const outAmount = minAmountOut.amount.raw.toNumber();

  return { innerInstructions, outAmount };
};
