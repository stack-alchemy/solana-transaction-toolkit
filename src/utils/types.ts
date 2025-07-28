export interface TokenAmount {
  amount: number;
  decimals: number;
  uiAmount: number;
  uiAmountString: string;
}

export interface SwapInfo {
  programId: string;
  poolId: string;
  sourceTokenMint: string;
  destinationTokenMint: string;
  sourceTokenAmount: TokenAmount;
  destinationTokenAmount: TokenAmount;
}
