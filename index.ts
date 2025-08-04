import { initBot, copyTransaction } from "./src/bot/bot";
import { WS_ENDPOINT, TARGET_WALLET, RPC_ENDPOINT } from "./src/config/config";
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { logger } from "./src/logger/logger";

// import { solanaWeb3Service } from "./src/sdk/solana/solanaWeb3Service";
// import { transactionAnalyzer } from "./src/sdk/solana/solanaTransactionAnalyzer";
// import { swap as MeteoraDLMMSwap } from "./src/sdk/meteora/meteora_dlmm";

const main = async (signature: string, computeBudgetInstructions: TransactionInstruction[]) => {
  try {
    await copyTransaction(signature, computeBudgetInstructions);
  } catch (error: any) {
    logger.error(`${signature}: ${error.message}`);
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

run()

// (async () => {
//   const signature =
//     "3aCgkGHreijjwpk6Nb1CUqpWEyW6g5Kw7n2eu3VL3i444117Phs4MfyGVyX5Kv4f967cwsgPdk4DxmuwPEzzdtDD";
//   const transaction = await solanaWeb3Service.getTransaction(signature);
//   const { swapInfos, addressLookupTableAccounts } = await transactionAnalyzer(
//     transaction
//   );
//   console.log(swapInfos);
//   await solanaWeb3Service.getAllTokenAccounts();
//   const instructions: TransactionInstruction[] = [];
//   const computeBudgetInstructions =
//     await solanaWeb3Service.getComputeBudgetInstruction();

//   await copyTransaction(signature, computeBudgetInstructions);
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
  // const res = await solanaWeb3Service.createTokenAccount("D9rdsFBGYAvwLCekxNKoZG2kyPyVXD9o2Wbn3jTGbonk")
  // instructions.push(res);
  // const sig = await solanaWeb3Service.sendTransaction(instructions, [])
  // console.log(sig)

  // await solanaWeb3Service.getAllTokenAccounts();
  // console.log(solanaWeb3Service.tokenAccounts)

  // const tokenAccount = await solanaWeb3Service.closeTokenAccount("12z2CJUQ3cVZtTvSJt1bnA5C33jvpaHQ75a28oPp5YVE")
  // console.log(tokenAccount)
  // console.log(solanaWeb3Service.tokenAccounts)
// })();
