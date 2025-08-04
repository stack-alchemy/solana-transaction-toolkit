import { solanaWeb3Service } from "../sdk/solana/solanaWeb3Service";
import { transactionAnalyzer } from "../sdk/solana/solanaTransactionAnalyzer";
import { raydiumInstance } from "../sdk/raydium/config";
import { getSwapFunction } from "../utils/helper";
import { logger } from "../logger/logger";
import { TransactionInstruction } from "@solana/web3.js";

export const initBot = async (): Promise<TransactionInstruction[]> => {
  try {
    logger.info("Initializing bot...");
    await raydiumInstance.getInstance();
    await solanaWeb3Service.getAllTokenAccounts();
    const computeBudgetInstructions =
      await solanaWeb3Service.getComputeBudgetInstruction();
    logger.info("Bot initialized successfully.");
    return computeBudgetInstructions;
  } catch (error: any) {
    throw new Error(`Failed to initialize bot: ${error.message}`);
  }
};

export const copyTransaction = async (
  signature: string,
  computeBudgetInstructions: TransactionInstruction[]
): Promise<void> => {
  try {
    // console.time("Transaction Copying");
    const instructions: TransactionInstruction[] = [...computeBudgetInstructions];
    const transaction = await solanaWeb3Service.getTransaction(signature);
    const { swapInfos, addressLookupTableAccounts } = await transactionAnalyzer(
      transaction
    );
    await solanaWeb3Service.getAllTokenAccounts();

    const tokenMints = new Set<string>();
    swapInfos.forEach((info) => {
      tokenMints.add(info.sourceTokenMint);
      tokenMints.add(info.destinationTokenMint);
    });

    const missedTokenAccounts: string[] = Array.from(tokenMints).filter(
      (mint) => !solanaWeb3Service.tokenAccounts.has(mint)
    );

    if (missedTokenAccounts.length > 0) {
      const createInstructions = await Promise.all(
        missedTokenAccounts.map((mint) =>
          solanaWeb3Service.createTokenAccount(mint)
        )
      );
      instructions.push(...createInstructions);
    }

    let inputAmount = 0.001 * 1e9; // Use raw amount for first swap
    let initInputAmount = inputAmount;
    let lastSwapOutputAmount: number = 0;

    for (let i = 0; i < swapInfos.length; i++) {
      const { programId, poolId, sourceTokenMint } = swapInfos[i];
      const swapFn = getSwapFunction(programId);

      // For subsequent swaps, use previous output as input
      if (i > 0) {
        inputAmount = lastSwapOutputAmount;
      }

      const swapResult = await swapFn(sourceTokenMint, poolId, inputAmount);

      instructions.push(...swapResult.innerInstructions);
      lastSwapOutputAmount = swapResult.outAmount;
    }

    if (initInputAmount > lastSwapOutputAmount) {
      throw new Error(
        `Insufficient output amount: ${lastSwapOutputAmount} < ${initInputAmount}`)
    }

    const txHash = await solanaWeb3Service.sendTransaction(
      instructions,
      addressLookupTableAccounts
    );
    // console.timeEnd("Transaction Copying");

    await solanaWeb3Service.getAllTokenAccounts();

    logger.info("Transaction copied successfully:", txHash);
  } catch (error: any) {
    throw new Error(error.message);
  }
};
