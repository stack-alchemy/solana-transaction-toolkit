import {
  ApiV3PoolInfoStandardItem,
  makeAMMSwapInstruction,
} from "@raydium-io/raydium-sdk-v2";
import { raydiumInstance } from "./config";
import { SLIPPAGE_TOLERANCE } from "../../config/constant";
import BN from "bn.js";
import { isValidAmm } from "./utils";
import { TransactionInstruction } from "@solana/web3.js";
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

  const mintInTokenAccount = solanaWeb3Service.tokenAccounts.get(
    mintIn.address
  );
  const mintOutTokenAccount = solanaWeb3Service.tokenAccounts.get(
    mintOut.address
  );
  if (!mintInTokenAccount || !mintOutTokenAccount) {
    throw new Error("Associated token accounts not found for the pool mints");
  }

  const out = await raydium.liquidity.computeAmountOut({
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

  let version = 4;
  if (poolInfo.pooltype.includes("StablePool")) version = 5;

  const amountIn = new BN(amount)
  const amountOut = out.minAmountOut

  const instruction = await makeAMMSwapInstruction({
    version,
    poolKeys,
    userKeys: {
      tokenAccountIn: mintInTokenAccount!,
      tokenAccountOut: mintOutTokenAccount!,
      owner: raydium.owner?.publicKey!,
    },
    amountIn,
    amountOut,
    fixedSide: "in",
  });

  const innerInstructions: TransactionInstruction[] = [instruction];
  const outAmount = out.amountOut.toNumber();

  return { innerInstructions, outAmount };
};
