import { RaydiumAMMSwap } from "../sdk/raydium/raydium_amm";
import { RaydiumCLMMSwap } from "../sdk/raydium/raydium_clmm";
import { RaydiumCPMMSwap } from "../sdk/raydium/raydium_cpmm";
import { MeteoraDLMMSwap } from "../sdk/meteora/meteora_dlmm";
import { DEX_PROGRAMS } from "../config/constant";

export function getSwapInstance(programId: string) {
  if (programId === DEX_PROGRAMS.RAYDIUM_CLMM) {
    return new RaydiumCLMMSwap();
  }
  if (programId === DEX_PROGRAMS.RAYDIUM_CPMM) {
    return new RaydiumCPMMSwap();
  }
  if (programId === DEX_PROGRAMS.RAYDIUM_AMM) {
    return new RaydiumAMMSwap();
  }
  if (programId === DEX_PROGRAMS.METEORA_DLMM) {
    return new MeteoraDLMMSwap();
  }
  throw new Error(`Unknown programId: ${programId}`);
}
