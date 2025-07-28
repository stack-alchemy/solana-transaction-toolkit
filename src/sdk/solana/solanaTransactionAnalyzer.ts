import { DEX_PROGRAMS } from "../../config/constant";
import {
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  ParsedInstruction,
} from "@solana/web3.js";
import { SwapInfo, TokenAmount } from "../../utils/types";
import { solanaWeb3Service } from "./solanaWeb3Service";

const extractPoolId = (
  instruction: ParsedInstruction | PartiallyDecodedInstruction
): string => {
  if ("parsed" in instruction) {
    throw new Error(
      "Parsed instruction is not supported for pool ID extraction."
    );
  }

  const programId = instruction.programId.toBase58();
  switch (programId) {
    case DEX_PROGRAMS.RAYDIUM_AMM:
      return instruction.accounts[1].toBase58();
    case DEX_PROGRAMS.RAYDIUM_CLMM:
      return instruction.accounts[2].toBase58();
    case DEX_PROGRAMS.RAYDIUM_CPMM:
      return instruction.accounts[3].toBase58();
    case DEX_PROGRAMS.METEORA_AMM:
      return instruction.accounts[0].toBase58();
    case DEX_PROGRAMS.METEORA_DLMM:
      return instruction.accounts[0].toBase58();
    case DEX_PROGRAMS.METEORA_DAMM_V2:
      return instruction.accounts[1].toBase58();
    default:
      throw new Error(`Unknown DEX program ID: ${programId}`);
  }
};

export const transactionAnalyzer = async (
  transaction: ParsedTransactionWithMeta
): Promise<SwapInfo[]> => {
  try {
    const innerInstructions = transaction.meta?.innerInstructions;
    if (!innerInstructions || innerInstructions.length === 0) {
      throw new Error("No inner instructions found in the transaction.");
    }

    const swapInfos: SwapInfo[] = [];

    for (let i = 0; i < innerInstructions.length; i++) {
      if (!innerInstructions[i] || !innerInstructions[i].instructions) {
        continue;
      }

      const instructions = innerInstructions[i].instructions;
      for (let j = 0; j < instructions.length; j++) {
        const programId = instructions[j].programId.toBase58();
        if (Object.values(DEX_PROGRAMS).includes(programId)) {
          const sourceToken = (instructions[j + 1] as any)?.parsed?.info;
          const destinationToken = (instructions[j + 2] as any)?.parsed?.info;

          if (sourceToken && destinationToken) {
            let sourceTokenMint: string, sourceTokenAmount: TokenAmount;
            if ("mint" in sourceToken) {
              sourceTokenMint = sourceToken.mint;
              sourceTokenAmount = sourceToken.tokenAmount;
            } else {
              const { tokenAddress } =
                await solanaWeb3Service.getTokenAddressAndOwnerFromTokenAccount(
                  sourceToken.source
                );
              sourceTokenMint = tokenAddress;
              const sourceTokenDecimals =
                await solanaWeb3Service.getTokenDecimals(sourceTokenMint);
              sourceTokenAmount = {
                amount: sourceToken.amount,
                decimals: sourceTokenDecimals,
                uiAmount: sourceToken.amount / 10 ** sourceTokenDecimals,
                uiAmountString: String(
                  sourceToken.amount / 10 ** sourceTokenDecimals
                ),
              };
            }

            let destinationTokenMint: string,
              destinationTokenAmount: TokenAmount;
            if ("mint" in destinationToken) {
              destinationTokenMint = destinationToken.mint;
              destinationTokenAmount = destinationToken.tokenAmount;
            } else {
              const { tokenAddress } =
                await solanaWeb3Service.getTokenAddressAndOwnerFromTokenAccount(
                  destinationToken.destination
                );
              destinationTokenMint = tokenAddress;
              const destinationTokenDecimals =
                await solanaWeb3Service.getTokenDecimals(destinationTokenMint);
              destinationTokenAmount = {
                amount: destinationToken.amount,
                decimals: destinationTokenDecimals,
                uiAmount:
                  destinationToken.amount / 10 ** destinationTokenDecimals,
                uiAmountString: String(
                  destinationToken.amount / 10 ** destinationTokenDecimals
                ),
              };
            }

            const poolId = extractPoolId(instructions[j]);
            if (!poolId) {
              throw new Error("Pool ID could not be extracted from the instruction.");
            }

            const swapInfo: SwapInfo = {
              programId,
              poolId,
              sourceTokenMint,
              destinationTokenMint,
              sourceTokenAmount,
              destinationTokenAmount,
            };

            swapInfos.push(swapInfo);

            j += 2; // Skip the next two instructions as they are part of the swap
          }
        }
      }
    }

    if (swapInfos.length === 0) {
      throw new Error("No swap information found in the transaction.");
    }

    return swapInfos;
  } catch (error: any) {
    throw new Error(`Error analyzing transaction: ${error.message}`);
  }
};
