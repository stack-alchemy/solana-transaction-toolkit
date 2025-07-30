import { PRIVATE_KEY } from "./src/config/config";
import { solanaWeb3Service } from "./src/sdk/solana/solanaWeb3Service";
import { transactionAnalyzer } from "./src/sdk/solana/solanaTransactionAnalyzer";
import { logger } from "./src/logger/logger";
import { raydiumInstance } from "./src/sdk/raydium/config";
import { PublicKey, AddressLookupTableAccount, Keypair } from "@solana/web3.js";
import { closeAccount } from "@solana/spl-token";
import { swap as raydiumAMMSwap } from "./src/sdk/raydium/raydium_amm";
import { swap as raydiumClmmSwap } from "./src/sdk/raydium/raydium_clmm";
import { swap as raydiumCpmmSwap } from "./src/sdk/raydium/raydium_cpmm";

function getSwapFunction(programId: string) {
  if (programId === "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK") {
    return raydiumClmmSwap;
  }
  if (programId === "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C") {
    return raydiumCpmmSwap;
  }
  if (programId === "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8") {
    return raydiumAMMSwap;
  }
  throw new Error(`Unknown programId: ${programId}`);
}

(async () => {
  await raydiumInstance.getInstance();
  await solanaWeb3Service.getAllTokenAccounts();
  const computeBudgetInstructions =
    await solanaWeb3Service.getComputeBudgetInstruction();
  const tokenAccounts = solanaWeb3Service.tokenAccounts;
  let instructions: any[] = [...computeBudgetInstructions];

  console.time("Transaction Analysis");
  const transaction = await solanaWeb3Service.getTransaction(
    "2DSNpyFeGNJrJhK1wHXv1967EkvudccaeqVVhD3t9tKRoY4u1Kz7zmumGvnXmgJ9ArpdvLCL4YpP3UfCqSKUxSyL"
  );
  const { swapInfos, addressLookupTableAccounts } = await transactionAnalyzer(
    transaction
  );

  const tokenMints = new Set<string>();
  swapInfos.forEach((info) => {
    tokenMints.add(info.sourceTokenMint);
    tokenMints.add(info.destinationTokenMint);
  });

  const missedTokenAccounts: string[] = Array.from(tokenMints).filter(
    (mint) => !tokenAccounts.has(mint)
  );

  if (missedTokenAccounts.length > 0) {
    const createInstructions = await Promise.all(
      missedTokenAccounts.map((mint) => solanaWeb3Service.createTokenAccount(mint))
    );
    instructions.push(...createInstructions);
  }

  let inputAmount = 0.0001 * 1e9; // Use raw amount for first swap
  
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

  const signature = await solanaWeb3Service.sendTransaction(
    instructions,
    addressLookupTableAccounts
  );
  console.log("Signature:", signature);

  // const tokenAccount = await solanaWeb3Service.closeTokenAccount("BMro4xUVc91uLRtSYGSUC5zHXu2bMCqTuY7EBaAC7pXL")
  // console.log(tokenAccount)
  // console.log(solanaWeb3Service.tokenAccounts)

  console.timeEnd("Transaction Analysis");
})();
