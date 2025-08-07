import { initBot, copyTransaction } from "./src/bot/bot";
import { WS_ENDPOINT, TARGET_WALLET, RPC_ENDPOINT } from "./src/config/config";
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { logger } from "./src/logger/logger";

// import { solanaWeb3Service } from "./src/sdk/solana/solanaWeb3Service";
// import { transactionAnalyzer } from "./src/sdk/solana/solanaTransactionAnalyzer";
// import { swap as MeteoraDLMMSwap } from "./src/sdk/meteora/meteora_dlmm";

const main = async (
  signature: string,
  computeBudgetInstructions: TransactionInstruction[]
) => {
  try {
    await copyTransaction(signature, computeBudgetInstructions);
  } catch (error: any) {
    if (
      !error.message.includes("Unknown DEX") &&
      !error.message.includes("No inner instructions") &&
      !error.message.includes("No swap information")
    ) {
      logger.error(`${signature}: ${error.message}`);
    }
  }
};

const run = async () => {
  const connection = new Connection(RPC_ENDPOINT, {
    wsEndpoint: WS_ENDPOINT,
    commitment: "confirmed",
  });
  const targetWallet = new PublicKey(TARGET_WALLET);
  const computeBudgetInstructions = await initBot();

  connection.onLogs(
    targetWallet,
    async (logs, context) => {
      if (logs.err) {
        // console.error(`Error in transaction: ${logs.err}`);
        return;
      }
      const signature = logs.signature;
      await main(signature, computeBudgetInstructions);
    },
    "confirmed"
  );
};

// run();

(async () => {
const signature =
  "34dBhKUTg2LPctK567EisdaoYHAZUYivuxoV5XNDqx3LE42sgdoNd6QJtzZJ7kDDq4Syidj9tdCt6dGK1DgK7j8M";
//   const transaction = await solanaWeb3Service.getTransaction(signature);
//   const { swapInfos, addressLookupTableAccounts } = await transactionAnalyzer(
//     transaction
//   );
//   console.log(swapInfos);
// await solanaWeb3Service.getAllTokenAccounts();
// const instructions: TransactionInstruction[] = [];
const computeBudgetInstructions = await initBot();
await main(signature, computeBudgetInstructions);

// instructions.push(...computeBudgetInstructions);
// const swapResult = await MeteoraDLMMSwap(
//   "D9rdsFBGYAvwLCekxNKoZG2kyPyVXD9o2Wbn3jTGbonk",
//   "8DFCXWs8tXHt6PDFqaoqQG6VmtrPQNw2TBYZ2VFhFAQi",
//   192.692426 * 1e6
// );
// console.log(swapResult);
// instructions.push(...swapResult.innerInstructions);
// const sig = await solanaWeb3Service.sendTransaction(instructions, []);
// console.log(sig);

// const instructions: TransactionInstruction[] = [];
// const computeBudgetInstructions =
//   await solanaWeb3Service.getComputeBudgetInstruction();
// instructions.push(...computeBudgetInstructions);
// const {createInstruction, closeInstruction} = await solanaWeb3Service.createTokenAccount("D9rdsFBGYAvwLCekxNKoZG2kyPyVXD9o2Wbn3jTGbonk")
// instructions.push(createInstruction);
// instructions.push(closeInstruction);
// const sig = await solanaWeb3Service.sendTransaction(instructions, [])
// console.log(sig)

// const accounts = await solanaWeb3Service.getAllTokenAccounts();
// console.log(accounts)

// const tokenAccount = await solanaWeb3Service.closeTokenAccount("9NFEfLVZgNsMjdQZ3UyYzFq61KzuZgUqS8vHF9NuYc1G")
// console.log(tokenAccount)
// console.log(solanaWeb3Service.tokenAccounts)
})();
