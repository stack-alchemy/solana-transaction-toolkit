import {
  ApiV3PoolInfoStandardItem,
} from "@raydium-io/raydium-sdk-v2";
import { raydiumInstance, TX_VERSION } from "./config";
import { SLIPPAGE_TOLERANCE } from "../../config/constant";
import BN from "bn.js";
import { isValidAmm } from "./utils";
import {
  TransactionInstruction,
} from "@solana/web3.js";

export const swap = async (
  inputMint: string,
  poolId: string,
  amount: number
): Promise<{ innerInstructions: TransactionInstruction[]; alts: string[]; outAmount: number }> => {
  const raydium = await raydiumInstance.getInstance();

  const [data, poolKeys, rpcData] = await Promise.all([
    raydium.api.fetchPoolById({ ids: poolId }),
    raydium.liquidity.getAmmPoolKeys(poolId),
    raydium.liquidity.getRpcPoolInfo(poolId),
  ]);
  const poolInfo = data[0] as ApiV3PoolInfoStandardItem;

  if (!isValidAmm(poolInfo.programId))
    throw new Error("target pool is not AMM pool");

  const [baseReserve, quoteReserve, status] = [
    rpcData.baseReserve,
    rpcData.quoteReserve,
    rpcData.status.toNumber(),
  ];

  if (
    poolInfo.mintA.address !== inputMint &&
    poolInfo.mintB.address !== inputMint
  )
    throw new Error("input mint does not match pool");

  const baseIn = inputMint === poolInfo.mintA.address;
  const [mintIn, mintOut] = baseIn
    ? [poolInfo.mintA, poolInfo.mintB]
    : [poolInfo.mintB, poolInfo.mintA];

  const out = raydium.liquidity.computeAmountOut({
    poolInfo: {
      ...poolInfo,
      baseReserve,
      quoteReserve,
      status,
      version: 4,
    },
    amountIn: new BN(amount),
    mintIn: mintIn.address,
    mintOut: mintOut.address,
    slippage: SLIPPAGE_TOLERANCE, // range: 1 ~ 0.0001, means 100% ~ 0.01%
  });
  
  const { builder } = await raydium.liquidity.swap({
    poolInfo,
    poolKeys,
    amountIn: new BN(amount),
    amountOut: out.minAmountOut, // out.amountOut means amount 'without' slippage
    fixedSide: "in",
    inputMint: mintIn.address,
    txVersion: TX_VERSION,
    config: {
      associatedOnly: true,
      inputUseSolBalance: false,
      outputUseSolBalance: false
    }
  });

  const innerInstructions: TransactionInstruction[] = builder.AllTxData.instructions;
  const alts: string[] = builder.AllTxData.lookupTableAddress;
  const outAmount = out.amountOut.toNumber()

  return { innerInstructions, alts, outAmount };
};
