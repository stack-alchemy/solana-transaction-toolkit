import DLMM, {
  ActionType,
  MEMO_PROGRAM_ID,
  BinArrayAccount,
} from "@meteora-ag/dlmm";
import {
  AccountMeta,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import { solanaWeb3Service } from "../solana/solanaWeb3Service";
import { SLIPPAGE_TOLERANCE } from "../../config/constant";

export class MeteoraDLMMSwap {
  private dlmmPool: DLMM | undefined;
  private binArrays: BinArrayAccount[] | undefined;
  private swapYtoX: boolean | undefined;

  constructor() {}

  public async init(inputMint: string, poolId: string): Promise<void> {
    try {
      const poolPubKey = new PublicKey(poolId);
      const dlmmPool = await DLMM.create(
        solanaWeb3Service.connection,
        poolPubKey
      );
      const swapYtoX =
        inputMint === dlmmPool.tokenY.publicKey.toBase58() ? true : false;
      const binArrays = await dlmmPool.getBinArrayForSwap(swapYtoX);
      this.dlmmPool = dlmmPool;
      this.binArrays = binArrays;
      this.swapYtoX = swapYtoX;
      return;
    } catch (error: any) {
      throw new Error(`Error in Meteora DLMM init: ${error.message}`);
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
      if (!this.dlmmPool || !this.binArrays || this.swapYtoX === undefined) {
        throw new Error("Meteora DLMM not initialized");
      }

      const inputAmount = new BN(amount);
      const slippage = new BN(SLIPPAGE_TOLERANCE);
      const swapQuote = await this.dlmmPool.swapQuote(
        inputAmount,
        !this.swapYtoX,
        slippage,
        this.binArrays
      );

      const inToken = this.swapYtoX
        ? this.dlmmPool.tokenY.publicKey
        : this.dlmmPool.tokenX.publicKey;
      const outToken = this.swapYtoX
        ? this.dlmmPool.tokenX.publicKey
        : this.dlmmPool.tokenY.publicKey;

      const inTokenAccount = tokenAccounts.get(inToken.toBase58());
      const outTokenAccount = tokenAccounts.get(outToken.toBase58());

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
        await this.dlmmPool.getPotentialToken2022IxDataAndAccounts(
          ActionType.Liquidity
        );

      const swapIx = await this.dlmmPool.program.methods
        .swap2(inputAmount, swapQuote.minOutAmount, { slices })
        .accountsPartial({
          lbPair: this.dlmmPool.pubkey,
          reserveX: this.dlmmPool.lbPair.reserveX,
          reserveY: this.dlmmPool.lbPair.reserveY,
          tokenXMint: this.dlmmPool.lbPair.tokenXMint,
          tokenYMint: this.dlmmPool.lbPair.tokenYMint,
          tokenXProgram: this.dlmmPool.tokenX.owner,
          tokenYProgram: this.dlmmPool.tokenY.owner,
          user: solanaWeb3Service.userAddress,
          userTokenIn: inTokenAccount,
          userTokenOut: outTokenAccount,
          binArrayBitmapExtension: this.dlmmPool.binArrayBitmapExtension
            ? this.dlmmPool.binArrayBitmapExtension.publicKey
            : null,
          oracle: this.dlmmPool.lbPair.oracle,
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
      throw new Error(`Error in Meteora DLMM swap: ${error.message}`)
    }
  }
}

// export const swap = async (
//   inputMint: string,
//   poolId: string,
//   amount: number
// ): Promise<{
//   innerInstructions: TransactionInstruction[];
//   outAmount: number;
// }> => {
//   try {
//     const connection = solanaWeb3Service.connection;
//     const inputAmount = new BN(amount);
//     const slippage = new BN(SLIPPAGE_TOLERANCE);
//     const poolPubKey = new PublicKey(poolId);
//     const dlmmPool = await DLMM.create(connection, poolPubKey);
//     const swapYtoX =
//       inputMint === dlmmPool.tokenY.publicKey.toBase58() ? true : false;
//     const binArrays = await dlmmPool.getBinArrayForSwap(swapYtoX);
//     const swapQuote = await dlmmPool.swapQuote(
//       inputAmount,
//       !swapYtoX,
//       slippage,
//       binArrays
//     );

//     const [inToken, outToken] = swapYtoX
//       ? [dlmmPool.tokenY.publicKey, dlmmPool.tokenX.publicKey]
//       : [dlmmPool.tokenX.publicKey, dlmmPool.tokenY.publicKey];

//     const [inTokenAccount, outTokenAccount] = [
//       solanaWeb3Service.tokenAccounts.get(inToken.toBase58()),
//       solanaWeb3Service.tokenAccounts.get(outToken.toBase58()),
//     ];

//     const accountArrays: AccountMeta[] = swapQuote.binArraysPubkey.map(
//       (pubkey) => {
//         return {
//           isSigner: false,
//           isWritable: true,
//           pubkey,
//         };
//       }
//     );

//     const { slices, accounts: transferHookAccounts } =
//       await dlmmPool.getPotentialToken2022IxDataAndAccounts(
//         ActionType.Liquidity
//       );

//     const swapIx = await dlmmPool.program.methods
//       .swap2(inputAmount, swapQuote.minOutAmount, { slices })
//       .accountsPartial({
//         lbPair: dlmmPool.pubkey,
//         reserveX: dlmmPool.lbPair.reserveX,
//         reserveY: dlmmPool.lbPair.reserveY,
//         tokenXMint: dlmmPool.lbPair.tokenXMint,
//         tokenYMint: dlmmPool.lbPair.tokenYMint,
//         tokenXProgram: dlmmPool.tokenX.owner,
//         tokenYProgram: dlmmPool.tokenY.owner,
//         user: solanaWeb3Service.userAddress,
//         userTokenIn: inTokenAccount,
//         userTokenOut: outTokenAccount,
//         binArrayBitmapExtension: dlmmPool.binArrayBitmapExtension
//           ? dlmmPool.binArrayBitmapExtension.publicKey
//           : null,
//         oracle: dlmmPool.lbPair.oracle,
//         hostFeeIn: null,
//         memoProgram: MEMO_PROGRAM_ID,
//       })
//       .remainingAccounts(transferHookAccounts)
//       .remainingAccounts(accountArrays)
//       .instruction();

//     const innerInstructions: TransactionInstruction[] = [swapIx];
//     const outAmount = swapQuote.outAmount.toNumber();

//     return { innerInstructions, outAmount };
//   } catch (error: any) {
//     throw new Error(`Error in Meteora DLMM swap: ${error.message}`);
//   }
// };
