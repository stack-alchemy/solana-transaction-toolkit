import { PRIVATE_KEY } from "./src/config/config";
import { solanaWeb3Service } from "./src/sdk/solana/solanaWeb3Service";
import { transactionAnalyzer } from "./src/sdk/solana/solanaTransactionAnalyzer";
import { logger } from "./src/logger/logger";
import { raydiumInstance } from "./src/sdk/raydium/config";
import { PublicKey, AddressLookupTableAccount } from "@solana/web3.js";
import { swap as raydiumAMMSwap } from "./src/sdk/raydium/raydium_amm";
import { swap as raydiumClmmSwap } from "./src/sdk/raydium/raydium_clmm";
import { swap as raydiumCpmmSwap } from "./src/sdk/raydium/raydium_cpmm";

(async () => {
  console.time("Transaction Analysis");
  // const transaction = await solanaWeb3Service.getTransaction("5Rece9JAAVd8oSjRFgBnixAyfRwpXjHTq4LNTDEdLYGswK55WQWzu3MB28mG5Mcr87byLfLhL8GFpgn3NrFCwerM");
  // const swapInfos = await transactionAnalyzer(transaction)
  // console.log(swapInfos);

  const poolId = "69ZvRfF9K7c9DsRTouisoeKc7G5Lm1Gz4moKgRjGhsJV";
  const inputMint = "So11111111111111111111111111111111111111112";
  const outputMint = "2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk";
  const owner = "HJdXLsg3YjJCoRXiSqUn9RJh8fSpw6Lcwa56LuvzFpez";
  const amount = 0.0001 * 1e9;
  const { innerInstructions, alts } = await raydiumCpmmSwap(
    inputMint,
    poolId,
    amount
  );
  const computeBudgetInstructions =
    await solanaWeb3Service.getComputeBudgetInstruction();
  // const { innerTransaction, amountOut } = await getRaydiumCPMMSwapInstructions(
  //   poolId,
  //   owner,
  //   inputMint,
  //   outputMint,
  //   amount
  // );
  const instructions = [...computeBudgetInstructions, ...innerInstructions];

  const addressLookupTableAccounts: AddressLookupTableAccount[] =
    await Promise.all(
      alts.map(async (alt) => {
        const pubkey = new PublicKey(alt);
        return await solanaWeb3Service.getAddressLookupTable(pubkey);
      })
    );

  console.log("Instructions:", instructions);
  console.log("Address Lookup Table Accounts:", addressLookupTableAccounts);
  const signature = await solanaWeb3Service.sendTransaction(instructions, addressLookupTableAccounts);
  console.log("Signature:", signature);

  // const tokenAccount = await solanaWeb3Service.createTokenAccount(outputMint)
  // console.log(tokenAccount)
  // const instance = await raydiumInstance.getInstance()
  // const pubkey = new PublicKey("HJdXLsg3YjJCoRXiSqUn9RJh8fSpw6Lcwa56LuvzFpez")
  // const tokenAccountData = await raydiumInstance.fetchTokenAccountData(pubkey)
  // console.log(tokenAccountData)
  console.timeEnd("Transaction Analysis");
})();
