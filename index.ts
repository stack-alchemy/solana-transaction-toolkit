import { PRIVATE_KEY } from "./src/config/config";
import { solanaWeb3Service } from "./src/sdk/solana/solanaWeb3Service";
import { transactionAnalyzer } from "./src/sdk/solana/solanaTransactionAnalyzer";
import { logger } from "./src/logger/logger";
import { getRaydiumAMMSwapInstructions, getRaydiumCPMMSwapInstructions } from "./src/sdk/raydium/raydium_amm_cpmm";

(async () => {
  console.time("Transaction Analysis");
//   const transaction = await solanaWeb3Service.getTransaction("JY1hfqTWebSG7pSdHrdgKhfaY2QBhd85mVzgKMY5oEQxkZC3YyEedrC5ZJdvm5Q9dZjxo7h9WMNsBRhL4samurp");
//   const swapInfos = await transactionAnalyzer(transaction)
//   console.log(swapInfos);

  const poolId = "D6bmarrDVAqxmwP9TxfgQb4aor93S126hL9oV5ziCcdC";
  const inputMint = "So11111111111111111111111111111111111111112";
  const outputMint = "Bf5uwQqUmtHLPYmGvs4z3Y56QtXgv6ApwQWo4aVrbonk";
  const owner = "HJdXLsg3YjJCoRXiSqUn9RJh8fSpw6Lcwa56LuvzFpez";
  const amount = 100000;
  const computeBudgetInstructions =
    await solanaWeb3Service.getComputeBudgetInstruction();
  const { innerTransaction, amountOut } = await getRaydiumCPMMSwapInstructions(
    poolId,
    owner,
    inputMint,
    outputMint,
    amount
  );
  const instructions = [
    ...computeBudgetInstructions,
    ...innerTransaction.instructions,
  ];
  const signature = await solanaWeb3Service.sendTransaction(instructions, []);
  console.log(innerTransaction, "instructions");
  console.log("Amount Out:", amountOut.toExact());
  console.log("Signature:", signature);

//   const tokenAccount = await solanaWeb3Service.createTokenAccount(outputMint)
//   console.log(tokenAccount)
  console.timeEnd("Transaction Analysis");
})();
