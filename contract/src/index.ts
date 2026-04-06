// capstone/dan-laduke — NFT Trade Offer Board
// SPDX-License-Identifier: Apache-2.0

import { CompiledContract } from '@midnight-ntwrk/compact-js';
export * from './managed/nft-trade/contract/index.js';
export * from './witnesses';

import * as CompiledNFTTradeContract from './managed/nft-trade/contract/index.js';
import * as Witnesses from './witnesses';

export const CompiledNFTTradeContractContract = CompiledContract.make<
  CompiledNFTTradeContract.Contract<Witnesses.NFTTradePrivateState>
>(
  'NFTTrade',
  CompiledNFTTradeContract.Contract<Witnesses.NFTTradePrivateState>,
).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets('./compiled/nft-trade'),
);
