import DLMM, { ActionType, MEMO_PROGRAM_ID } from "@meteora-ag/dlmm";
import {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import { solanaWeb3Service } from "../solana/solanaWeb3Service";
import { SLIPPAGE_TOLERANCE } from "../../config/constant";

export const swap = async (
  inputMint: string,
  poolId: string,
  amount: number
): Promise<{
  innerInstructions: TransactionInstruction[];
  outAmount: number;
}> => {
  try {
    const connection = solanaWeb3Service.connection;
    const inputAmount = new BN(amount);
    const slippage = new BN(SLIPPAGE_TOLERANCE);
    const poolPubKey = new PublicKey(poolId);
    const dlmmPool = await DLMM.create(connection, poolPubKey);
    const swapYtoX =
      inputMint === dlmmPool.tokenY.publicKey.toBase58() ? true : false;
    const binArrays = await dlmmPool.getBinArrayForSwap(swapYtoX);
    const swapQuote = await dlmmPool.swapQuote(
      inputAmount,
      !swapYtoX,
      slippage,
      binArrays
    );

    const [inToken, outToken] = swapYtoX
      ? [dlmmPool.tokenY.publicKey, dlmmPool.tokenX.publicKey]
      : [dlmmPool.tokenX.publicKey, dlmmPool.tokenY.publicKey];

    const [inTokenAccount, outTokenAccount] = [
      solanaWeb3Service.tokenAccounts.get(inToken.toBase58()),
      solanaWeb3Service.tokenAccounts.get(outToken.toBase58()),
    ];

    const accountArrays: AccountMeta[] = swapQuote.binArraysPubkey.map(
      (pubkey) => {
        return {
          isSigner: false,
          isWritable: true,
          pubkey,
        };
      }
    );

    const { slices, accounts: transferHookAccounts } =
      await dlmmPool.getPotentialToken2022IxDataAndAccounts(ActionType.Liquidity);

    const swapIx = await dlmmPool.program.methods
      .swap2(inputAmount, swapQuote.minOutAmount, { slices })
      .accountsPartial({
        lbPair: dlmmPool.pubkey,
        reserveX: dlmmPool.lbPair.reserveX,
        reserveY: dlmmPool.lbPair.reserveY,
        tokenXMint: dlmmPool.lbPair.tokenXMint,
        tokenYMint: dlmmPool.lbPair.tokenYMint,
        tokenXProgram: dlmmPool.tokenX.owner,
        tokenYProgram: dlmmPool.tokenY.owner,
        user: solanaWeb3Service.userAddress,
        userTokenIn: inTokenAccount,
        userTokenOut: outTokenAccount,
        binArrayBitmapExtension: dlmmPool.binArrayBitmapExtension
          ? dlmmPool.binArrayBitmapExtension.publicKey
          : null,
        oracle: dlmmPool.lbPair.oracle,
        hostFeeIn: null,
        memoProgram: MEMO_PROGRAM_ID,
      })
      .remainingAccounts(transferHookAccounts)
      .remainingAccounts(accountArrays)
      .instruction();

    const innerInstructions: TransactionInstruction[] = [swapIx];
    const outAmount = swapQuote.outAmount.toNumber();

    return { innerInstructions, outAmount };
  } catch (error: any) {
    throw new Error(`Error in Meteora DLMM swap: ${error.message}`);
  }
};
