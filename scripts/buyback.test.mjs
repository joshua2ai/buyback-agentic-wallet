import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {claimCall,depositCalls,parseAmount} from './buyback.mjs';

const pool='0xa2CFAE710Ec8eDbceb5E7DA7DD9dd55706fb8B40';
const wallet='0xA9A08D4Ff16d0e12A3B9D65F20d03670dEa079c6';
const token='0x0c6302401aa5325C2E36F170f52C00B1d220B405';
const erc20=new Interface(['function approve(address,uint256)']);
const buyback=new Interface(['function deposit(uint256)','function depositNative()','function claim()','function claimAndSettlePurchasedTokens()','function claimPurchasedWrappedTokens()']);

test('ERC20 participation uses exact approval and pool deposit',()=>{
 const amount=parseAmount('2.5',18);
 const calls=depositCalls({pool,wallet,token,amount,balance:3n*10n**18n,allowance:0n,native:false,already:0n,min:0n,max:0n});
 assert.equal(calls.length,2);
 assert.deepEqual(erc20.decodeFunctionData('approve',calls[0].inputData).map(String),[pool,amount.toString()]);
 assert.equal(calls[0].to,token);
 assert.equal(buyback.decodeFunctionData('deposit',calls[1].inputData)[0],amount);
 assert.equal(calls[1].to,pool);
 assert.equal(calls[1].value,'0');
});

test('native participation sends wei and no ERC20 approval',()=>{
 const amount=parseAmount('0.1',18);
 const calls=depositCalls({pool,wallet,token,amount,balance:10n**18n,allowance:0n,native:true,already:0n,min:0n,max:0n});
 assert.equal(calls.length,1);
 assert.equal(calls[0].inputData,buyback.encodeFunctionData('depositNative',[]));
 assert.equal(calls[0].value,amount.toString());
});

test('wallet limit and balance checks prevent invalid intents',()=>{
 const base={pool,wallet,token,amount:2n,balance:10n,allowance:10n,native:false,already:1n,min:0n,max:2n};
 assert.throws(()=>depositCalls(base),/wallet limits/);
 assert.throws(()=>depositCalls({...base,max:0n,balance:1n}),/balance/);
 assert.throws(()=>parseAmount('1e18',18),/decimal/);
});

test('payout and wrapped native purchased claim choose intended ABI',()=>{
 assert.equal(claimCall({pool,wallet}).inputData,buyback.encodeFunctionData('claimAndSettlePurchasedTokens',[]));
 assert.equal(claimCall({pool,wallet,purchasedTokensWithdrawn:true}).inputData,buyback.encodeFunctionData('claim',[]));
 assert.equal(claimCall({pool,wallet,kind:'purchased',nativeBuyback:true}).inputData,buyback.encodeFunctionData('claimPurchasedWrappedTokens',[]));
});
