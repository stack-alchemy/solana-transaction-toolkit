import { swap as raydiumAMMSwap } from "../sdk/raydium/raydium_amm";
import { swap as raydiumClmmSwap } from "../sdk/raydium/raydium_clmm";
import { swap as raydiumCpmmSwap } from "../sdk/raydium/raydium_cpmm";
import { swap as MeteoraDLMMSwap } from "../sdk/meteora/meteora_dlmm";
import { DEX_PROGRAMS } from "../config/constant";

export function getSwapFunction(programId: string) {
  if (programId === DEX_PROGRAMS.RAYDIUM_CLMM) {
    return raydiumClmmSwap;
  }
  if (programId === DEX_PROGRAMS.RAYDIUM_CPMM) {
    return raydiumCpmmSwap;
  }
  if (programId === DEX_PROGRAMS.RAYDIUM_AMM) {
    return raydiumAMMSwap;
  }
  if (programId === DEX_PROGRAMS.METEORA_DLMM) {
    return MeteoraDLMMSwap;
  }
  throw new Error(`Unknown programId: ${programId}`);
}
