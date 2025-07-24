import { Commitment } from "@solana/web3.js";

export const PROCESSED = "processed" as Commitment;
export const CONFIRMED = "confirmed" as Commitment;
export const FINALIZED = "finalized" as Commitment;

export const DEX_PROGRAMS = {
  RAYDIUM_AMM: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  RAYDIUM_CLMM: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  RAYDIUM_CPMM: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
  METEORA_AMM: "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
  METEORA_DLMM: "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
  METEORA_DAMM_V2: "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG",
};
