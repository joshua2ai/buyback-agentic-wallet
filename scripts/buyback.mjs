import {Contract, Interface, JsonRpcProvider, formatUnits, getAddress, isAddress, parseUnits, ZeroAddress} from 'ethers';

const CHAIN_ID=56;
const FACTORY=getAddress('0x8ed655c529004E7db3F46304140e5880aC09991B');
const WBNB=getAddress('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
const RPC_URL=process.env.BUYBACK_BSC_RPC_URL||'https://bsc-dataseed.bnbchain.org';
const INDEX_URL=process.env.BUYBACK_INDEX_URL||'https://buyback.cafe/api/v1/overview';
const factoryAbi=['function poolCount() view returns (uint256)','function poolAt(uint256) view returns (address)'];
const poolAbi=[
 'function factory() view returns (address)','function contractRelease() view returns (string)',
 'function buybackToken() view returns (address)','function paymentToken() view returns (address)',
 'function isNativeBuyback() view returns (bool)','function isNativePayment() view returns (bool)',
 'function rewardAmount() view returns (uint256)','function currentBudget() view returns (uint256,uint256,uint256,bool)',
 'function totalDeposited() view returns (uint256)','function startTime() view returns (uint64)','function endTime() view returns (uint64)',
 'function minPerWallet() view returns (uint256)','function maxPerWallet() view returns (uint256)',
 'function deposits(address) view returns (uint256)','function claimed(address) view returns (bool)',
 'function previewClaim(address) view returns (uint256)','function purchasedTokensWithdrawn() view returns (bool)',
 'function purchasedClaimed(address) view returns (bool)','function previewPurchasedTokens(address) view returns (uint256)',
 'function deposit(uint256)','function depositNative() payable','function claim() returns (uint256)',
 'function claimAndSettlePurchasedTokens() returns (uint256,uint256)','function claimPurchasedTokens() returns (uint256)',
 'function claimPurchasedWrappedTokens() returns (uint256)'];
const tokenAbi=['function symbol() view returns (string)','function name() view returns (string)','function decimals() view returns (uint8)','function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)'];
const poolInterface=new Interface(poolAbi),tokenInterface=new Interface(tokenAbi);
const address=value=>{if(!isAddress(value||''))throw Error(`Invalid EVM address: ${value??''}`);return getAddress(value);};
const stringify=data=>JSON.stringify(data,(_,value)=>typeof value==='bigint'?value.toString():value,2);
const intArg=(args,key)=>{const i=args.indexOf(key);if(i<0||!args[i+1])throw Error(`Missing ${key}`);return args[i+1];};
export function parseAmount(input,decimals){
 if(!/^\d+(?:\.\d+)?$/.test(input||''))throw Error('Amount must be a positive decimal number.');
 const amount=parseUnits(input,decimals);
 if(amount<=0n)throw Error('Amount must be greater than zero.');
 return amount;
}
export function depositCalls({pool,wallet,token,amount,balance,allowance,native,already,min,max}){
 if(amount<=0n||amount+already<min||(max>0n&&amount+already>max))throw Error('Amount is outside the pool wallet limits.');
 if(balance<amount)throw Error('Insufficient deposit-token balance.');
 const calls=[];
 if(!native&&allowance<amount)calls.push({chainId:CHAIN_ID,from:wallet,to:token,value:'0',inputData:tokenInterface.encodeFunctionData('approve',[pool,amount]),method:'approve',amount:amount.toString(),spender:pool});
 calls.push({chainId:CHAIN_ID,from:wallet,to:pool,value:native?amount.toString():'0',inputData:poolInterface.encodeFunctionData(native?'depositNative':'deposit',native?[]:[amount]),method:native?'depositNative':'deposit',amount:amount.toString(),depositToken:token});
 return calls;
}
export function claimCall({pool,wallet,kind='payout',purchasedTokensWithdrawn=false,nativeBuyback=false}){
 const method=kind==='purchased'?(nativeBuyback?'claimPurchasedWrappedTokens':'claimPurchasedTokens'):(purchasedTokensWithdrawn?'claim':'claimAndSettlePurchasedTokens');
 return {chainId:CHAIN_ID,from:wallet,to:pool,value:'0',inputData:poolInterface.encodeFunctionData(method,[]),method};
}
async function tokenInfo(provider,token,native){
 if(native)return {address:ZeroAddress,symbol:'BNB',name:'BNB',decimals:18};
 const c=new Contract(token,tokenAbi,provider);
 const [symbol,name,decimals]=await Promise.all([c.symbol(),c.name(),c.decimals()]);
 return {address:token,symbol,name,decimals:Number(decimals)};
}
async function verifiedPool(provider,poolAddress,knownIndex=null){
 const factory=new Contract(FACTORY,factoryAbi,provider),pool=new Contract(poolAddress,poolAbi,provider);
 const [count,poolFactory,release]=await Promise.all([factory.poolCount(),pool.factory(),pool.contractRelease()]);
 if(getAddress(poolFactory)!==FACTORY)throw Error('Pool reports a different Factory.');
 if(!/^3\.(?:9|10)\.\d+$/.test(release))throw Error(`Unsupported pool release ${release}.`);
 // The Factory registry is the authoritative membership check. The public index is an optional fast hint.
 let found=knownIndex!==null&&knownIndex>=0n&&knownIndex<count&&getAddress(await factory.poolAt(knownIndex))===poolAddress;
 const response=found?null:await fetch(INDEX_URL,{signal:AbortSignal.timeout(4000)}).catch(()=>null);
 if(response?.ok){
  const body=await response.json();
  const network=body.networks?.find(entry=>Number(entry.chainId)===CHAIN_ID&&getAddress(entry.factory)===FACTORY);
  const hint=network?.pools?.find(entry=>entry.address?.toLowerCase()===poolAddress.toLowerCase());
  if(hint&&Number.isInteger(hint.index)&&hint.index>=0&&BigInt(hint.index)<count)found=getAddress(await factory.poolAt(hint.index))===poolAddress;
 }
 if(!found){for(let i=count-1n;i>=0n;i--){if(getAddress(await factory.poolAt(i))===poolAddress){found=true;break;}}}
 if(!found)throw Error('Pool is not registered by the configured BSC Factory.');
 return {pool,release};
}
async function inspect(provider,poolAddress,wallet,knownIndex=null){
 const {pool,release}=await verifiedPool(provider,poolAddress,knownIndex);
 const [buyAddress,payAddress,nativeBuyback,nativePayment,rewardAmount,totalDeposited,start,end,min,max]=await Promise.all([
  pool.buybackToken(),pool.paymentToken(),pool.isNativeBuyback(),pool.isNativePayment(),pool.rewardAmount(),pool.totalDeposited(),pool.startTime(),pool.endTime(),pool.minPerWallet(),pool.maxPerWallet()]);
 const [buyToken,payToken]=await Promise.all([tokenInfo(provider,getAddress(buyAddress),nativeBuyback),tokenInfo(provider,getAddress(payAddress),nativePayment)]);
 const now=BigInt(Math.floor(Date.now()/1000));
 const budget=await pool.currentBudget().catch(()=>null);
 const result={chainId:CHAIN_ID,factory:FACTORY,pool:poolAddress,release,status:now<start?'scheduled':now>=end?'closed':'live',start:Number(start),end:Number(end),depositToken:buyToken,paymentToken:payToken,initialBudget:formatUnits(rewardAmount,payToken.decimals),currentBudget:budget?formatUnits(budget[2],payToken.decimals):null,totalDeposited:formatUnits(totalDeposited,buyToken.decimals),minPerWallet:formatUnits(min,buyToken.decimals),maxPerWallet:max===0n?null:formatUnits(max,buyToken.decimals)};
 if(wallet){
  const [deposited,claimed,purchasedClaimed,purchasedTokensWithdrawn,balance]=await Promise.all([
   pool.deposits(wallet),pool.claimed(wallet),pool.purchasedClaimed(wallet),pool.purchasedTokensWithdrawn(),nativeBuyback?provider.getBalance(wallet):new Contract(buyAddress,tokenAbi,provider).balanceOf(wallet)]);
  result.wallet={address:wallet,deposited:formatUnits(deposited,buyToken.decimals),claimed,purchasedClaimed,purchasedTokensWithdrawn,balance:formatUnits(balance,buyToken.decimals)};
 }
 return {pool,result,buyAddress,payAddress,nativeBuyback,nativePayment,start,end,min,max};
}
async function list(provider){
 try{
  const response=await fetch(INDEX_URL,{signal:AbortSignal.timeout(4000)});
  if(!response.ok)throw Error(`Pool index HTTP ${response.status}`);
  const body=await response.json(),network=body.networks?.find(entry=>Number(entry.chainId)===CHAIN_ID&&entry.factory?.toLowerCase()===FACTORY.toLowerCase());
  if(!network?.ready)throw Error('BSC pool index is not ready.');
  return {chainId:CHAIN_ID,factory:FACTORY,source:'index',indexedAtBlock:network.indexedAtBlock,pools:network.pools.map(pool=>({address:pool.address,index:pool.index,status:Date.now()/1000<pool.start?'scheduled':Date.now()/1000>=pool.end?'closed':'live',depositToken:pool.buyToken,paymentToken:pool.payToken,budget:formatUnits(BigInt(pool.effectiveRewardAmount??pool.rewardAmount),pool.payToken.decimals),end:pool.end,participants:pool.participantCount}))};
 }catch{
  if(BigInt(await provider.send('eth_chainId',[]))!==BigInt(CHAIN_ID))throw Error('RPC chain ID is not BSC 56.');
  const factory=new Contract(FACTORY,factoryAbi,provider),count=await factory.poolCount(),pools=[];
  for(let i=count-1n;i>=0n&&pools.length<20;i--){
   const poolAddress=getAddress(await factory.poolAt(i)),state=await inspect(provider,poolAddress,null,i);
   pools.push({address:poolAddress,index:Number(i),status:state.result.status,depositToken:state.result.depositToken,paymentToken:state.result.paymentToken,budget:state.result.currentBudget,initialBudget:state.result.initialBudget,end:state.result.end});
  }
  return {chainId:CHAIN_ID,factory:FACTORY,source:'chain',totalPools:Number(count),pools};
 }
}
async function main(argv){
 const [command,...args]=argv;
 if(!command||command==='help')return {usage:['list','inspect --pool <address> [--wallet <address>]','deposit --pool <address> --wallet <address> --amount <token amount>','claim --pool <address> --wallet <address> [--kind payout|purchased]'],rpcEnv:'BUYBACK_BSC_RPC_URL',indexEnv:'BUYBACK_INDEX_URL'};
 if(!['list','inspect','deposit','claim'].includes(command))throw Error('Unknown command. Run help.');
 const provider=new JsonRpcProvider(RPC_URL);
 if(command==='list')return list(provider);
 if(BigInt(await provider.send('eth_chainId',[]))!==BigInt(CHAIN_ID))throw Error('RPC chain ID is not BSC 56.');
 const poolAddress=address(intArg(args,'--pool'));
 const wallet=args.includes('--wallet')?address(intArg(args,'--wallet')):null;
 if(command!=='inspect'&&!wallet)throw Error('A Binance Agentic Wallet address is required.');
 const state=await inspect(provider,poolAddress,wallet);
 if(command==='inspect')return state.result;
 if(command==='deposit'){
  if(state.result.status!=='live')throw Error('Pool is not open for deposits.');
  const amount=parseAmount(intArg(args,'--amount'),state.result.depositToken.decimals);
  const already=await state.pool.deposits(wallet);
  const token=new Contract(state.buyAddress,tokenAbi,provider);
  const [balance,allowance]=await Promise.all([state.nativeBuyback?provider.getBalance(wallet):token.balanceOf(wallet),state.nativeBuyback?Promise.resolve(0n):token.allowance(wallet,poolAddress)]);
  const calls=depositCalls({pool:poolAddress,wallet,token:state.buyAddress,amount,balance,allowance,native:state.nativeBuyback,already,min:state.min,max:state.max});
  return {pool:state.result,requestedAmount:intArg(args,'--amount'),calls,approvalRequired:calls.length===2,note:'Preview every call in Binance Agentic Wallet. Execute only after the user explicitly confirms that call.'};
 }
 const kind=args.includes('--kind')?intArg(args,'--kind'):'payout';
 if(!['payout','purchased'].includes(kind))throw Error('Claim kind must be payout or purchased.');
 if(state.result.status!=='closed')throw Error('Pool has not ended.');
 if(kind==='payout'){
  if(await state.pool.deposits(wallet)===0n||await state.pool.claimed(wallet))throw Error('No unclaimed participant payout.');
  const amount=await state.pool.previewClaim(wallet);
  return {pool:state.result,kind,expectedPayout:formatUnits(amount,state.result.paymentToken.decimals),call:claimCall({pool:poolAddress,wallet,purchasedTokensWithdrawn:state.result.wallet.purchasedTokensWithdrawn})};
 }
 if(!state.result.wallet.purchasedTokensWithdrawn||state.result.wallet.purchasedClaimed)throw Error('Purchased tokens are not claimable by this wallet.');
 const amount=await state.pool.previewPurchasedTokens(wallet);
 if(amount===0n)throw Error('No purchased-token allocation for this wallet.');
 return {pool:state.result,kind,expectedTokens:formatUnits(amount,state.result.depositToken.decimals),receiveToken:state.nativeBuyback?{address:WBNB,symbol:'WBNB'}:state.result.depositToken,call:claimCall({pool:poolAddress,wallet,kind,nativeBuyback:state.nativeBuyback})};
}

if(process.argv[1]&&import.meta.url===new URL(`file:///${process.argv[1].replaceAll('\\','/')}`).href){
 main(process.argv.slice(2)).then(result=>console.log(stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
