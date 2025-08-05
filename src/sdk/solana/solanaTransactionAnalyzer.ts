import { DEX_PROGRAMS } from "../../config/constant";
import {
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  ParsedInstruction,
  ParsedInnerInstruction,
  ParsedAddressTableLookup,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { SwapInfo } from "../../utils/types";
import { solanaWeb3Service } from "./solanaWeb3Service";

const extractPoolId = async (
  instruction: ParsedInstruction | PartiallyDecodedInstruction
): Promise<string> => {
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
    // case DEX_PROGRAMS.METEORA_AMM:
    //   return instruction.accounts[0].toBase58();
    case DEX_PROGRAMS.METEORA_DLMM:
      return instruction.accounts[0].toBase58();
    // case DEX_PROGRAMS.METEORA_DAMM_V2:
    //   return instruction.accounts[1].toBase58();
    default:
      throw new Error(`Unknown DEX program ID: ${programId}`);
  }
};

const fetchAddressLookupTableAccounts = async (
  alts: ParsedAddressTableLookup[] | null | undefined
): Promise<AddressLookupTableAccount[]> => {
  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
  const accounts = alts?.map((account) => account.accountKey);
  if (accounts && accounts?.length > 0) {
    await Promise.all(
      accounts.map(async (account) => {
        const alt = await solanaWeb3Service.getAddressLookupTable(account);
        addressLookupTableAccounts.push(alt);
      })
    );
  }
  return addressLookupTableAccounts;
};

const fetchTokenMint = async (tokenInfo: any): Promise<string> => {
  let tokenMint: string;
  if ("mint" in tokenInfo) {
    tokenMint = tokenInfo.mint;
  } else {
    const { tokenAddress } =
      await solanaWeb3Service.getTokenAddressAndOwnerFromTokenAccount(
        tokenInfo.source
      );
    tokenMint = tokenAddress;
  }
  return tokenMint;
};

const fetchSwapInfos = async (
  innerInstructions: ParsedInnerInstruction[]
): Promise<SwapInfo[]> => {
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
          const [sourceTokenMint, destinationTokenMint, poolId] =
            await Promise.all([
              fetchTokenMint(sourceToken),
              fetchTokenMint(destinationToken),
              extractPoolId(instructions[j]),
            ]);

          const swapInfo: SwapInfo = {
            programId,
            poolId,
            sourceTokenMint,
            destinationTokenMint,
          };

          swapInfos.push(swapInfo);

          j += 2; // Skip the next two instructions as they are part of the swap
        }
      }
    }
  }

  return swapInfos;
};

export const transactionAnalyzer = async (
  transaction: ParsedTransactionWithMeta
): Promise<{
  swapInfos: SwapInfo[];
  addressLookupTableAccounts: AddressLookupTableAccount[];
}> => {
  try {
    const innerInstructions = transaction.meta?.innerInstructions;
    const alts = transaction.transaction.message.addressTableLookups;

    if (!innerInstructions || innerInstructions.length === 0) {
      throw new Error("No inner instructions found in the transaction.");
    }

    const [swapInfos, addressLookupTableAccounts] = await Promise.all([
      fetchSwapInfos(innerInstructions),
      fetchAddressLookupTableAccounts(alts),
    ]);

    const swapInfoLength = swapInfos.length;

    if (swapInfoLength === 0) {
      throw new Error("No swap information found in the transaction.");
    }

    if (
      swapInfos[0].sourceTokenMint !== NATIVE_MINT.toBase58() ||
      swapInfos[swapInfoLength - 1].destinationTokenMint !==
        NATIVE_MINT.toBase58()
    ) {
      throw new Error(
        "Transaction must start with a native token and end with a native token."
      );
    }

    for (let i = 0; i < swapInfoLength - 1; i++) {
      if (
        swapInfos[i].destinationTokenMint !== swapInfos[i + 1].sourceTokenMint
      ) {
        throw new Error(
          "Swap transaction must be chained together with matching token mints."
        );
      }
    }

    return { swapInfos, addressLookupTableAccounts };
  } catch (error: any) {
    throw new Error(`Error analyzing transaction: ${error.message}`);
  }
};
