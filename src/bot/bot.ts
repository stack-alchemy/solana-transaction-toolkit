import { solanaWeb3Service } from "../sdk/solana/solanaWeb3Service";
import { transactionAnalyzer } from "../sdk/solana/solanaTransactionAnalyzer";
import { raydiumInstance } from "../sdk/raydium/config";
import { getSwapInstance } from "../utils/helper";
import { logger } from "../logger/logger";
import { TransactionInstruction, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";

export const initBot = async (): Promise<TransactionInstruction[]> => {
  try {
    logger.info("Initializing bot...");
    await raydiumInstance.getInstance();
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
    const instructions: TransactionInstruction[] = [
      ...computeBudgetInstructions,
    ];
    const postInstructions: TransactionInstruction[] = [];
    const [transaction, nativeMintTokenAccount] = await Promise.all([
      solanaWeb3Service.getTransaction(signature),
      solanaWeb3Service.getTokenAccount(NATIVE_MINT.toBase58()),
    ]);
    const { swapInfos, addressLookupTableAccounts } = await transactionAnalyzer(
      transaction
    );

    const tokenMints = new Set<string>();
    const tokenAccounts: Map<string, PublicKey> = new Map();
    tokenAccounts.set(NATIVE_MINT.toBase58(), nativeMintTokenAccount);

    swapInfos.forEach((info) => {
      tokenMints.add(info.sourceTokenMint);
      tokenMints.add(info.destinationTokenMint);
    });
    tokenMints.delete(NATIVE_MINT.toBase58());

    if (tokenMints.size > 0) {
      const tokenAccountInstructions = await Promise.all(
        Array.from(tokenMints).map((mint) =>
          solanaWeb3Service.createTokenAccount(mint)
        )
      );

      tokenAccountInstructions.map((item, index) => {
        instructions.push(item.createInstruction);
        postInstructions.push(item.closeInstruction);
        tokenAccounts.set(item.mintAddress, item.tokenAccount);
      });
    }

    let inputAmount = 0.05 * 1e9; // Use raw amount for first swap
    let initInputAmount = inputAmount;
    let lastSwapOutputAmount: number = 0;

    const swapInstances = swapInfos.map(({ programId }) =>
      getSwapInstance(programId)
    );
    await Promise.all(
      swapInfos.map(({ poolId, sourceTokenMint }, i) =>
        swapInstances[i].init(sourceTokenMint, poolId)
      )
    );

    const startTime = Date.now();
    let success = false;

    while (Date.now() - startTime < 60_000) {
      // 1 minute
      inputAmount = initInputAmount;
      lastSwapOutputAmount = 0;
      instructions.length = 0; // Clear instructions if needed

      for (let i = 0; i < swapInfos.length; i++) {
        const { sourceTokenMint } = swapInfos[i];
        if (i > 0) inputAmount = lastSwapOutputAmount;

        const swapResult = await swapInstances[i].swap(
          inputAmount,
          sourceTokenMint,
          tokenAccounts
        );
        instructions.push(...swapResult.innerInstructions);
        lastSwapOutputAmount = swapResult.outAmount;
      }

      if (lastSwapOutputAmount > initInputAmount) {
        success = true;
        break;
      }
      // Optionally add a short delay here if needed
    }

    if (!success) {
      throw new Error(
        `Failed to get sufficient output after 1 minute: ${lastSwapOutputAmount} < ${initInputAmount}`
      );
    }

    instructions.push(...postInstructions);

    const txHash = await solanaWeb3Service.sendTransactionWithTip(
      instructions,
      addressLookupTableAccounts
    );
    logger.info(`${signature}: Transaction copied successfully: ${txHash}`);

    return;
  } catch (error: any) {
    throw new Error(error.message);
  }
};
