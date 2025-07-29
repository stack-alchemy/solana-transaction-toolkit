import {
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  CpmmRpcData,
  CurveCalculator,
  makeSwapCpmmBaseInInstruction,
} from "@raydium-io/raydium-sdk-v2";
import { raydiumInstance } from "./config";
import BN from "bn.js";
import { isValidCpmm, getPdaObservationId } from "./utils";
import { TransactionInstruction, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

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

  let poolInfo: ApiV3PoolInfoStandardItemCpmm | undefined;

  const [data, poolKeys, rpcData] = await Promise.all([
    raydium.api.fetchPoolById({ ids: poolId }),
    raydium.cpmm.getCpmmPoolKeys(poolId),
    raydium.cpmm.getRpcPoolInfo(poolId, true),    
  ])
  poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm;

  if (!isValidCpmm(poolInfo.programId))
    throw new Error("target pool is not CPMM pool");

  if (
    poolInfo.mintA.address !== inputMint &&
    poolInfo.mintB.address !== inputMint
  )
    throw new Error("input mint does not match pool");

  const [mintA, mintB] = [
    new PublicKey(poolInfo.mintA.address),
    new PublicKey(poolInfo.mintB.address),
  ];

  const [mintATokenAccount, mintBTokenAccount] = await Promise.all([
    raydium.account.getAssociatedTokenAccount(
      new PublicKey(poolInfo.mintA.address)
    ),
    raydium.account.getAssociatedTokenAccount(
      new PublicKey(poolInfo.mintB.address)
    ),
  ]);

  const baseIn = inputMint === poolInfo.mintA.address;

  const swapResult = CurveCalculator.swap(
    inputAmount,
    baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
    baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
    rpcData.configInfo!.tradeFeeRate
  );

  const instruction: TransactionInstruction = makeSwapCpmmBaseInInstruction(
    new PublicKey(poolInfo.programId),
    raydium.owner?.publicKey!,
    new PublicKey(poolKeys.authority),
    new PublicKey(poolKeys.config.id),
    new PublicKey(poolInfo.id),
    baseIn ? mintATokenAccount! : mintBTokenAccount!,
    baseIn ? mintBTokenAccount! : mintATokenAccount!,
    new PublicKey(poolKeys.vault[baseIn ? "A" : "B"]),
    new PublicKey(poolKeys.vault[baseIn ? "B" : "A"]),
    new PublicKey(
      poolInfo[baseIn ? "mintA" : "mintB"].programId ?? TOKEN_PROGRAM_ID
    ),
    new PublicKey(
      poolInfo[baseIn ? "mintB" : "mintA"].programId ?? TOKEN_PROGRAM_ID
    ),
    baseIn ? mintA : mintB,
    baseIn ? mintB : mintA,
    getPdaObservationId(
      new PublicKey(poolInfo.programId),
      new PublicKey(poolInfo.id)
    ).publicKey,
    inputAmount,
    swapResult.destinationAmountSwapped
  );

  const innerInstructions: TransactionInstruction[] = [instruction];
  const alts: string[] = [];
  const outAmount = swapResult.destinationAmountSwapped.toNumber();

  return { innerInstructions, alts, outAmount };
};
